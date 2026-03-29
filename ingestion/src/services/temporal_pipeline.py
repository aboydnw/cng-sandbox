"""Pipeline orchestrator for temporal (multi-file) raster uploads."""

import asyncio
import contextlib
import logging
import os
import tempfile

from src.models import (
    Dataset,
    DatasetType,
    FormatPair,
    Job,
    JobStatus,
    Timestep,
    ValidationCheck,
)
from src.services import stac_ingest
from src.services.detector import detect_format, validate_magic_bytes
from src.services.pipeline import (
    _extract_band_metadata,
    _extract_bounds,
    _extract_zoom_range_raster,
    _import_and_convert,
    _import_and_validate,
    get_credits,
)
from src.services.storage import StorageService
from src.services.temporal_ordering import common_filename_prefix, order_files
from src.services.temporal_validation import (
    compute_global_stats,
    validate_cross_file_compatibility,
)

logger = logging.getLogger(__name__)


async def run_temporal_pipeline(
    job: Job,
    input_paths: list[str],
    filenames: list[str],
    db_session_factory,
) -> None:
    """Execute the temporal conversion pipeline for multiple raster files.

    Processes N files through scan/convert/validate, then runs cross-file
    validation, computes global stats, and ingests as a temporal STAC
    collection. Updates job status in-place.
    """
    storage = StorageService()
    uploaded_keys: list[str] = []

    try:
        # Stage 1: Temporal ordering
        job.status = JobStatus.SCANNING
        ordered = order_files(filenames)
        job.progress_total = len(ordered)

        # Build a filename-to-input-path lookup
        path_by_filename = dict(zip(filenames, input_paths, strict=False))

        with tempfile.TemporaryDirectory() as tmpdir:
            cog_paths: list[str] = []
            last_validation_results: list[ValidationCheck] = []
            format_pair: FormatPair | None = None
            original_file_size = 0

            # Stage 2: Per-file scan -> convert -> validate
            for entry in ordered:
                job.progress_current = entry.index + 1
                input_path = path_by_filename[entry.filename]

                # Scan
                job.status = JobStatus.SCANNING
                fp = detect_format(entry.filename)
                validate_magic_bytes(input_path, fp)

                if fp.dataset_type != DatasetType.RASTER:
                    job.status = JobStatus.FAILED
                    job.error = (
                        f"Temporal pipelines only support raster files, got {fp.value}"
                    )
                    return

                if format_pair is None:
                    format_pair = fp
                    job.format_pair = format_pair

                original_file_size += os.path.getsize(input_path)

                # Upload raw
                raw_key = storage.upload_raw(input_path, job.dataset_id, entry.filename)
                uploaded_keys.append(raw_key)

                # Convert
                job.status = JobStatus.CONVERTING
                out_filename = os.path.splitext(entry.filename)[0] + ".tif"
                output_path = os.path.join(tmpdir, out_filename)
                await asyncio.to_thread(
                    _import_and_convert, fp, input_path, output_path
                )
                cog_paths.append(output_path)

                # Validate
                job.status = JobStatus.VALIDATING
                check_results = await asyncio.to_thread(
                    _import_and_validate, fp, input_path, output_path
                )
                last_validation_results = [
                    ValidationCheck(name=c.name, passed=c.passed, detail=c.detail)
                    for c in check_results
                ]
                job.validation_results = last_validation_results

                failed = [c for c in check_results if not c.passed]
                if failed:
                    details = "; ".join(f"{c.name}: {c.detail}" for c in failed)
                    logger.warning(
                        "Validation failed for %s: %s", entry.filename, details
                    )
                    job.status = JobStatus.FAILED
                    job.error = f"Validation failed for {entry.filename}: {details}"
                    _cleanup_uploaded(storage, uploaded_keys)
                    return

            # Stage 3: Cross-file validation
            job.status = JobStatus.VALIDATING
            cross_errors = await asyncio.to_thread(
                validate_cross_file_compatibility, cog_paths
            )
            if cross_errors:
                job.status = JobStatus.FAILED
                job.error = "; ".join(cross_errors)
                _cleanup_uploaded(storage, uploaded_keys)
                return

            # Stage 4: Compute global stats
            raster_min, raster_max = await asyncio.to_thread(
                compute_global_stats, cog_paths
            )

            # Stage 5: Extract metadata from first COG
            first_cog = cog_paths[0]
            bounds = await asyncio.to_thread(
                _extract_bounds, first_cog, DatasetType.RASTER
            )
            band_meta = await asyncio.to_thread(_extract_band_metadata, first_cog)
            min_zoom, max_zoom = await asyncio.to_thread(
                _extract_zoom_range_raster, first_cog
            )

            # Stage 6: Ingest
            job.status = JobStatus.INGESTING

            s3_hrefs: list[str] = []
            converted_file_size = 0
            for i, (_entry, cog_path) in enumerate(
                zip(ordered, cog_paths, strict=False)
            ):
                cog_filename = os.path.basename(cog_path)
                key = f"datasets/{job.dataset_id}/timesteps/{i}/{cog_filename}"
                storage.upload_file(cog_path, key)
                uploaded_keys.append(key)
                s3_hrefs.append(storage.get_s3_uri(key))
                converted_file_size += os.path.getsize(cog_path)

            datetimes = [entry.datetime for entry in ordered]
            display_name = common_filename_prefix(filenames)

            tile_url = await stac_ingest.ingest_temporal_raster(
                dataset_id=job.dataset_id,
                cog_paths=cog_paths,
                s3_hrefs=s3_hrefs,
                filename=display_name,
                datetimes=datetimes,
            )

            # Stage 7: Build Dataset
            job.status = JobStatus.READY

            timesteps = [
                Timestep(datetime=entry.datetime, index=entry.index)
                for entry in ordered
            ]

            dataset = Dataset(
                id=job.dataset_id,
                filename=display_name,
                dataset_type=DatasetType.RASTER,
                format_pair=format_pair,
                tile_url=tile_url,
                bounds=bounds,
                band_count=band_meta.band_count,
                band_names=band_meta.band_names,
                color_interpretation=band_meta.color_interpretation,
                dtype=band_meta.dtype,
                original_file_size=original_file_size,
                converted_file_size=converted_file_size,
                min_zoom=min_zoom,
                max_zoom=max_zoom,
                stac_collection_id=f"sandbox-{job.dataset_id}",
                validation_results=last_validation_results,
                credits=get_credits(format_pair),
                workspace_id=job.workspace_id,
                is_temporal=True,
                timesteps=timesteps,
                raster_min=raster_min,
                raster_max=raster_max,
                created_at=job.created_at,
            )
            from src.models.dataset import persist_dataset

            persist_dataset(db_session_factory, dataset)

    except Exception as e:
        logger.exception("Temporal pipeline failed for job %s", job.id)
        job.status = JobStatus.FAILED
        job.error = str(e)
        _cleanup_uploaded(storage, uploaded_keys)


def _cleanup_uploaded(storage: StorageService, keys: list[str]) -> None:
    """Best-effort removal of already-uploaded S3 objects."""
    for key in keys:
        with contextlib.suppress(Exception):
            storage.delete_object(key)
