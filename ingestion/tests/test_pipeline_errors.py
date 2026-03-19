"""Tests for pipeline error handling."""

import pytest

from src.models import Job, JobStatus


@pytest.fixture
def job():
    return Job(filename="test.tif")


class TestPipelineErrorHandling:
    @pytest.mark.asyncio
    async def test_invalid_file_fails_gracefully(self, job, tmp_path):
        from src.services.pipeline import run_pipeline

        bad_file = tmp_path / "garbage.tif"
        bad_file.write_bytes(b"not a real geotiff")

        await run_pipeline(job, str(bad_file), {})
        assert job.status == JobStatus.FAILED
        assert job.error is not None

    @pytest.mark.asyncio
    async def test_empty_file_fails_gracefully(self, tmp_path):
        from src.services.pipeline import run_pipeline

        job = Job(filename="empty.tif")
        empty_file = tmp_path / "empty.tif"
        empty_file.write_bytes(b"")

        await run_pipeline(job, str(empty_file), {})
        assert job.status == JobStatus.FAILED
