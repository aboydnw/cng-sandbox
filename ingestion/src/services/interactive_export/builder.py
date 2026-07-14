"""Orchestrates per-chapter export and assembles the final zip."""

from __future__ import annotations

import concurrent.futures
import csv
import io
import json
import re
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from src.models.cng_rc import CngRcChapter, CngRcConfig, CngRcLayer
from src.services.interactive_export import (
    asset_inline,
    chart_export,
    html_shell,
    raster_pyramid,
    runtime_assets,
    source_resolver,
    vector_arrow,
)
from src.services.url_validation import (
    SSRFError,
    raise_if_redirect,
    validate_url_safe,
)

PYRAMID_BUILD_TIMEOUT_SECONDS = 120.0

_SAFE_CHAPTER_ID = re.compile(r"^[A-Za-z0-9_-]+$")


def _safe_chapter_dir(staging: Path, chapter_id: str) -> Path:
    """Create a per-chapter staging dir, rejecting any traversal-shaped id."""
    if not chapter_id or not _SAFE_CHAPTER_ID.match(chapter_id):
        raise ValueError(f"invalid chapter id: {chapter_id!r}")
    root = (staging / "chapters").resolve()
    chapter_dir = (root / chapter_id).resolve()
    if chapter_dir.parent != root:
        raise ValueError(f"chapter id escapes staging dir: {chapter_id!r}")
    chapter_dir.mkdir(parents=True, exist_ok=True)
    return chapter_dir


def _zoom_range(zoom: float) -> tuple[int, int]:
    iz = int(zoom)
    return max(0, iz - 2), iz + 1


def _bbox_for_chapter(
    map_state: dict[str, Any],
) -> tuple[float, float, float, float]:
    """Derive a coarse EPSG:4326 bbox from a chapter's saved map state.

    Covers ~4 tiles of context at the chapter's zoom. Intentionally coarse:
    exact tile bounds aren't worth the complexity at this stage.
    """
    # TODO(plan 4): tighten bbox math (right now we over-pad).
    center = map_state.get("center") or [0.0, 0.0]
    zoom = float(map_state.get("zoom") or 0)
    lng, lat = float(center[0]), float(center[1])
    width_deg = 360.0 / (2**zoom) * 4
    height_deg = width_deg / 2
    return (
        max(-180.0, lng - width_deg / 2),
        max(-85.0, lat - height_deg / 2),
        min(180.0, lng + width_deg / 2),
        min(85.0, lat + height_deg / 2),
    )


