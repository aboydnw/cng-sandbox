"""Chart-shaped data endpoints for datasets."""

import os
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from src.dependencies import get_session
from src.models.dataset import DatasetRow

router = APIRouter(prefix="/api")

RASTER_TILER_URL = os.environ.get("RASTER_TILER_URL", "http://raster-tiler:80")


def _load_dataset(session, dataset_id: str, workspace_id: str | None) -> dict:
    """Load a dataset row and return its dict representation."""
    try:
        row = session.query(DatasetRow).filter_by(id=dataset_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="dataset not found")
        if row.workspace_id and row.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="dataset not found")
        return row.to_dict()
    finally:
        session.close()


def _titiler_point(collection_id: str, datetime_iso: str, lon: float, lat: float) -> float | None:
    """Query titiler-pgstac for the pixel value at a point for a given datetime."""
    url = f"{RASTER_TILER_URL}/collections/{collection_id}/point/{lon},{lat}"
    params = {"datetime": datetime_iso}
    with httpx.Client(timeout=20.0) as http_client:
        resp = http_client.get(url, params=params)
    if resp.status_code != 200:
        return None
    body = resp.json()
    values = body.get("values") or []
    if not values:
        return None
    first = values[0]
    if isinstance(first, list):
        return float(first[0]) if first else None
    return float(first)


@lru_cache(maxsize=256)
def _cached_timeseries(
    dataset_id: str,
    collection_id: str,
    lon: float,
    lat: float,
    datetimes: tuple,
) -> tuple:
    """Fetch pixel values for all timesteps, cached by location and dataset."""
    out = []
    for dt in datetimes:
        out.append((dt, _titiler_point(collection_id, dt, lon, lat)))
    return tuple(out)


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
    ds = _load_dataset(session, dataset_id, workspace_id)
    if not ds.get("is_temporal"):
        raise HTTPException(status_code=400, detail="dataset is not temporal")
    timesteps = ds.get("timesteps") or []
    if not timesteps:
        raise HTTPException(status_code=400, detail="dataset has no timesteps")
    collection_id = ds.get("stac_collection_id") or dataset_id
    datetimes = tuple(ts["datetime"] for ts in timesteps)
    pairs = _cached_timeseries(dataset_id, collection_id, lon, lat, datetimes)
    return [{"datetime": dt, "value": value} for dt, value in pairs]
