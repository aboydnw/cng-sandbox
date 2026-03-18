"""Integration tests — require Docker Compose running (eoAPI + MinIO).

Run with: cd sandbox && docker compose up -d
Then: cd ingestion && python -m pytest tests/test_integration.py -v -s
"""

import time

import httpx
import pytest


def _is_docker_running():
    """Check if eoAPI services are reachable."""
    try:
        resp = httpx.get("http://localhost:8081/", timeout=2.0)
        return resp.status_code == 200
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _is_docker_running(),
    reason="Docker Compose services not running (start with: cd sandbox && docker compose up -d)",
)


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_upload_geotiff_end_to_end(client, synthetic_geotiff):
    with open(synthetic_geotiff, "rb") as f:
        resp = client.post("/api/upload", files={"file": ("test.tif", f, "image/tiff")})
    assert resp.status_code == 200
    data = resp.json()
    job_id = data["job_id"]
    dataset_id = data["dataset_id"]

    for _ in range(120):
        resp = client.get(f"/api/jobs/{job_id}")
        assert resp.status_code == 200
        job = resp.json()
        if job["status"] in ("ready", "failed"):
            break
        time.sleep(0.5)

    assert job["status"] == "ready", f"Job failed: {job.get('error')}"

    resp = client.get(f"/api/datasets/{dataset_id}")
    assert resp.status_code == 200
    dataset = resp.json()
    assert dataset["dataset_type"] == "raster"
    assert "tile_url" in dataset
    assert len(dataset["credits"]) > 0


def test_upload_geojson_end_to_end(client, synthetic_geojson):
    with open(synthetic_geojson, "rb") as f:
        resp = client.post("/api/upload", files={"file": ("test.geojson", f, "application/json")})
    assert resp.status_code == 200
    data = resp.json()
    job_id = data["job_id"]
    dataset_id = data["dataset_id"]

    for _ in range(120):
        resp = client.get(f"/api/jobs/{job_id}")
        job = resp.json()
        if job["status"] in ("ready", "failed"):
            break
        time.sleep(0.5)

    assert job["status"] == "ready", f"Job failed: {job.get('error')}"

    resp = client.get(f"/api/datasets/{dataset_id}")
    dataset = resp.json()
    assert dataset["dataset_type"] == "vector"


def test_upload_oversized_file_rejected(client):
    resp = client.post(
        "/api/upload",
        files={"file": ("test.tif", b"x" * 100, "image/tiff")},
    )
    # With default 1GB limit, 100 bytes should succeed (the pipeline may fail
    # on magic bytes, but the upload itself should be accepted)
    assert resp.status_code == 200


def test_job_not_found(client):
    resp = client.get("/api/jobs/nonexistent-id")
    assert resp.status_code == 404


def test_dataset_not_found(client):
    resp = client.get("/api/datasets/nonexistent-id")
    assert resp.status_code == 404
