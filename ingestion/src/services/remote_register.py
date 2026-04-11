"""Register a source.coop directory as a zero-copy STAC collection.

Given enumerator output and product metadata, this service:
    1. Probes missing bounds via /vsicurl/.
    2. Orders items by datetime if the product is temporal.
    3. Writes a pgSTAC collection + items.
    4. Persists a Dataset row with is_zero_copy=True.

Mirrors the logic of remote_pipeline._run_zero_copy, but is driven by a
pre-built list of RemoteItems instead of discovery output.
"""

from __future__ import annotations

import asyncio
import logging

import rasterio

from src.models import Dataset, DatasetType, FormatPair, Job, Timestep
from src.models.dataset import persist_dataset
from src.services import stac_ingest
from src.services.enumerators import RemoteItem
from src.services.pipeline import get_credits
from src.services.remote_pipeline import read_remote_bounds
from src.services.source_coop_config import SourceCoopProduct

logger = logging.getLogger(__name__)


class RemoteRegistrationError(Exception):
    pass


def _read_band_meta_sync(vsi_path: str) -> tuple[int, list[str], list[str], str]:
    with rasterio.open(vsi_path) as src:
        band_names = [
            desc if desc else f"Band {i + 1}" for i, desc in enumerate(src.descriptions)
        ]
        color_interp = [ci.name for ci in src.colorinterp]
        return src.count, band_names, color_interp, str(src.dtypes[0])


async def _read_band_meta(href: str) -> tuple[int, list[str], list[str], str]:
    return await asyncio.to_thread(_read_band_meta_sync, f"/vsicurl/{href}")


def _bbox_to_polygon(bbox: list[float]) -> dict:
    west, south, east, north = bbox
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ]
        ],
    }


async def register_remote_collection(
    job: Job,
    product: SourceCoopProduct,
    items: list[RemoteItem],
    db_session_factory,
) -> str:
    """Register a list of RemoteItems as a sandbox dataset.

    Returns the new dataset ID.
    """
    if not items:
        raise RemoteRegistrationError(
            f"Enumerator returned no items for {product.slug}"
        )

    enriched: list[RemoteItem] = []
    for item in items:
        if item.bbox is None:
            bbox, _geom = await read_remote_bounds(item.href)
            enriched.append(
                RemoteItem(href=item.href, datetime=item.datetime, bbox=bbox)
            )
        else:
            enriched.append(item)

    if product.is_temporal:
        missing_dt = [i for i in enriched if i.datetime is None]
        if missing_dt:
            raise RemoteRegistrationError(
                f"Product {product.slug} is marked temporal but "
                f"{len(missing_dt)} items have no datetime"
            )
        enriched.sort(key=lambda it: it.datetime)  # type: ignore[arg-type,return-value]

    hrefs = [it.href for it in enriched]
    bboxes = [it.bbox for it in enriched]
    geometries = [_bbox_to_polygon(it.bbox) for it in enriched]  # type: ignore[arg-type]
    datetimes = (
        [it.datetime.isoformat() for it in enriched]  # type: ignore[union-attr]
        if product.is_temporal
        else None
    )

    tile_url = await stac_ingest.ingest_mosaic_raster(
        dataset_id=job.dataset_id,
        hrefs=hrefs,
        bboxes=bboxes,  # type: ignore[arg-type]
        geometries=geometries,
        filename=product.name,
        datetimes=datetimes,
    )

    band_count, band_names, color_interp, dtype = await _read_band_meta(hrefs[0])

    overall_bbox = [
        min(b[0] for b in bboxes),  # type: ignore[index]
        min(b[1] for b in bboxes),  # type: ignore[index]
        max(b[2] for b in bboxes),  # type: ignore[index]
        max(b[3] for b in bboxes),  # type: ignore[index]
    ]

    timesteps: list[Timestep] = []
    if product.is_temporal and datetimes:
        timesteps = [Timestep(datetime=dt, index=i) for i, dt in enumerate(datetimes)]

    dataset = Dataset(
        id=job.dataset_id,
        filename=product.name,
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url=tile_url,
        bounds=overall_bbox,
        band_count=band_count,
        band_names=band_names,
        color_interpretation=color_interp,
        dtype=dtype,
        stac_collection_id=f"sandbox-{job.dataset_id}",
        validation_results=[],
        credits=get_credits(FormatPair.GEOTIFF_TO_COG),
        workspace_id=job.workspace_id,
        is_zero_copy=True,
        is_mosaic=not product.is_temporal,
        is_temporal=product.is_temporal,
        timesteps=timesteps,
        source_url=product.listing_url,
        created_at=job.created_at,
    )
    persist_dataset(db_session_factory, dataset)

    return dataset.id
