"""Tests for job workspace scoping."""

from src.models import Job
from src.state import jobs


def test_job_visible_to_owner(client):
    job = Job(filename="test.tif")
    job.workspace_id = "testABCD"
    jobs[job.id] = job

    resp = client.get(f"/api/jobs/{job.id}")
    assert resp.status_code == 200
    del jobs[job.id]


def test_job_hidden_from_other_workspace(client, app):
    job = Job(filename="test.tif")
    job.workspace_id = "ownerXYZ"
    jobs[job.id] = job

    resp = client.get(f"/api/jobs/{job.id}")
    assert resp.status_code == 404
    del jobs[job.id]


def test_job_without_workspace_accessible(client):
    job = Job(filename="test.tif")
    job.workspace_id = None
    jobs[job.id] = job

    resp = client.get(f"/api/jobs/{job.id}")
    assert resp.status_code == 200
    del jobs[job.id]


def test_stream_accessible_without_workspace_header(app):
    """Stream endpoint intentionally skips workspace scoping so browser
    EventSource (which can't send custom headers) can connect. Job UUIDs
    are the access barrier — same tradeoff as /api/connections/{id}/stream.
    """
    from starlette.testclient import TestClient

    from src.models import JobStatus

    job = Job(filename="test.tif")
    job.workspace_id = "ownerXYZ"
    # Flip to READY so the SSE generator yields once and exits cleanly.
    job.status = JobStatus.READY
    jobs[job.id] = job

    # No X-Workspace-Id header — mirrors browser EventSource.
    anon = TestClient(app, raise_server_exceptions=False)
    resp = anon.get(f"/api/jobs/{job.id}/stream")
    assert resp.status_code == 200

    resp_missing = anon.get("/api/jobs/does-not-exist/stream")
    assert resp_missing.status_code == 404
    del jobs[job.id]
