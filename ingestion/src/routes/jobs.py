"""Job status routes with SSE progress streaming."""

import asyncio
import json
import time

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from src.models import JobStatus
from src.state import jobs

router = APIRouter(prefix="/api")


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get the current status of a conversion job."""
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.model_dump()


@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    """SSE stream of job status updates."""
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        last_status = (None, None)
        scan_result_emitted = False
        start = time.monotonic()
        max_duration = 600  # 10 minutes

        while time.monotonic() - start < max_duration:
            # Emit scan_result once when available
            if job.scan_result is not None and not scan_result_emitted:
                scan_result_emitted = True
                yield {"event": "scan_result", "data": json.dumps(job.scan_result)}

            current_snapshot = (
                job.status,
                job.progress_current,
                job.stage_progress.model_dump() if job.stage_progress else None,
            )
            if current_snapshot != last_status:
                last_status = current_snapshot
                data = {
                    "status": job.status.value,
                    "validation_results": [
                        v.model_dump() for v in job.validation_results
                    ],
                }
                if job.error:
                    data["error"] = job.error
                if job.dataset_id:
                    data["dataset_id"] = job.dataset_id
                if job.progress_current is not None:
                    data["progress_current"] = job.progress_current
                if job.progress_total is not None:
                    data["progress_total"] = job.progress_total
                if job.stage_progress is not None:
                    data["stage_progress"] = job.stage_progress.model_dump()
                yield {"event": "status", "data": json.dumps(data)}

                if job.status in (JobStatus.READY, JobStatus.FAILED):
                    break

            await asyncio.sleep(0.5)
        else:
            yield {"event": "timeout", "data": json.dumps({"error": "Job timed out"})}

    return EventSourceResponse(event_generator())
