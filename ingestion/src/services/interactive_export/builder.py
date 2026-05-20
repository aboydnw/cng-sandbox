"""Orchestrates per-chapter export and assembles the final zip."""

from __future__ import annotations

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

from src.services.interactive_export import (
    chart_export,
    html_shell,
    raster_pyramid,
    runtime_assets,
    vector_arrow,
)
from src.services.url_validation import (
    SSRFError,
    raise_if_redirect,
    validate_url_safe,
)

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


def _build_map_chapter(
    chapter: dict[str, Any],
    chapter_dir: Path,
    connections: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    layer_config = chapter.get("layer_config") or {}
    raster_layers = layer_config.get("raster") or []
    vector_layers = layer_config.get("vector") or []

    for r in raster_layers:
        conn_id = r.get("connection_id")
        if conn_id and connections.get(conn_id, {}).get("connection_type") == "zarr":
            raise ValueError(
                "zarr chapters are not yet supported in interactive export"
            )

    manifest_layers: list[dict[str, Any]] = []
    ms = chapter.get("map_state") or {}
    min_zoom, max_zoom = _zoom_range(ms.get("zoom", 0))

    for r in raster_layers:
        out = chapter_dir / f"{r['id']}.pmtiles"
        bbox = tuple(r["bbox"])
        raster_pyramid.build_pyramid(
            source_url=r["source_url"],
            bbox=bbox,
            min_zoom=min_zoom,
            max_zoom=max_zoom,
            output_path=out,
        )
        manifest_layers.append(
            {
                "id": r["id"],
                "kind": "raster",
                "src": f"{r['id']}.pmtiles",
                "colormap": r.get("colormap", "viridis"),
                "rescale": r.get("rescale", [0, 1]),
            }
        )

    for v in vector_layers:
        out = chapter_dir / f"{v['id']}.arrow"
        vector_arrow.write_arrow(
            source_url=v["source_url"],
            bbox=tuple(v["bbox"]),
            keep_columns=v.get("keep_columns", []),
            output_path=out,
        )
        manifest_layers.append(
            {
                "id": v["id"],
                "kind": "vector",
                "src": f"{v['id']}.arrow",
                "geom": v.get("geom", "polygon"),
                "style": v.get("style", {}),
            }
        )

    return {
        "id": chapter["id"],
        "type": "map",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
        "camera": {
            "center": ms.get("center"),
            "zoom": ms.get("zoom"),
            "bearing": ms.get("bearing", 0),
            "pitch": ms.get("pitch", 0),
        },
        "basemap": ms.get("basemap", "voyager"),
        "layers": manifest_layers,
        "legend": chapter.get("legend"),
    }


def _fetch_csv_rows(url: str) -> list[dict[str, Any]]:
    """Fetch a CSV from a URL and return parsed rows with numeric coercion.

    Plan 1: supports csv sources with a `url` field only. Plan 3 will add
    csv_asset (workspace asset lookup), dataset_timeseries, and dataset_histogram.

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


def _build_chart_chapter(chapter: dict[str, Any], chapter_dir: Path) -> dict[str, Any]:
    chart = chapter.get("chart") or {}
    source = chart.get("source") or {}
    viz = chart.get("viz") or {}
    kind = source.get("kind")

    if kind == "csv":
        url = source.get("url")
        if not url:
            raise ValueError(
                "csv chart source missing url (csv_asset not yet supported)"
            )
        rows = _fetch_csv_rows(url)
        opt = chart_export.option_from_csv_rows(rows, viz)
    elif kind in ("csv_asset", "dataset_timeseries", "dataset_histogram"):
        raise ValueError(
            f"chart source kind {kind!r} not yet supported in interactive export"
        )
    else:
        raise ValueError(f"unknown chart source kind: {kind!r}")

    (chapter_dir / "chart.json").write_text(json.dumps(opt), encoding="utf-8")
    return {
        "id": chapter["id"],
        "type": "chart",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
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


def _build_image_chapter(chapter: dict[str, Any], chapter_dir: Path) -> dict[str, Any]:
    image = chapter.get("image") or {}
    return {
        "id": chapter["id"],
        "type": "image",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
        "image_url": image.get("url", ""),
        "alt": image.get("alt_text", ""),
    }


def _build_video_chapter(chapter: dict[str, Any]) -> dict[str, Any]:
    video = chapter.get("video") or {}
    return {
        "id": chapter["id"],
        "type": "video",
        "title": chapter.get("title", ""),
        "narrative": chapter.get("narrative", ""),
        "video": video,
    }


def build_interactive_export(
    story: dict[str, Any],
    chapters: list[dict[str, Any]],
    datasets: dict[str, dict[str, Any]],
    connections: dict[str, dict[str, Any]],
    scrolly_pngs: dict[str, bytes],
) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(tmp)
        (staging / "chapters").mkdir()
        (staging / "assets").mkdir()
        runtime_assets.copy_into(staging)

        manifest_chapters: list[dict[str, Any]] = []
        for ch in chapters:
            cdir = _safe_chapter_dir(staging, ch["id"])
            t = ch["type"]
            if t == "map":
                entry = _build_map_chapter(ch, cdir, connections)
            elif t == "chart":
                entry = _build_chart_chapter(ch, cdir)
            elif t == "scrollytelling":
                entry = _build_scrolly_chapter(ch, cdir, scrolly_pngs)
            elif t == "prose":
                entry = _build_prose_chapter(ch)
            elif t == "image":
                entry = _build_image_chapter(ch, cdir)
            elif t == "video":
                entry = _build_video_chapter(ch)
            else:
                raise ValueError(f"unknown chapter type: {t!r}")
            manifest_chapters.append(entry)

        manifest = {
            "story": {
                "id": story["id"],
                "title": story.get("title", ""),
                "description": story.get("description", ""),
            },
            "exported_at": datetime.now(UTC).isoformat(),
            "runtime_version": "0.1.0-plan1",
            "chapters": manifest_chapters,
        }
        html_shell.write_shell(staging, manifest)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(staging.rglob("*")):
                if path.is_file():
                    zf.write(path, path.relative_to(staging))
        return buf.getvalue()