def _build_map_chapter(
    cng_chapter: CngRcChapter,
    raw_chapter: dict[str, Any],
    layers: dict[str, CngRcLayer],
    chapter_dir: Path,
) -> dict[str, Any]:
    map_state = raw_chapter.get("map_state") or {}
    bbox = _bbox_for_chapter(map_state)
    min_zoom, max_zoom = _zoom_range(map_state.get("zoom", 0))

    manifest_layers: list[dict[str, Any]] = []
    for layer_id in cng_chapter.layers:
        layer = layers.get(layer_id)
        if layer is None:
            continue
        src_url = layer.cng_url or layer.source_url
        if not src_url:
            raise ValueError(f"layer {layer_id} has no usable source URL")

        if layer.type == "raster-cog":
            out = chapter_dir / f"{layer_id}.pmtiles"
            resolved_url = source_resolver.resolve_raster_source(src_url)
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = executor.submit(
                raster_pyramid.build_pyramid,
                source_url=resolved_url,
                bbox=bbox,
                min_zoom=min_zoom,
                max_zoom=max_zoom,
                output_path=out,
            )
            try:
                future.result(timeout=PYRAMID_BUILD_TIMEOUT_SECONDS)
            except concurrent.futures.TimeoutError as exc:
                future.cancel()
                executor.shutdown(wait=False)
                raise ValueError(
                    f"raster pyramid build for layer {layer_id} timed out "
                    f"after {PYRAMID_BUILD_TIMEOUT_SECONDS:.0f}s"
                ) from exc
            else:
                executor.shutdown(wait=True)
            render = layer.render
            rescale_min = render.rescale[0] if render.rescale else None
            rescale_max = render.rescale[1] if render.rescale else None
            manifest_layers.append(
                {
                    "id": layer_id,
                    "kind": "raster",
                    "src": f"{layer_id}.pmtiles",
                    "colormap": render.colormap or "viridis",
                    "rescale_min": rescale_min,
                    "rescale_max": rescale_max,
                    "opacity": render.opacity if render.opacity is not None else 1.0,
                    "colormap_reversed": bool(render.colormap_reversed),
                    "band": render.band,
                    "timestep": render.timestep,
                }
            )
        elif layer.type == "vector-geoparquet":
            out = chapter_dir / f"{layer_id}.arrow"
            with source_resolver.vector_source_path(src_url) as resolved_path:
                vector_arrow.write_arrow(
                    source_url=resolved_path,
                    bbox=bbox,
                    keep_columns=[],
                    output_path=out,
                )
            manifest_layers.append(
                {
                    "id": layer_id,
                    "kind": "vector",
                    "src": f"{layer_id}.arrow",
                    "geom": "polygon",
                    "style": {},
                    "opacity": layer.render.opacity
                    if layer.render.opacity is not None
                    else 1.0,
                }
            )
        elif layer.type == "trajectory":
            out = chapter_dir / f"{layer_id}.trips.json"
            source_resolver.fetch_trips_json(src_url, out)
            manifest_layers.append(
                {
                    "id": layer_id,
                    "kind": "trips",
                    "src": f"{layer_id}.trips.json",
                    "opacity": layer.render.opacity
                    if layer.render.opacity is not None
                    else 1.0,
                    "trail_length": layer.render.trail_length or 600,
                }
            )
        else:
            raise ValueError(
                f"layer type {layer.type!r} not yet supported in interactive export"
            )

    return {
        "id": cng_chapter.id,
        "type": "map",
        "title": cng_chapter.title or "",
        "narrative": raw_chapter.get("narrative", "") or raw_chapter.get("body", ""),
        "camera": {
            "center": list(cng_chapter.map.center) if cng_chapter.map else None,
            "zoom": cng_chapter.map.zoom if cng_chapter.map else None,
            "bearing": cng_chapter.map.bearing if cng_chapter.map else 0,
            "pitch": cng_chapter.map.pitch if cng_chapter.map else 0,
        },
        "basemap": map_state.get("basemap", "streets"),
        "layers": manifest_layers,
        "legend": raw_chapter.get("legend"),
    }


def _fetch_csv_rows(url: str) -> list[dict[str, Any]]:
    """Fetch a CSV from a URL and return parsed rows with numeric coercion.

    Applies SSRF protection: rejects non-http(s) schemes and any host that
    resolves to a private/loopback/link-local address, and refuses redirects.
    """
    try:
        validate_url_safe(url)
    except SSRFError as exc:
        raise ValueError(f"refusing to fetch csv from disallowed URL: {exc}") from exc
    resp = httpx.get(url, timeout=30.0, follow_redirects=False)
    raise_if_redirect(resp)
    resp.raise_for_status()
    reader = csv.DictReader(io.StringIO(resp.text))
    rows: list[dict[str, Any]] = []
    for r in reader:
        parsed: dict[str, Any] = {}
        for k, v in r.items():
            if v is None or v == "":
                parsed[k] = None
                continue
            try:
                f = float(v)
                parsed[k] = int(f) if f.is_integer() else f
            except (TypeError, ValueError):
                parsed[k] = v
        rows.append(parsed)
    return rows


def _build_chart_chapter(
    raw: dict[str, Any],
    chapter_dir: Path,
    payload: dict[str, Any] | None,
) -> dict[str, Any]:
    viz = (raw.get("chart") or {}).get("viz") or {}
    if payload is None:
        raise ValueError(
            f"chart chapter {raw['id']} has no resolved chart_data payload"
        )
    kind = payload["kind"]
    if kind == "csv_rows":
        opt = chart_export.option_from_csv_rows(payload["rows"], viz)
    elif kind == "timeseries_points":
        opt = chart_export.line_option_from_timeseries(
            payload["points"],
            x_label=viz.get("x_label", ""),
            y_label=viz.get("y_label", ""),
            y_scale=viz.get("y_scale", "linear"),
        )
    elif kind == "histogram_bins":
        opt = chart_export.bar_option_from_histogram(payload["bins"])
    else:
        raise ValueError(f"unknown chart_data kind: {kind!r}")

    (chapter_dir / "chart.json").write_text(json.dumps(opt), encoding="utf-8")
    return {
        "id": raw["id"],
        "type": "chart",
        "title": raw.get("title", ""),
        "narrative": raw.get("narrative", ""),
        "chart_src": "chart.json",
    }


