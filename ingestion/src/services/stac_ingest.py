"""STAC collection/item construction and ingestion via Transaction API."""

from datetime import UTC, datetime

import httpx
import pystac
from geojson_pydantic import Polygon as GeoJsonPolygon
from rio_stac import create_stac_item

from src.config import get_settings

COG_MEDIA_TYPE = "image/tiff; application=geotiff; profile=cloud-optimized"


def build_stac_item(
    cog_path: str,
    dataset_id: str,
    collection_id: str,
    item_id: str,
    s3_href: str,
    input_datetime: datetime | None = None,
) -> pystac.Item:
    """Build a validated STAC item from a COG file using rio-stac."""
    item = create_stac_item(
        source=cog_path,
        id=item_id,
        collection=collection_id,
        asset_name="data",
        asset_href=s3_href,
        asset_media_type=COG_MEDIA_TYPE,
        asset_roles=["data"],
        input_datetime=input_datetime or datetime.now(UTC),
    )
    GeoJsonPolygon.model_validate(item.geometry)
    return item


def build_stac_collection(
    collection_id: str,
    description: str,
    item: pystac.Item | None = None,
    bbox: list[float] | None = None,
    temporal_start: str | None = None,
    temporal_end: str | None = None,
) -> pystac.Collection:
    """Build a validated STAC collection.

    For single-file datasets, pass `item` to derive extent from it.
    For temporal datasets, pass `bbox`, `temporal_start`, `temporal_end` explicitly.
    """
    if item is not None:
        spatial_bbox = list(item.bbox)
        dt = item.datetime or datetime.now(UTC)
        interval = [[dt, None]]
    else:
        spatial_bbox = bbox
        start = datetime.fromisoformat(temporal_start) if temporal_start else None
        end = datetime.fromisoformat(temporal_end) if temporal_end else None
        interval = [[start, end]]

    collection = pystac.Collection(
        id=collection_id,
        description=description,
        extent=pystac.Extent(
            spatial=pystac.SpatialExtent(bboxes=[spatial_bbox]),
            temporal=pystac.TemporalExtent(intervals=interval),
        ),
        license="proprietary",
    )
    return collection


async def ingest_raster(
    dataset_id: str, cog_path: str, s3_href: str, filename: str
) -> str:
    """Ingest a COG into eoAPI: create collection + item via Transaction API.

    Returns the tile URL template for the ingested item.
    """
    settings = get_settings()
    collection_id = f"sandbox-{dataset_id}"

    item = build_stac_item(
        cog_path=cog_path,
        dataset_id=dataset_id,
        collection_id=collection_id,
        item_id=f"{dataset_id}-data",
        s3_href=s3_href,
    )
    collection = build_stac_collection(
        collection_id=collection_id,
        description=f"User upload: {filename}",
        item=item,
    )

    async with httpx.AsyncClient(
        base_url=settings.stac_api_url, timeout=30.0
    ) as client:
        resp = await client.post("/collections", json=collection.to_dict())
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(
                f"Failed to create STAC collection: {resp.status_code} {resp.text}"
            )

        resp = await client.post(
            f"/collections/{collection_id}/items", json=item.to_dict()
        )
        if resp.status_code not in (200, 201):
            raise RuntimeError(
                f"Failed to create STAC item: {resp.status_code} {resp.text}"
            )

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url


def build_stac_item_from_href(
    href: str,
    dataset_id: str,
    collection_id: str,
    item_id: str,
    bbox: list[float],
    geometry: dict,
    input_datetime: datetime | None = None,
) -> pystac.Item:
    """Build a STAC item from a remote href without reading the file."""
    item = pystac.Item(
        id=item_id,
        geometry=geometry,
        bbox=bbox,
        datetime=input_datetime or datetime.now(UTC),
        properties={},
    )
    item.add_asset(
        "data",
        pystac.Asset(href=href, media_type=COG_MEDIA_TYPE, roles=["data"]),
    )
    item.collection_id = collection_id
    return item


async def ingest_mosaic_raster(
    dataset_id: str,
    hrefs: list[str],
    bboxes: list[list[float]],
    geometries: list[dict],
    filename: str,
    datetimes: list[str] | None = None,
) -> str:
    """Ingest a mosaic: one collection + N items with distinct spatial extents.

    Returns the tile URL template for the ingested collection.
    """
    settings = get_settings()
    collection_id = f"sandbox-{dataset_id}"

    items: list[pystac.Item] = []
    for i, (href, bbox, geometry) in enumerate(
        zip(hrefs, bboxes, geometries, strict=False)
    ):
        dt = datetime.fromisoformat(datetimes[i]) if datetimes else None
        item = build_stac_item_from_href(
            href=href,
            dataset_id=dataset_id,
            collection_id=collection_id,
            item_id=f"{dataset_id}-{i}",
            bbox=bbox,
            geometry=geometry,
            input_datetime=dt,
        )
        items.append(item)

    overall_bbox = [
        min(b[0] for b in bboxes),
        min(b[1] for b in bboxes),
        max(b[2] for b in bboxes),
        max(b[3] for b in bboxes),
    ]
    collection = build_stac_collection(
        collection_id=collection_id,
        description=f"Mosaic upload: {filename}",
        bbox=overall_bbox,
        temporal_start=datetimes[0] if datetimes else None,
        temporal_end=datetimes[-1] if datetimes else None,
    )

    async with httpx.AsyncClient(
        base_url=settings.stac_api_url, timeout=60.0
    ) as client:
        resp = await client.post("/collections", json=collection.to_dict())
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(
                f"Failed to create STAC collection: {resp.status_code} {resp.text}"
            )

        for i, item in enumerate(items):
            resp = await client.post(
                f"/collections/{collection_id}/items", json=item.to_dict()
            )
            if resp.status_code not in (200, 201):
                raise RuntimeError(
                    f"Failed to create STAC item {i}: {resp.status_code} {resp.text}"
                )

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url


async def ingest_temporal_raster(
    dataset_id: str,
    cog_paths: list[str],
    s3_hrefs: list[str],
    filename: str,
    datetimes: list[str],
) -> str:
    """Ingest a temporal stack: one collection + N items.

    Returns the tile URL template (without datetime parameter -- caller appends it).
    """
    settings = get_settings()
    collection_id = f"sandbox-{dataset_id}"

    items: list[pystac.Item] = []
    for i, (cog_path, s3_href, dt) in enumerate(
        zip(cog_paths, s3_hrefs, datetimes, strict=False)
    ):
        item = build_stac_item(
            cog_path=cog_path,
            dataset_id=dataset_id,
            collection_id=collection_id,
            item_id=f"{dataset_id}-{i}",
            s3_href=s3_href,
            input_datetime=datetime.fromisoformat(dt),
        )
        items.append(item)

    collection = build_stac_collection(
        collection_id=collection_id,
        description=f"Temporal upload: {filename}",
        bbox=list(items[0].bbox),
        temporal_start=datetimes[0],
        temporal_end=datetimes[-1],
    )

    async with httpx.AsyncClient(
        base_url=settings.stac_api_url, timeout=30.0
    ) as client:
        resp = await client.post("/collections", json=collection.to_dict())
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(
                f"Failed to create STAC collection: {resp.status_code} {resp.text}"
            )

        for i, item in enumerate(items):
            resp = await client.post(
                f"/collections/{collection_id}/items", json=item.to_dict()
            )
            if resp.status_code not in (200, 201):
                raise RuntimeError(
                    f"Failed to create STAC item {i}: {resp.status_code} {resp.text}"
                )

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url
