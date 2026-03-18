"""STAC collection/item construction and ingestion via Transaction API."""

from datetime import datetime, timezone

import httpx
import rasterio
from rasterio.warp import transform_bounds

from src.config import get_settings


def get_cog_metadata(cog_path: str) -> dict:
    """Extract spatial metadata from a COG file.

    Bounds are always returned in EPSG:4326 (required by STAC).
    """
    with rasterio.open(cog_path) as src:
        if src.crs and str(src.crs) != "EPSG:4326":
            wgs84_bounds = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
        else:
            wgs84_bounds = (src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top)
        return {
            "bbox": list(wgs84_bounds),
            "width": src.width,
            "height": src.height,
            "crs": str(src.crs),
            "bands": src.count,
            "dtype": str(src.dtypes[0]),
            "nodata": src.nodata,
        }


def build_collection(dataset_id: str, filename: str, bbox: list[float]) -> dict:
    """Build a STAC collection for a single-file dataset."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "type": "Collection",
        "id": f"sandbox-{dataset_id}",
        "stac_version": "1.0.0",
        "description": f"User upload: {filename}",
        "links": [],
        "license": "proprietary",
        "extent": {
            "spatial": {"bbox": [bbox]},
            "temporal": {"interval": [[now, None]]},
        },
    }


def build_item(
    dataset_id: str,
    filename: str,
    s3_href: str,
    bbox: list[float],
    datetime_str: str | None = None,
) -> dict:
    """Build a STAC item for a converted COG."""
    if datetime_str is None:
        datetime_str = datetime.now(timezone.utc).isoformat()

    west, south, east, north = bbox
    geometry = {
        "type": "Polygon",
        "coordinates": [[
            [west, south], [east, south], [east, north], [west, north], [west, south],
        ]],
    }

    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": f"{dataset_id}-data",
        "collection": f"sandbox-{dataset_id}",
        "geometry": geometry,
        "bbox": bbox,
        "properties": {"datetime": datetime_str},
        "links": [],
        "assets": {
            "data": {
                "href": s3_href,
                "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                "roles": ["data"],
            }
        },
    }


def build_temporal_collection(
    dataset_id: str,
    filename: str,
    bbox: list[float],
    datetime_start: str,
    datetime_end: str,
) -> dict:
    """Build a STAC collection for a temporal dataset with full temporal extent."""
    return {
        "type": "Collection",
        "id": f"sandbox-{dataset_id}",
        "stac_version": "1.0.0",
        "description": f"Temporal upload: {filename}",
        "links": [],
        "license": "proprietary",
        "extent": {
            "spatial": {"bbox": [bbox]},
            "temporal": {"interval": [[datetime_start, datetime_end]]},
        },
    }


def build_temporal_item(
    dataset_id: str,
    index: int,
    s3_href: str,
    bbox: list[float],
    datetime_str: str,
) -> dict:
    """Build a STAC item for one timestep in a temporal dataset."""
    west, south, east, north = bbox
    geometry = {
        "type": "Polygon",
        "coordinates": [[
            [west, south], [east, south], [east, north], [west, north], [west, south],
        ]],
    }
    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": f"{dataset_id}-{index}",
        "collection": f"sandbox-{dataset_id}",
        "geometry": geometry,
        "bbox": bbox,
        "properties": {"datetime": datetime_str},
        "links": [],
        "assets": {
            "data": {
                "href": s3_href,
                "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                "roles": ["data"],
            }
        },
    }


async def ingest_temporal_raster(
    dataset_id: str,
    cog_paths: list[str],
    s3_hrefs: list[str],
    filename: str,
    bbox: list[float],
    datetimes: list[str],
) -> str:
    """Ingest a temporal stack: one collection + N items.

    Returns the tile URL template (without datetime parameter — caller appends it).
    """
    settings = get_settings()
    collection = build_temporal_collection(
        dataset_id, filename, bbox, datetimes[0], datetimes[-1],
    )

    async with httpx.AsyncClient(base_url=settings.stac_api_url, timeout=30.0) as client:
        resp = await client.post("/collections", json=collection)
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(f"Failed to create STAC collection: {resp.status_code} {resp.text}")

        collection_id = f"sandbox-{dataset_id}"
        for i, (s3_href, dt) in enumerate(zip(s3_hrefs, datetimes)):
            item = build_temporal_item(dataset_id, i, s3_href, bbox, dt)
            resp = await client.post(f"/collections/{collection_id}/items", json=item)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Failed to create STAC item {i}: {resp.status_code} {resp.text}")

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url


async def ingest_raster(dataset_id: str, cog_path: str, s3_href: str, filename: str) -> str:
    """Ingest a COG into eoAPI: create collection + item via Transaction API.

    Returns the tile URL template for the ingested item.
    """
    settings = get_settings()
    meta = get_cog_metadata(cog_path)

    collection = build_collection(dataset_id, filename, meta["bbox"])
    item = build_item(dataset_id, filename, s3_href, meta["bbox"])

    async with httpx.AsyncClient(base_url=settings.stac_api_url, timeout=30.0) as client:
        # Create collection (ignore 409 if already exists)
        resp = await client.post("/collections", json=collection)
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(f"Failed to create STAC collection: {resp.status_code} {resp.text}")

        # Create item
        collection_id = f"sandbox-{dataset_id}"
        resp = await client.post(f"/collections/{collection_id}/items", json=item)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Failed to create STAC item: {resp.status_code} {resp.text}")

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url