def _build_scrolly_chapter(
    chapter: dict[str, Any],
    chapter_dir: Path,
    scrolly_pngs: dict[str, bytes],
) -> dict[str, Any]:
    png = scrolly_pngs.get(chapter["id"])
    if not png:
        raise ValueError(
            f"scrollytelling chapter {chapter['id']} missing uploaded snapshot PNG"
        )
    (chapter_dir / "snapshot.png").write_bytes(png)
    return {
        "id": chapter["id"],
        "type": "scrollytelling",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
        "snapshot_src": "snapshot.png",
    }


def _build_prose_chapter(chapter: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": chapter["id"],
        "type": "prose",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
    }


def _build_image_chapter(
    chapter: dict[str, Any],
    assets_dir: Path,
) -> dict[str, Any]:
    image = chapter.get("image") or {}
    src_url = image.get("url")
    asset_name = (
        asset_inline.fetch_into(src_url, assets_dir, f"{chapter['id']}-image")
        if src_url
        else None
    )
    return {
        "id": chapter["id"],
        "type": "image",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
        "image_src": f"assets/{asset_name}" if asset_name else None,
        "image_url": None if asset_name else src_url or "",
        "alt": image.get("alt_text", ""),
    }


def _youtube_thumbnail_url(video: dict[str, Any]) -> str | None:
    if video.get("provider") != "youtube":
        return None
    vid = video.get("video_id")
    if not vid:
        return None
    return f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg"


def _build_video_chapter(
    chapter: dict[str, Any],
    assets_dir: Path,
) -> dict[str, Any]:
    video = chapter.get("video") or {}
    thumb_url = _youtube_thumbnail_url(video)
    asset_name = (
        asset_inline.fetch_into(thumb_url, assets_dir, f"{chapter['id']}-thumb")
        if thumb_url
        else None
    )
    return {
        "id": chapter["id"],
        "type": "video",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
        "video": video,
        "thumbnail_src": f"assets/{asset_name}" if asset_name else None,
    }


def build_interactive_export(
    config: CngRcConfig,
    chapters_raw: list[dict[str, Any]],
    chart_data_by_chapter: dict[str, dict[str, Any]],
    scrolly_pngs: dict[str, bytes],
) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(tmp)
        (staging / "chapters").mkdir()
        assets_dir = staging / "assets"
        assets_dir.mkdir()
        runtime_assets.copy_into(staging)

        raw_by_id = {ch["id"]: ch for ch in chapters_raw}

        manifest_chapters: list[dict[str, Any]] = []
        for cng_ch in config.chapters:
            raw = raw_by_id.get(cng_ch.id, {"id": cng_ch.id})
            cdir = _safe_chapter_dir(staging, cng_ch.id)
            t = cng_ch.type
            if t == "map":
                entry = _build_map_chapter(cng_ch, raw, config.layers, cdir)
            elif t == "chart":
                entry = _build_chart_chapter(
                    raw, cdir, chart_data_by_chapter.get(cng_ch.id)
                )
            elif t == "scrollytelling":
                entry = _build_scrolly_chapter(raw, cdir, scrolly_pngs)
            elif t == "prose":
                entry = _build_prose_chapter(raw)
            elif t == "image":
                entry = _build_image_chapter(raw, assets_dir)
            elif t == "video":
                entry = _build_video_chapter(raw, assets_dir)
            elif t == "flyover":
                raise ValueError(
                    "flyover chapters are not yet supported in interactive export"
                )
            else:
                raise ValueError(f"unknown chapter type: {t!r}")
            manifest_chapters.append(entry)

        manifest = {
            "story": {
                "id": config.origin.story_id,
                "title": config.metadata.title or "",
                "description": config.metadata.description or "",
            },
            "exported_at": datetime.now(UTC).isoformat(),
            "runtime_version": "0.1.0-plan3",
            "chapters": manifest_chapters,
        }
        html_shell.write_shell(staging, manifest)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(staging.rglob("*")):
                if path.is_file():
                    zf.write(path, path.relative_to(staging))
        return buf.getvalue()
