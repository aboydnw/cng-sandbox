"""Chart-shaped data endpoints for datasets."""

import logging
import os
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from src.dependencies import get_session
from src.models.dataset import DatasetRow
from src.services import sharing

router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)

RASTER_TILER_URL = os.environ.get("RASTER_TILER_URL", "http://raster-tiler:80")


def _load_dataset(session, dataset_id: str, workspace_id: str | None) -> dict:
    """Load a dataset row and return its dict representation."""
    row = session.query(DatasetRow).filter_by(id=dataset_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="dataset not found")
    if not sharing.can_read_dataset(session, row, workspace_id or ""):
        raise HTTPException(status_code=404, detail="dataset not found")
    return row.to_dict()


def _titiler_point(collection_id: str, datetime_iso: str, lon: float, lat: float) -> float | None:
    """Query titiler-pgstac for the pixel value at a point for a given datetime."""
    url = f"{RASTER_TILER_URL}/collections/{collection_id}/point/{lon},{lat}"
    params = {"datetime": datetime_iso}
    with httpx.Client(timeout=20.0) as http_client:
        resp = http_client.get(url, params=params)
    if resp.status_code != 200:
        logger.warning("titiler /point %s returned %s: %s", url, resp.status_code, resp.text[:200])
        return None
    body = resp.json()
    values = body.get("values") or []
    if not values:
        return None
    first = values[0]
    if isinstance(first, list):
        return float(first[0]) if first else None
    return float(first)


def _build_timeseries(
    dataset_id: str,
    collection_id: str,
    lon: float,
    lat: float,
    datetimes: tuple,
) -> tuple:
    """Fetch pixel values for all timesteps without caching."""
    return tuple((dt, _titiler_point(collection_id, dt, lon, lat)) for dt in datetimes)


class _PartialTimeseriesError(Exception):
    def __init__(self, pairs):
        self.pairs = pairs


@lru_cache(maxsize=256)
def _cached_complete_timeseries(
    dataset_id: str,
    collection_id: str,
    lon: float,
    lat: float,
    datetimes: tuple,
) -> tuple:
    """Fetch and cache pixel values; raises _PartialTimeseriesError if any value is None."""
    pairs = _build_timeseries(dataset_id, collection_id, lon, lat, datetimes)
    if any(value is None for _, value in pairs):
        raise _PartialTimeseriesError(pairs)
    return pairs


def _cached_timeseries(
    dataset_id: str,
    collection_id: str,
    lon: float,
    lat: float,
    datetimes: tuple,
) -> tuple:
    """Return timeseries pairs; caches only complete (no-None) results."""
    try:
        return _cached_complete_timeseries(dataset_id, collection_id, lon, lat, datetimes)
    except _PartialTimeseriesError as exc:
        return exc.pairs


@router.get("/datasets/{dataset_id}/timeseries")
def dataset_timeseries(
    dataset_id: str,
    request: Request,
    lon: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
):
    """Return per-timestep pixel values for a temporal dataset at a given point."""
    workspace_id = request.headers.get("x-workspace-id", "") or None
    session = get_session(request)
    try:
        ds = _load_dataset(session, dataset_id, workspace_id)
    finally:
        session.close()
    if not ds.get("is_temporal"):
        raise HTTPException(status_code=400, detail="dataset is not temporal")
    timesteps = ds.get("timesteps") or []
    if not timesteps:
        raise HTTPException(status_code=400, detail="dataset has no timesteps")
    collection_id = ds.get("stac_collection_id") or dataset_id
    datetimes = tuple(ts["datetime"] for ts in timesteps)
    pairs = _cached_timeseries(dataset_id, collection_id, lon, lat, datetimes)
    return [{"datetime": dt, "value": value} for dt, value in pairs]


def _titiler_statistics(collection_id: str, *, categorical: bool, bins: int) -> dict:
    """Query titiler-pgstac /statistics."""
    url = f"{RASTER_TILER_URL}/collections/{collection_id}/statistics"
    params: dict[str, str | int] = {}
    if categorical:
        params["categorical"] = "true"
    else:
        params["histogram_bins"] = bins
    with httpx.Client(timeout=30.0) as http:
        resp = http.get(url, params=params)
    if resp.status_code != 200:
        logger.warning("titiler /statistics %s returned %s: %s", url, resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="titiler statistics failed")
    return resp.json()


@router.get("/datasets/{dataset_id}/histogram")
def dataset_histogram(
    dataset_id: str,
    request: Request,
    bins: int = Query(20, ge=2, le=100),
):
    """Return histogram data for a dataset — bins for continuous, class counts for categorical."""
    workspace_id = request.headers.get("x-workspace-id", "") or None
    session = get_session(request)
    try:
        ds = _load_dataset(session, dataset_id, workspace_id)
    finally:
        session.close()
    collection_id = ds.get("stac_collection_id") or dataset_id

    if ds.get("is_categorical"):
        stats = _titiler_statistics(collection_id, categorical=True, bins=bins)
        cats = stats.get("categorical") or {}
        labels = {
            int(c["value"]): c.get("label") or str(c["value"])
            for c in (ds.get("categories") or [])
        }
        out = []
        for value_str, count in cats.items():
            value = int(value_str)
            out.append(
                {
                    "class": value,
                    "label": labels.get(value, str(value)),
                    "count": int(count),
                }
            )
        out.sort(key=lambda r: r["class"])
        return out

    stats = _titiler_statistics(collection_id, categorical=False, bins=bins)
    hist = stats.get("histogram") or []
    if len(hist) != 2:
        raise HTTPException(status_code=502, detail="titiler returned unexpected histogram shape")
    counts, edges = hist[0], hist[1]
    out = []
    for i, count in enumerate(counts):
        bin_min = edges[i] if i < len(edges) else edges[-1]
        bin_max = edges[i + 1] if (i + 1) < len(edges) else edges[-1]
        out.append({"bin_min": bin_min, "bin_max": bin_max, "count": int(count)})
    return out
