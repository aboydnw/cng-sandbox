from src.models import Job, StageProgress


def test_job_has_stage_progress_field():
    job = Job(filename="test.tif")
    assert job.stage_progress is None


def test_job_stage_progress_with_percent():
    job = Job(filename="test.tif")
    job.stage_progress = StageProgress(percent=42)
    assert job.stage_progress.percent == 42
    assert job.stage_progress.current is None
    assert job.stage_progress.total is None
    assert job.stage_progress.detail is None


def test_job_stage_progress_with_current_total():
    job = Job(filename="test.tif")
    job.stage_progress = StageProgress(current=3, total=10)
    assert job.stage_progress.current == 3
    assert job.stage_progress.total == 10


def test_job_stage_progress_with_detail():
    job = Job(filename="test.tif")
    job.stage_progress = StageProgress(detail="uploading")
    assert job.stage_progress.detail == "uploading"


def test_stage_progress_serializes():
    sp = StageProgress(percent=67, detail="converting")
    data = sp.model_dump()
    assert data == {"percent": 67, "current": None, "total": None, "detail": "converting"}
