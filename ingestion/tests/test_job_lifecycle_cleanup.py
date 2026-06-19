import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from src.app import _evict_terminal_jobs, _expire_stale_scans
from src.models import Job, JobStatus
from src.routes.upload import _run_and_cleanup
from src.state import jobs, scan_store, scan_store_lock


@pytest.fixture(autouse=True)
def _clear_state():
    jobs.clear()
    scan_store.clear()
    yield
    jobs.clear()
    scan_store.clear()


@pytest.mark.asyncio
async def test_expired_scan_fails_job_and_sets_event():
    job = Job(filename="test.h5", status=JobStatus.SCANNING)
    job.scan_event = asyncio.Event()
    async with scan_store_lock:
        scan_store["scan-1"] = {
            "path": "/tmp/fake.h5",
            "job": job,
            "created_at": datetime.now(UTC) - timedelta(minutes=31),
            "variables": [],
            "state": "waiting",
        }

    await _expire_stale_scans()

    assert job.status == JobStatus.FAILED
    assert job.error is not None
    assert job.scan_event.is_set()
    assert "scan-1" not in scan_store


@pytest.mark.asyncio
async def test_fresh_scan_is_left_waiting():
    job = Job(filename="test.h5", status=JobStatus.SCANNING)
    job.scan_event = asyncio.Event()
    async with scan_store_lock:
        scan_store["scan-2"] = {
            "path": "/tmp/fake.h5",
            "job": job,
            "created_at": datetime.now(UTC),
            "variables": [],
            "state": "waiting",
        }

    await _expire_stale_scans()

    assert job.status == JobStatus.SCANNING
    assert not job.scan_event.is_set()
    assert "scan-2" in scan_store


class _RecordingStorage:
    def __init__(self):
        self.uploads = []

    def upload_raw(self, *args, **kwargs):
        self.uploads.append(args)


@pytest.mark.asyncio
async def test_expired_scan_unblocks_pipeline_and_removes_temp_file(
    tmp_path, monkeypatch
):
    from src.services import pipeline as pipeline_module
    from src.services import scanner

    input_path = tmp_path / "multi.h5"
    input_path.write_bytes(b"\x89HDF\r\n\x1a\n" + b"\x00" * 64)

    storage = _RecordingStorage()
    monkeypatch.setattr(pipeline_module, "StorageService", lambda: storage)
    monkeypatch.setattr(
        pipeline_module, "validate_magic_bytes", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(
        scanner,
        "scan_hdf5",
        lambda path: [
            {"name": "a", "group": "g", "shape": [2, 2], "dtype": "float32"},
            {"name": "b", "group": "g", "shape": [2, 2], "dtype": "float32"},
        ],
    )

    job = Job(filename="multi.h5")
    jobs[job.id] = job
    task = asyncio.create_task(_run_and_cleanup(job, str(input_path), None))

    async def _wait_for_pause():
        while job.scan_result is None:
            await asyncio.sleep(0.01)

    await asyncio.wait_for(_wait_for_pause(), timeout=5)

    scan_id = job.scan_result["scan_id"]
    async with scan_store_lock:
        scan_store[scan_id]["created_at"] -= timedelta(minutes=31)

    await _expire_stale_scans()
    await asyncio.wait_for(task, timeout=5)

    assert job.status == JobStatus.FAILED
    assert not input_path.exists()
    assert storage.uploads == []
    assert scan_store == {}


def test_evicts_terminal_jobs_past_ttl():
    now = datetime.now(UTC)
    ready = Job(filename="done.tif", status=JobStatus.READY)
    ready.finished_at = now - timedelta(hours=2)
    failed = Job(filename="failed.tif", status=JobStatus.FAILED)
    failed.finished_at = now - timedelta(hours=2)
    jobs[ready.id] = ready
    jobs[failed.id] = failed

    _evict_terminal_jobs(now=now)

    assert jobs == {}


def test_keeps_running_and_recent_terminal_jobs():
    now = datetime.now(UTC)
    running = Job(filename="running.tif", status=JobStatus.CONVERTING)
    recent = Job(filename="recent.tif", status=JobStatus.READY)
    recent.finished_at = now - timedelta(minutes=5)
    jobs[running.id] = running
    jobs[recent.id] = recent

    _evict_terminal_jobs(now=now)

    assert running.id in jobs
    assert recent.id in jobs


def test_stamps_finished_at_on_first_sweep_then_evicts():
    now = datetime.now(UTC)
    job = Job(filename="late.tif", status=JobStatus.READY)
    jobs[job.id] = job

    _evict_terminal_jobs(now=now)
    assert job.id in jobs
    assert job.finished_at == now

    _evict_terminal_jobs(now=now + timedelta(hours=1, minutes=1))
    assert job.id not in jobs
