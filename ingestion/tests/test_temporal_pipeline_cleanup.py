import pytest

from src.models import Job, JobStatus
from src.services import temporal_pipeline


class FakeStorage:
    def __init__(self):
        self.uploaded = []
        self.deleted = []

    def upload_raw(self, path, dataset_id, filename):
        key = f"datasets/{dataset_id}/raw/{filename}"
        self.uploaded.append(key)
        return key

    def upload_file(self, path, key):
        self.uploaded.append(key)
        return key

    def get_s3_uri(self, key):
        return f"s3://bucket/{key}"

    def delete_object(self, key):
        self.deleted.append(key)


@pytest.mark.asyncio
async def test_non_raster_file_cleans_up_uploaded_keys(monkeypatch, tmp_path):
    storage = FakeStorage()
    monkeypatch.setattr(temporal_pipeline, "StorageService", lambda: storage)
    monkeypatch.setattr(temporal_pipeline, "validate_magic_bytes", lambda *a, **k: None)
    monkeypatch.setattr(temporal_pipeline, "_import_and_convert", lambda *a, **k: None)
    monkeypatch.setattr(temporal_pipeline, "_import_and_validate", lambda *a, **k: [])

    tif = tmp_path / "data_2020-01-01.tif"
    tif.write_bytes(b"fake")
    geojson = tmp_path / "data_2020-01-02.geojson"
    geojson.write_bytes(b"{}")

    job = Job(filename="data_2020-01-01.tif")
    await temporal_pipeline.run_temporal_pipeline(
        job,
        [str(tif), str(geojson)],
        ["data_2020-01-01.tif", "data_2020-01-02.geojson"],
        db_session_factory=None,
    )

    assert job.status == JobStatus.FAILED
    assert len(storage.uploaded) == 1
    assert storage.deleted == storage.uploaded
