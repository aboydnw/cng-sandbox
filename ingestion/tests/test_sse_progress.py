import pytest

from src.models import Job, JobStatus, StageProgress
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
