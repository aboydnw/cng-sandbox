from datetime import UTC

import pytest
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


def test_storage_delete_object():
    import obstore
    from obstore.store import MemoryStore

    from src.services.storage import StorageService

    store = MemoryStore()
    storage = StorageService(store=store, bucket="test-bucket")
    obstore.put(store, "datasets/ds-001/converted/data.tif", b"data")
    storage.delete_object("datasets/ds-001/converted/data.tif")
    with pytest.raises(FileNotFoundError):
        obstore.get(store, "datasets/ds-001/converted/data.tif")


def test_patch_categories_updates_labels(client, db_session):
    import json

    from src.models.dataset import DatasetRow

    row = DatasetRow(
        id="cat-test-1",
        filename="landcover.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/tiles",
        workspace_id="testABCD",
        metadata_json=json.dumps(
            {
                "is_categorical": True,
                "categories": [
                    {"value": 1, "color": "#FF0000", "label": "Class 1"},
                    {"value": 2, "color": "#00FF00", "label": "Class 2"},
                ],
            }
        ),
    )
    db_session.add(row)
    db_session.commit()

    resp = client.patch(
        "/api/datasets/cat-test-1/categories",
        json=[{"value": 1, "label": "Cropland"}],
        headers={"X-Workspace-Id": "testABCD"},
    )
    assert resp.status_code == 200
    data = resp.json()
    labels = {c["value"]: c["label"] for c in data}
    assert labels[1] == "Cropland"
    assert labels[2] == "Class 2"


def test_patch_categories_rejects_non_categorical(client, db_session):
    import json

    from src.models.dataset import DatasetRow

    row = DatasetRow(
        id="cont-test-1",
        filename="elevation.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/tiles",
        workspace_id="testABCD",
        metadata_json=json.dumps({"is_categorical": False}),
    )
    db_session.add(row)
    db_session.commit()

    resp = client.patch(
        "/api/datasets/cont-test-1/categories",
        json=[{"value": 1, "label": "Cropland"}],
        headers={"X-Workspace-Id": "testABCD"},
    )
    assert resp.status_code == 400


def test_patch_categories_rejects_invalid_value(client, db_session):
    import json

    from src.models.dataset import DatasetRow

    row = DatasetRow(
        id="cat-test-2",
        filename="landcover.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/tiles",
        workspace_id="testABCD",
        metadata_json=json.dumps(
            {
                "is_categorical": True,
                "categories": [
                    {"value": 1, "color": "#FF0000", "label": "Class 1"},
                ],
            }
        ),
    )
    db_session.add(row)
    db_session.commit()

    resp = client.patch(
        "/api/datasets/cat-test-2/categories",
        json=[{"value": 99, "label": "Invalid"}],
        headers={"X-Workspace-Id": "testABCD"},
    )
    assert resp.status_code == 400


def test_storage_delete_prefix():
    import obstore
    from obstore.store import MemoryStore

    from src.services.storage import StorageService

    store = MemoryStore()
    storage = StorageService(store=store, bucket="test-bucket")
    obstore.put(store, "datasets/ds-001/file1", b"a")
    obstore.put(store, "datasets/ds-001/file2", b"b")
    storage.delete_prefix("datasets/ds-001/")
    with pytest.raises(FileNotFoundError):
        obstore.get(store, "datasets/ds-001/file1")
    with pytest.raises(FileNotFoundError):
        obstore.get(store, "datasets/ds-001/file2")


