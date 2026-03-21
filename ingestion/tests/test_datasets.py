from sqlalchemy import inspect


def test_datasets_table_created(db_engine):
    inspector = inspect(db_engine)
    assert "datasets" in inspector.get_table_names()


def test_list_datasets_empty(client):
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_datasets_with_data(client, db_engine):
    from src.models.dataset import DatasetRow
    from sqlalchemy.orm import sessionmaker
    from datetime import datetime, timezone

    session = sessionmaker(bind=db_engine)()
    row = DatasetRow(
        id="ds-001",
        filename="test.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/raster/collections/sandbox-ds-001/tiles/{z}/{x}/{y}",
        metadata_json="{}",
        created_at=datetime.now(timezone.utc),
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
