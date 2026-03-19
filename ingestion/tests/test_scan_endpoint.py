import asyncio
import pytest
from src.models import Job, JobStatus
from src.state import scan_store, scan_store_lock


@pytest.fixture(autouse=True)
def clear_scan_store():
    scan_store.clear()
    yield
    scan_store.clear()


@pytest.mark.asyncio
async def test_scan_convert_sets_variable_and_resumes():
    job = Job(filename="test.h5")
    job.status = JobStatus.SCANNING
    job.scan_event = asyncio.Event()
    scan_id = "test-scan-123"

    async with scan_store_lock:
        scan_store[scan_id] = {
            "path": "/tmp/fake.h5",
            "job": job,
            "variables": [
                {"name": "soilMoisture", "group": "grids", "shape": [10, 20], "dtype": "float32"},
                {"name": "temp", "group": "grids", "shape": [10, 20], "dtype": "float32"},
            ],
            "state": "waiting",
        }

    from src.routes.upload import _handle_scan_convert
    await _handle_scan_convert(scan_id, "soilMoisture", "grids")

    assert job.variable == "soilMoisture"
    assert job.group == "grids"
    assert job.scan_event.is_set()
    assert scan_store[scan_id]["state"] == "converting"


@pytest.mark.asyncio
async def test_scan_convert_404_for_missing_scan():
    from fastapi import HTTPException
    from src.routes.upload import _handle_scan_convert
    with pytest.raises(HTTPException) as exc_info:
        await _handle_scan_convert("nonexistent-id", "var", "grp")
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_scan_convert_400_for_invalid_variable():
    job = Job(filename="test.h5")
    job.scan_event = asyncio.Event()
    scan_id = "test-scan-456"

    async with scan_store_lock:
        scan_store[scan_id] = {
            "path": "/tmp/fake.h5",
            "job": job,
            "variables": [{"name": "soilMoisture", "group": "grids", "shape": [10, 20], "dtype": "float32"}],
            "state": "waiting",
        }

    from fastapi import HTTPException
    from src.routes.upload import _handle_scan_convert
    with pytest.raises(HTTPException) as exc_info:
        await _handle_scan_convert(scan_id, "nonexistent_var", "grids")
    assert exc_info.value.status_code == 400
