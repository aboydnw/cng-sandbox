from datetime import UTC

from sqlalchemy import inspect


def test_datasets_table_created(db_engine):
    inspector = inspect(db_engine)
    assert "datasets" in inspector.get_table_names()


def test_list_datasets_empty(client):
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_datasets_with_data(client, db_engine):
    from datetime import datetime

    from sqlalchemy.orm import sessionmaker

    from src.models.dataset import DatasetRow

    session = sessionmaker(bind=db_engine)()
    row = DatasetRow(
        id="ds-001",
        filename="test.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/raster/collections/sandbox-ds-001/tiles/{z}/{x}/{y}",
        metadata_json="{}",
        created_at=datetime.now(UTC),
        workspace_id="testABCD",
    )
    session.add(row)
    session.commit()
    session.close()

    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == "ds-001"
    assert data[0]["filename"] == "test.tif"
    assert data[0]["story_count"] == 0


def test_get_dataset_not_found(client):
    resp = client.get("/api/datasets/nonexistent")
    assert resp.status_code == 404


def test_delete_dataset_endpoint(client, db_engine):
    from datetime import datetime

    from sqlalchemy.orm import sessionmaker

    from src.models.dataset import DatasetRow

    session = sessionmaker(bind=db_engine)()
    row = DatasetRow(
        id="ds-del",
        filename="delete-me.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/raster/collections/sandbox-ds-del/tiles/{z}/{x}/{y}",
        metadata_json='{"stac_collection_id": "sandbox-ds-del"}',
        created_at=datetime.now(UTC),
        workspace_id="testABCD",
    )
    session.add(row)
    session.commit()
    session.close()

    resp = client.delete("/api/datasets/ds-del")
    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] is True

    resp = client.get("/api/datasets/ds-del")
    assert resp.status_code == 404


def test_delete_dataset_not_found(client):
    resp = client.delete("/api/datasets/nonexistent")
    assert resp.status_code == 404


def test_delete_dataset_reports_affected_stories(client, db_engine):
    import json
    from datetime import datetime

    from sqlalchemy.orm import sessionmaker

    from src.models.dataset import DatasetRow
    from src.models.story import StoryRow

    session = sessionmaker(bind=db_engine)()
    session.add(
        DatasetRow(
            id="ds-ref",
            filename="referenced.tif",
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url="/raster/tiles/{z}/{x}/{y}",
            metadata_json="{}",
            created_at=datetime.now(UTC),
            workspace_id="testABCD",
        )
    )
    session.add(
        StoryRow(
            id="story-1",
            title="Test Story",
            dataset_id="ds-ref",
            chapters_json=json.dumps(
                [
                    {
                        "id": "ch-1",
                        "order": 0,
                        "title": "Ch1",
                        "narrative": "text",
                        "map_state": {
                            "center": [0, 0],
                            "zoom": 2,
                            "bearing": 0,
                            "pitch": 0,
                            "basemap": "streets",
                        },
                        "transition": "fly-to",
                        "layer_config": {
                            "dataset_id": "ds-ref",
                            "colormap": "viridis",
                            "opacity": 1,
                        },
                    }
                ]
            ),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
    session.commit()
    session.close()

    resp = client.delete("/api/datasets/ds-ref")
    assert resp.status_code == 200
    data = resp.json()
    assert "story-1" in data["affected_stories"]


def test_storage_delete_object(monkeypatch):
    from src.services.storage import StorageService

    deleted_keys = []

    class FakeS3:
        def delete_object(self, Bucket, Key):
            deleted_keys.append(Key)

        def list_objects_v2(self, Bucket, Prefix):
            return {"Contents": [{"Key": f"{Prefix}file1"}, {"Key": f"{Prefix}file2"}]}

    storage = StorageService(s3_client=FakeS3(), bucket="test-bucket")
    storage.delete_object("datasets/ds-001/converted/data.tif")
    assert deleted_keys == ["datasets/ds-001/converted/data.tif"]


def test_storage_delete_prefix(monkeypatch):
    from src.services.storage import StorageService

    deleted_keys = []

    class FakeS3:
        def list_objects_v2(self, Bucket, Prefix):
            return {"Contents": [{"Key": f"{Prefix}file1"}, {"Key": f"{Prefix}file2"}]}

        def delete_object(self, Bucket, Key):
            deleted_keys.append(Key)

    storage = StorageService(s3_client=FakeS3(), bucket="test-bucket")
    storage.delete_prefix("datasets/ds-001/")
    assert len(deleted_keys) == 2
