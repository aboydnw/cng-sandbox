"""Point-cloud pipeline: scan LAS/LAZ -> PDAL COPC -> validate -> store."""

import asyncio
import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass

import laspy

from src.models import (
    Dataset,
    DatasetType,
    FormatPair,
    Job,
    JobStatus,
    StageProgress,
    ValidationCheck,
)
from src.services.error_mapping import map_pipeline_error
from src.services.pointcloud_geo import wgs84_bounds
from src.services.storage import StorageService

logger = logging.getLogger(__name__)

_NO_CRS_ERROR = (
    "This point cloud has no coordinate reference system. "
    "Re-export it with a CRS and try again."
)


@dataclass
class LasScan:
    point_count: int
    native_bounds: list[float]
    crs: str | None
    crs_wkt: str | None


def scan_las_header(path: str) -> LasScan:
    """Read a LAS/LAZ header + VLRs for point count, native bounds, and CRS."""
    with laspy.open(path) as reader:
        header = reader.header
        crs = header.parse_crs()
        epsg = crs.to_epsg() if crs else None
        return LasScan(
            point_count=header.point_count,
            native_bounds=[header.x_min, header.y_min, header.x_max, header.y_max],
            crs=(f"EPSG:{epsg}" if epsg else crs.name) if crs else None,
            crs_wkt=crs.to_wkt() if crs else None,
        )


def convert_las_to_copc(input_path: str, output_path: str) -> None:
    """Convert LAS/LAZ to COPC using PDAL's writers.copc."""
    result = subprocess.run(
        ["pdal", "translate", input_path, output_path, "--writers.copc.forward=all"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"pdal translate failed: {result.stderr}")


async def run_pointcloud_pipeline(
    job: Job, input_path: str, db_session_factory
) -> None:
    """Scan LAS/LAZ, convert to COPC, validate, store to R2, and persist a dataset.

    Updates job.status in place; sets FAILED + job.error on any error and never
    raises. Point clouds are streamed directly from object storage by the
    browser, so there is no pgSTAC/tipg registration step.
    """
    storage = StorageService()

    try:
        job.status = JobStatus.SCANNING
        job.stage_progress = None
        job.format_pair = FormatPair.LAS_TO_COPC

        scan = await asyncio.to_thread(scan_las_header, input_path)
        if scan.crs is None:
            job.status = JobStatus.FAILED
            job.error = _NO_CRS_ERROR
            return

        original_file_size = os.path.getsize(input_path)
        await asyncio.to_thread(
            storage.upload_raw, input_path, job.dataset_id, job.filename
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            out_filename = os.path.splitext(job.filename)[0] + ".copc.laz"
            output_path = os.path.join(tmpdir, out_filename)

            job.status = JobStatus.CONVERTING
            job.stage_progress = None
            await asyncio.to_thread(convert_las_to_copc, input_path, output_path)

            job.status = JobStatus.VALIDATING
            from las_to_copc import run_checks

            check_results = await asyncio.to_thread(run_checks, input_path, output_path)
            job.validation_results = [
                ValidationCheck(name=c.name, passed=c.passed, detail=c.detail)
                for c in check_results
            ]
            failed = [c for c in check_results if not c.passed]
            if failed:
                details = "; ".join(f"{c.name}: {c.detail}" for c in failed)
                logger.warning("COPC validation failed: %s", details)
                job.status = JobStatus.FAILED
                job.error = f"Validation failed: {details}"
                return

            converted_file_size = os.path.getsize(output_path)

            job.status = JobStatus.INGESTING
            job.stage_progress = StageProgress(detail="storing")
            converted_key = await asyncio.to_thread(
                storage.upload_copc, output_path, job.dataset_id
            )

        copc_url = f"/storage/{converted_key}"
        bounds = wgs84_bounds(scan.native_bounds, scan.crs_wkt or scan.crs)

        job.status = JobStatus.READY
        job.stage_progress = None

        dataset = Dataset(
            id=job.dataset_id,
            filename=job.filename,
            dataset_type=DatasetType.POINTCLOUD,
            format_pair=FormatPair.LAS_TO_COPC,
            tile_url=copc_url,
            bounds=bounds,
            copc_url=copc_url,
            point_count=scan.point_count,
            crs=scan.crs,
            original_file_size=original_file_size,
            converted_file_size=converted_file_size,
            validation_results=job.validation_results,
            credits=_credits(),
            workspace_id=job.workspace_id,
            created_at=job.created_at,
        )
        from src.models.dataset import persist_dataset

        persist_dataset(db_session_factory, dataset)

    except Exception as e:
        logger.exception("Point-cloud pipeline failed for job %s", job.id)
        job.status = JobStatus.FAILED
        job.error = map_pipeline_error(e)


def _credits() -> list[dict]:
    from src.services.pipeline import get_credits

    return get_credits(FormatPair.LAS_TO_COPC)
