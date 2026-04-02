"""Pipeline orchestrator for remote data connections (zero-copy and conversion)."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import tempfile
from datetime import UTC, datetime, timedelta

import httpx

from src.models import (
    Dataset,
    DatasetType,
    FormatPair,
    Job,
    JobStatus,
    Timestep,
    ValidationCheck,
)
from src.models.dataset import persist_dataset
from src.services import stac_ingest
from src.services.cog_checker import check_remote_is_cog
from src.services.detector import detect_format
from src.services.pipeline import (
    _extract_band_metadata,
    _extract_bounds,
    _extract_zoom_range_raster,
    _import_and_convert,
    get_credits,
)
from src.services.storage import StorageService
from src.services.temporal_ordering import common_filename_prefix, order_files
from src.services.temporal_validation import (
    compute_global_stats,
    validate_cross_file_compatibility,
)

logger = logging.getLogger(__name__)

MAX_CONVERT_BYTES = 16_106_127_360  # ~15 GB


async def read_remote_bounds(url: str) -> tuple[list[float], dict]:
    """Open a remote raster via /vsicurl/ and return (bbox, geojson_polygon)."""
    import rasterio
    from rasterio.warp import transform_bounds

    def _read(vsi_path: str) -> tuple[list[float], dict]:
        with rasterio.open(vsi_path) as src:
            if src.crs and str(src.crs) != "EPSG:4326":
                west, south, east, north = transform_bounds(
                    src.crs, "EPSG:4326", *src.bounds
                )
            else:
                b = src.bounds
                west, south, east, north = b.left, b.bottom, b.right, b.top

        bbox = [west, south, east, north]
        geometry = {
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
        return bbox, geometry

    return await asyncio.to_thread(_read, f"/vsicurl/{url}")


async def _estimate_total_size(
    urls: list[str], sample_count: int = 5
) -> int | None:
    """HEAD-request a sample of URLs and extrapolate total download size."""
    sample = urls[:sample_count]
    sizes: list[int] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for url in sample:
            try:
                resp = await client.head(url, follow_redirects=True)
                length = resp.headers.get("content-length")
                if length is not None:
                    sizes.append(int(length))
            except Exception:
                pass

    if not sizes:
        return None

    avg_size = sum(sizes) // len(sizes)
    return avg_size * len(urls)


async def run_remote_pipeline(
    job: Job,
    discovered_files: list[dict],
    mode: str,
    db_session_factory,
) -> None:
    """Execute the remote data connection pipeline.

    Checks whether the remote files are COGs. If so, performs zero-copy STAC
    ingestion. Otherwise, downloads, converts, and uploads to R2.
    """
    try:
        urls = [f["url"] for f in discovered_files]
        filenames = [f["filename"] for f in discovered_files]
        source_url = urls[0].rsplit("/", 1)[0] + "/" if urls else ""

        job.status = JobStatus.SCANNING
        job.progress_total = len(urls)
        job.progress_current = 0

        sample_url = urls[0]
        cog_result = await check_remote_is_cog(sample_url)

        if cog_result.is_cog:
            await _run_zero_copy(
                job, urls, filenames, source_url, mode, db_session_factory
            )
        else:
            estimated = await _estimate_total_size(urls)
            if estimated is not None and estimated > MAX_CONVERT_BYTES:
                job.status = JobStatus.FAILED
                job.error = (
                    f"Estimated download size ({estimated / 1e9:.1f} GB) exceeds "
                    f"the {MAX_CONVERT_BYTES / 1e9:.0f} GB limit for conversion."
                )
                return

            await _run_with_conversion(
                job, urls, filenames, source_url, mode, db_session_factory
            )

    except Exception as e:
        logger.exception("Remote pipeline failed for job %s", job.id)
        job.status = JobStatus.FAILED
        job.error = str(e)


async def _run_zero_copy(
    job: Job,
    urls: list[str],
    filenames: list[str],
    source_url: str,
    mode: str,
    db_session_factory,
) -> None:
    """Zero-copy path: files are already COGs, just register in STAC."""
    job.status = JobStatus.SCANNING
    job.progress_total = len(urls)

    bboxes: list[list[float]] = []
    geometries: list[dict] = []

    for i, url in enumerate(urls):
        bbox, geometry = await read_remote_bounds(url)
        bboxes.append(bbox)
        geometries.append(geometry)
        job.progress_current = i + 1

    datetimes: list[str] | None = None
    if mode == "temporal":
        ordered = order_files(filenames)
        reorder = {entry.filename: entry for entry in ordered}
        new_order = [reorder[fn].index for fn in filenames]

        sorted_indices = sorted(range(len(filenames)), key=lambda i: new_order[i])
        urls = [urls[i] for i in sorted_indices]
        filenames = [filenames[i] for i in sorted_indices]
        bboxes = [bboxes[i] for i in sorted_indices]
        geometries = [geometries[i] for i in sorted_indices]
        datetimes = [reorder[filenames[i]].datetime for i in range(len(filenames))]

    job.status = JobStatus.INGESTING

    tile_url = await stac_ingest.ingest_mosaic_raster(
        dataset_id=job.dataset_id,
        hrefs=urls,
        bboxes=bboxes,
        geometries=geometries,
        filename=common_filename_prefix(filenames),
        datetimes=datetimes,
    )

    import rasterio

    def _read_band_meta(vsi_path: str) -> tuple:
        with rasterio.open(vsi_path) as src:
            band_names = [
                desc if desc else f"Band {i + 1}"
                for i, desc in enumerate(src.descriptions)
            ]
            color_interp = [ci.name for ci in src.colorinterp]
            return src.count, band_names, color_interp, str(src.dtypes[0])

    band_count, band_names, color_interp, dtype = await asyncio.to_thread(
        _read_band_meta, f"/vsicurl/{urls[0]}"
    )

    job.status = JobStatus.READY

    timesteps = []
    if mode == "temporal" and datetimes:
        timesteps = [
            Timestep(datetime=dt, index=i) for i, dt in enumerate(datetimes)
        ]

    display_name = common_filename_prefix(filenames)
    overall_bbox = [
        min(b[0] for b in bboxes),
        min(b[1] for b in bboxes),
        max(b[2] for b in bboxes),
        max(b[3] for b in bboxes),
    ]

    dataset = Dataset(
        id=job.dataset_id,
        filename=display_name,
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
        is_mosaic=(mode == "mosaic"),
        is_temporal=(mode == "temporal"),
        timesteps=timesteps,
        source_url=source_url,
        created_at=job.created_at,
    )
    persist_dataset(db_session_factory, dataset)


async def _run_with_conversion(
    job: Job,
    urls: list[str],
    filenames: list[str],
    source_url: str,
    mode: str,
    db_session_factory,
) -> None:
    """Download, convert to COG, upload to R2, and register in STAC."""
    storage = StorageService()
    uploaded_keys: list[str] = []

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            job.status = JobStatus.CONVERTING
            job.progress_total = len(urls)

            cog_paths: list[str] = []

            for i, (url, filename) in enumerate(zip(urls, filenames, strict=False)):
                raw_path = os.path.join(tmpdir, f"raw_{i}_{filename}")

                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.get(url, follow_redirects=True)
                    resp.raise_for_status()
                    with open(raw_path, "wb") as f:
                        f.write(resp.content)

                format_pair = detect_format(filename)
                out_filename = os.path.splitext(filename)[0] + ".tif"
                output_path = os.path.join(tmpdir, f"cog_{i}_{out_filename}")

                await asyncio.to_thread(
                    _import_and_convert, format_pair, raw_path, output_path
                )

                os.unlink(raw_path)
                cog_paths.append(output_path)
                job.progress_current = i + 1

            if mode == "temporal":
                job.status = JobStatus.VALIDATING
                cross_errors = await asyncio.to_thread(
                    validate_cross_file_compatibility, cog_paths
                )
                if cross_errors:
                    job.status = JobStatus.FAILED
                    job.error = "; ".join(cross_errors)
                    return

            raster_min, raster_max = await asyncio.to_thread(
                compute_global_stats, cog_paths
            )

            first_cog = cog_paths[0]
            bounds = await asyncio.to_thread(
                _extract_bounds, first_cog, DatasetType.RASTER
            )
            band_meta = await asyncio.to_thread(_extract_band_metadata, first_cog)
            min_zoom, max_zoom = await asyncio.to_thread(
                _extract_zoom_range_raster, first_cog
            )

            job.status = JobStatus.INGESTING

            if mode == "temporal":
                ordered = order_files(filenames)
                sorted_indices = []
                fn_to_idx = {fn: i for i, fn in enumerate(filenames)}
                for entry in ordered:
                    sorted_indices.append(fn_to_idx[entry.filename])

                cog_paths = [cog_paths[i] for i in sorted_indices]
                filenames = [filenames[i] for i in sorted_indices]
                datetimes = [ordered[i].datetime for i in range(len(ordered))]

            s3_hrefs: list[str] = []
            converted_file_size = 0
            for i, cog_path in enumerate(cog_paths):
                cog_filename = os.path.basename(cog_path)
                if mode == "temporal":
                    key = f"datasets/{job.dataset_id}/timesteps/{i}/{cog_filename}"
                else:
                    key = f"datasets/{job.dataset_id}/mosaic/{i}/{cog_filename}"
                storage.upload_file(cog_path, key)
                uploaded_keys.append(key)
                s3_hrefs.append(storage.get_s3_uri(key))
                converted_file_size += os.path.getsize(cog_path)

            display_name = common_filename_prefix(filenames)

            if mode == "mosaic":
                bboxes: list[list[float]] = []
                geometries: list[dict] = []
                for cog_path in cog_paths:
                    bbox_i = await asyncio.to_thread(
                        _extract_bounds, cog_path, DatasetType.RASTER
                    )
                    west, south, east, north = bbox_i
                    geom_i = {
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
                    bboxes.append(bbox_i)
                    geometries.append(geom_i)

                tile_url = await stac_ingest.ingest_mosaic_raster(
                    dataset_id=job.dataset_id,
                    hrefs=s3_hrefs,
                    bboxes=bboxes,
                    geometries=geometries,
                    filename=display_name,
                )
            else:
                tile_url = await stac_ingest.ingest_temporal_raster(
                    dataset_id=job.dataset_id,
                    cog_paths=cog_paths,
                    s3_hrefs=s3_hrefs,
                    filename=display_name,
                    datetimes=datetimes,
                )

            job.status = JobStatus.READY

            timesteps = []
            if mode == "temporal":
                timesteps = [
                    Timestep(datetime=dt, index=i)
                    for i, dt in enumerate(datetimes)
                ]

            expires_at = datetime.now(UTC) + timedelta(days=30)

            dataset = Dataset(
                id=job.dataset_id,
                filename=display_name,
                dataset_type=DatasetType.RASTER,
                format_pair=FormatPair.GEOTIFF_TO_COG,
                tile_url=tile_url,
                bounds=bounds,
                band_count=band_meta.band_count,
                band_names=band_meta.band_names,
                color_interpretation=band_meta.color_interpretation,
                dtype=band_meta.dtype,
                converted_file_size=converted_file_size,
                min_zoom=min_zoom,
                max_zoom=max_zoom,
                stac_collection_id=f"sandbox-{job.dataset_id}",
                validation_results=[],
                credits=get_credits(FormatPair.GEOTIFF_TO_COG),
                workspace_id=job.workspace_id,
                is_zero_copy=False,
                is_mosaic=(mode == "mosaic"),
                is_temporal=(mode == "temporal"),
                timesteps=timesteps,
                source_url=source_url,
                raster_min=raster_min,
                raster_max=raster_max,
                expires_at=expires_at,
                created_at=job.created_at,
            )
            persist_dataset(db_session_factory, dataset)

    except Exception:
        _cleanup_uploaded(storage, uploaded_keys)
        raise


def _cleanup_uploaded(storage: StorageService, keys: list[str]) -> None:
    """Best-effort removal of already-uploaded S3 objects."""
    for key in keys:
        with contextlib.suppress(Exception):
            storage.delete_object(key)