def test_list_datasets_includes_examples(client, app):
    """Example datasets appear in the list regardless of workspace."""
    from datetime import UTC, datetime

    from src.models.dataset import DatasetRow

    session = app.state.db_session_factory()
    try:
        session.add(
            DatasetRow(
                id="example-gebco",
                filename="GEBCO 2024",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json="{}",
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.add(
            DatasetRow(
                id="mine",
                filename="mine.tif",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json="{}",
                is_example=False,
                workspace_id="testABCD",
                created_at=datetime.now(UTC),
            )
        )
        session.add(
            DatasetRow(
                id="other",
                filename="other.tif",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json="{}",
                is_example=False,
                workspace_id="otherXYZ1",
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    ids = {d["id"] for d in resp.json()}
    assert "example-gebco" in ids
    assert "mine" in ids
    assert "other" not in ids


def test_delete_example_dataset_returns_403(client, app):
    """Example datasets cannot be deleted from any workspace."""
    from datetime import UTC, datetime

    from src.models.dataset import DatasetRow

    session = app.state.db_session_factory()
    try:
        session.add(
            DatasetRow(
                id="example-lock",
                filename="GEBCO",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/t",
                metadata_json="{}",
                is_example=True,
                workspace_id=None,
                created_at=datetime.now(UTC),
            )
        )
        session.commit()
    finally:
        session.close()

    resp = client.delete("/api/datasets/example-lock")
    assert resp.status_code == 403
    assert "example" in resp.json()["detail"].lower()


def test_patch_categories_updates_color(client, db_engine):
    import json
    from datetime import UTC, datetime
    from sqlalchemy.orm import sessionmaker
    from src.models.dataset import DatasetRow

    session = sessionmaker(bind=db_engine)()
    try:
        session.add(
            DatasetRow(
                id="ds-color-1",
                filename="c.tif",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/raster/x",
                metadata_json=json.dumps(
                    {
                        "is_categorical": True,
                        "categories": [
                            {"value": 1, "label": "A", "color": "#000000"},
                            {"value": 2, "label": "B", "color": "#FFFFFF"},
                        ],
                    }
                ),
                created_at=datetime.now(UTC),
                workspace_id="wsTest01",
            )
        )
        session.commit()
    finally:
        session.close()

    resp = client.patch(
        "/api/datasets/ds-color-1/categories",
        headers={"x-workspace-id": "wsTest01"},
        json=[{"value": 1, "color": "#AB1234"}],
    )
    assert resp.status_code == 200
    body = resp.json()
    cat1 = next(c for c in body if c["value"] == 1)
    assert cat1["color"] == "#AB1234"
    assert cat1["label"] == "A"  # unchanged
    # defaultColor gets backfilled from original color on first touch
    assert cat1["defaultColor"] == "#000000"


def test_patch_categories_rejects_bad_hex(client, db_engine):
    import json
    from datetime import UTC, datetime
    from sqlalchemy.orm import sessionmaker
    from src.models.dataset import DatasetRow

    session = sessionmaker(bind=db_engine)()
    try:
        session.add(
            DatasetRow(
                id="ds-color-2",
                filename="c.tif",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/raster/x",
                metadata_json=json.dumps(
                    {
                        "is_categorical": True,
                        "categories": [{"value": 1, "label": "A", "color": "#000000"}],
                    }
                ),
                created_at=datetime.now(UTC),
                workspace_id="wsTest01",
            )
        )
        session.commit()
    finally:
        session.close()

    resp = client.patch(
        "/api/datasets/ds-color-2/categories",
        headers={"x-workspace-id": "wsTest01"},
        json=[{"value": 1, "color": "not-a-hex"}],
    )
    assert resp.status_code == 422


def test_patch_categories_requires_label_or_color(client, db_engine):
    import json
    from datetime import UTC, datetime
    from sqlalchemy.orm import sessionmaker
    from src.models.dataset import DatasetRow

    session = sessionmaker(bind=db_engine)()
    try:
        session.add(
            DatasetRow(
                id="ds-color-3",
                filename="c.tif",
                dataset_type="raster",
                format_pair="geotiff-to-cog",
                tile_url="/raster/x",
                metadata_json=json.dumps(
                    {
                        "is_categorical": True,
                        "categories": [{"value": 1, "label": "A", "color": "#000000"}],
                    }
                ),
                created_at=datetime.now(UTC),
                workspace_id="wsTest01",
            )
        )
        session.commit()
    finally:
        session.close()

    resp = client.patch(
        "/api/datasets/ds-color-3/categories",
        headers={"x-workspace-id": "wsTest01"},
        json=[{"value": 1}],
    )
    assert resp.status_code == 400
