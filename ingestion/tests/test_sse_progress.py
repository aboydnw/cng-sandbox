import asyncio
import json

import pytest

from src.models import Job, JobStatus, StageProgress
from src.routes import jobs as jobs_routes
from src.state import jobs


@pytest.fixture(autouse=True)
def _clear_jobs():
    jobs.clear()
    yield
    jobs.clear()


def test_sse_includes_stage_progress(client):
    job = Job(filename="test.tif")
    job.status = JobStatus.CONVERTING
    job.stage_progress = StageProgress(percent=42)
    jobs[job.id] = job

    resp = client.get(f"/api/jobs/{job.id}")
    data = resp.json()
    assert data["stage_progress"] == {
        "percent": 42,
        "current": None,
        "total": None,
        "detail": None,
    }


def test_sse_stage_progress_null_when_not_set(client):
    job = Job(filename="test.tif")
    job.status = JobStatus.SCANNING
    jobs[job.id] = job

    resp = client.get(f"/api/jobs/{job.id}")
    data = resp.json()
    assert data["stage_progress"] is None


@pytest.mark.asyncio
async def test_stream_stall_deadline_resets_on_status_change(monkeypatch):
    monkeypatch.setattr(jobs_routes, "STALL_TIMEOUT_SECONDS", 0.4)
    monkeypatch.setattr(jobs_routes, "POLL_INTERVAL_SECONDS", 0.02)

    job = Job(filename="test.tif")
    job.status = JobStatus.SCANNING

    async def advance():
        for status in (
            JobStatus.CONVERTING,
            JobStatus.VALIDATING,
            JobStatus.INGESTING,
        ):
            await asyncio.sleep(0.25)
            job.status = status
        await asyncio.sleep(0.25)
        job.status = JobStatus.READY

    task = asyncio.create_task(advance())
    events = [e async for e in jobs_routes._job_event_stream(job)]
    await task

    assert all(e["event"] != "timeout" for e in events)
    assert json.loads(events[-1]["data"])["status"] == "ready"


@pytest.mark.asyncio
async def test_stream_times_out_after_stall(monkeypatch):
    monkeypatch.setattr(jobs_routes, "STALL_TIMEOUT_SECONDS", 0.2)
    monkeypatch.setattr(jobs_routes, "POLL_INTERVAL_SECONDS", 0.02)

    job = Job(filename="test.tif")
    job.status = JobStatus.CONVERTING

    events = [e async for e in jobs_routes._job_event_stream(job)]

    assert any(e["event"] == "status" for e in events)
    assert events[-1]["event"] == "timeout"


@pytest.mark.asyncio
async def test_stream_times_out_at_absolute_ceiling(monkeypatch):
    monkeypatch.setattr(jobs_routes, "STALL_TIMEOUT_SECONDS", 60.0)
    monkeypatch.setattr(jobs_routes, "MAX_STREAM_SECONDS", 0.1)
    monkeypatch.setattr(jobs_routes, "POLL_INTERVAL_SECONDS", 0.02)

    job = Job(filename="test.tif")
    job.status = JobStatus.CONVERTING

    events = [e async for e in jobs_routes._job_event_stream(job)]

    assert events[-1]["event"] == "timeout"
