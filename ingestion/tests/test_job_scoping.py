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


def test_stream_hidden_from_other_workspace(client, app):
    job = Job(filename="test.tif")
    job.workspace_id = "ownerXYZ"
    jobs[job.id] = job

    resp = client.get(f"/api/jobs/{job.id}/stream")
    assert resp.status_code == 404
    del jobs[job.id]
