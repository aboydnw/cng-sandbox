"""Resolve a chart chapter's source into a payload the builder can write out.

The builder owns option assembly and zip writing. This module owns "where does
the chart's data come from?" — workspace asset CSV, dataset timeseries point,
dataset histogram statistics, or a public CSV URL. URL-based CSV stays in the
builder so SSRF rules live next to the helper that fetches.
"""

from __future__ import annotations

import csv
import io
import logging
from typing import Any

import obstore
from sqlalchemy.orm import Session

from src.models.story_asset import StoryAssetRow
from src.routes import dataset_charts
from src.services.storage import StorageService

logger = logging.getLogger(__name__)


def _parse_csv_text(text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
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


def _read_story_asset_csv(session: Session, workspace_id: str, asset_id: str) -> str:
    """Return the CSV text for a story-asset, or raise ValueError on miss.

    Mirrors ingestion/src/routes/story_assets.py:228 — reads the asset's
    primary file from R2 using the same object-store client and key the
    /story-assets/{asset_id}/data route uses.
    """
    row = session.query(StoryAssetRow).filter_by(id=asset_id).first()
    if row is None:
        raise ValueError(f"story asset {asset_id!r} not found")
    if row.workspace_id and row.workspace_id != workspace_id:
        raise ValueError(f"story asset {asset_id!r} not found in workspace")

    storage = StorageService()
    try:
        result = obstore.get(storage.store, row.original_key)
        data = bytes(result.bytes())
    except FileNotFoundError as exc:
        raise ValueError(
            f"story asset {asset_id!r} has no data in object store"
        ) from exc
    except Exception as exc:
        logger.exception("chart_data: failed to fetch asset data for %s", asset_id)
        raise ValueError(f"failed to fetch asset data for {asset_id!r}") from exc

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(
            f"story asset {asset_id!r} data is not valid UTF-8 CSV"
        ) from exc


def resolve(
    raw_chapter: dict[str, Any],
    session: Session,
    workspace_id: str,
) -> dict[str, Any]:
    """Resolve a chart chapter's source into a payload dict.

    Returns one of:
      {"kind": "csv_rows", "rows": [...]}
      {"kind": "timeseries_points", "points": [{"datetime": ..., "value": ...}, ...]}
      {"kind": "histogram_bins", "bins": [{"bin_min": ..., "bin_max": ..., "count": ...}, ...]}

    The builder dispatches on `payload["kind"]` to pick the right option builder.
    """
    chart = raw_chapter.get("chart") or {}
    source = chart.get("source") or {}
    kind = source.get("kind")

    if kind == "csv":
        if source.get("url"):
            # URL-based CSV stays in the builder (SSRF rules live there).
            from src.services.interactive_export import builder

            rows = builder._fetch_csv_rows(source["url"])
            return {"kind": "csv_rows", "rows": rows}
        if source.get("asset_id"):
            text = _read_story_asset_csv(session, workspace_id, source["asset_id"])
            return {"kind": "csv_rows", "rows": _parse_csv_text(text)}
        raise ValueError("csv chart source has neither url nor asset_id")

    if kind == "dataset_timeseries":
        dataset_id = source.get("dataset_id")
        point = source.get("point")
        if not dataset_id or not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError(
                "dataset_timeseries source requires dataset_id and [lon, lat] point"
            )
        try:
            lon = float(point[0])
            lat = float(point[1])
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "dataset_timeseries point coordinates must be numeric"
            ) from exc
        ds = dataset_charts.load_dataset(session, dataset_id, workspace_id)
        if not ds.get("is_temporal"):
            raise ValueError(f"dataset {dataset_id!r} is not temporal")
        timesteps = ds.get("timesteps") or []
        if not timesteps:
            raise ValueError(f"dataset {dataset_id!r} has no timesteps")
        collection_id = ds.get("stac_collection_id") or dataset_id
        datetimes = tuple(ts["datetime"] for ts in timesteps)
        pairs = dataset_charts.cached_timeseries(
            dataset_id, collection_id, lon, lat, datetimes
        )
        return {
            "kind": "timeseries_points",
            "points": [{"datetime": dt, "value": v} for dt, v in pairs],
        }

    if kind == "dataset_histogram":
        dataset_id = source.get("dataset_id")
        if not dataset_id:
            raise ValueError("dataset_histogram source requires dataset_id")
        bins_raw = source.get("bins", 20)
        try:
            bins_requested = int(bins_raw) if bins_raw is not None else 20
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"dataset_histogram bins must be a positive integer, got {bins_raw!r}"
            ) from exc
        if bins_requested <= 0:
            raise ValueError(
                f"dataset_histogram bins must be > 0, got {bins_requested}"
            )
        ds = dataset_charts.load_dataset(session, dataset_id, workspace_id)
        collection_id = ds.get("stac_collection_id") or dataset_id
        # Interactive export currently emits continuous histogram bins only.
        # Categorical stats use a different shape (label/count pairs) that the
        # bar_option_from_histogram path here doesn't model.
        stats = dataset_charts.titiler_statistics(
            collection_id, categorical=False, bins=bins_requested
        )
        hist = stats.get("histogram")
        if not isinstance(hist, list) or len(hist) != 2:
            raise ValueError(f"dataset {dataset_id!r} statistics missing histogram")
        counts, edges = hist[0], hist[1]
        if (
            not isinstance(counts, list)
            or not isinstance(edges, list)
            or len(edges) < len(counts) + 1
        ):
            raise ValueError(
                f"dataset {dataset_id!r} statistics returned malformed histogram"
            )
        return {
            "kind": "histogram_bins",
            "bins": [
                {
                    "bin_min": edges[i],
                    "bin_max": edges[i + 1],
                    "count": int(counts[i]),
                }
                for i in range(len(counts))
            ],
        }

    raise ValueError(f"unknown chart source kind: {kind!r}")
