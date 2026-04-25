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
from datetime import UTC, datetime

import numpy as np
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


def _compute_remote_stats_sync(
    hrefs: list[str], max_samples: int = 5
) -> tuple[float | None, float | None]:
    """Compute p2/p98 rescale values from a sample of remote COGs.

    Samples files evenly spread across the list (first, last, and evenly
    spaced in between) to get representative statistics without reading
    every file. Uses the coarsest overview for minimal data transfer.
    """
    if not hrefs:
        return None, None

    # Pick evenly-spaced sample indices
    n = len(hrefs)
    if n <= max_samples:
        indices = list(range(n))
    else:
        indices = [round(i * (n - 1) / (max_samples - 1)) for i in range(max_samples)]

    all_valid: list[np.ndarray] = []
    for idx in indices:
        vsi_path = f"/vsicurl/{hrefs[idx]}"
        try:
            with rasterio.open(vsi_path) as src:
                for band_idx in range(1, src.count + 1):
                    overviews = src.overviews(band_idx)
                    if overviews:
                        level = overviews[-1]
                        out_shape = (
                            max(1, src.height // level),
                            max(1, src.width // level),
                        )
                    else:
                        downsample = max(1.0, max(src.height, src.width) / 1024)
                        out_shape = (
                            max(1, int(src.height / downsample)),
                            max(1, int(src.width / downsample)),
                        )
                    data = src.read(band_idx, out_shape=out_shape).astype(np.float64)
                    if src.nodata is not None:
                        valid = data[data != src.nodata]
                    else:
                        valid = data.ravel()
                    valid = valid[~np.isnan(valid)]
                    if valid.size > 0:
                        all_valid.append(valid)
        except Exception:
            safe_path = vsi_path.split("?", 1)[0]
            logger.warning("Failed to read stats from %s, skipping", safe_path)
            continue

    if not all_valid:
        return None, None

    combined = np.concatenate(all_valid)
    p2, p98 = np.percentile(combined, [2, 98])
    return float(p2), float(p98)


async def _compute_remote_stats(
    hrefs: list[str], max_samples: int = 5
) -> tuple[float | None, float | None]:
    return await asyncio.to_thread(_compute_remote_stats_sync, hrefs, max_samples)


def _format_datetime_z(dt: datetime) -> str:
    """Format a datetime as ISO 8601 with a `Z` suffix for UTC.

    Avoids `+00:00` because `+` in a query string URL-decodes to a space,
    which breaks titiler-pgstac's datetime filter when the frontend passes
    the value through the tile URL without percent-encoding.
    """
    if dt.tzinfo is not None:
        dt = dt.astimezone(UTC).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


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
    is_example: bool = False,
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
        [_format_datetime_z(it.datetime) for it in enriched]  # type: ignore[arg-type]
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
    raster_min, raster_max = await _compute_remote_stats(hrefs)

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
        raster_min=raster_min,
        raster_max=raster_max,
        validation_results=[],
        credits=get_credits(FormatPair.GEOTIFF_TO_COG),
        workspace_id=None if is_example else job.workspace_id,
        is_zero_copy=True,
        is_example=is_example,
        is_mosaic=not product.is_temporal,
        is_temporal=product.is_temporal,
        timesteps=timesteps,
        source_url=product.listing_url,
        created_at=job.created_at,
        preferred_colormap=product.preferred_colormap,
        preferred_colormap_reversed=product.preferred_colormap_reversed,
    )
    persist_dataset(db_session_factory, dataset)

    return dataset.id
