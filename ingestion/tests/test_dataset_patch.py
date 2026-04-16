import json
from datetime import UTC, datetime

from sqlalchemy.orm import sessionmaker

from src.models.dataset import DatasetRow


def _make(db_engine, *, dataset_id, workspace_id, metadata=None, is_example=False):
    session = sessionmaker(bind=db_engine)()
    try:
        row = DatasetRow(
            id=dataset_id,
            filename=f"{dataset_id}.tif",
            dataset_type="raster",
            format_pair="geotiff-to-cog",
            tile_url="/raster/x",
            metadata_json=json.dumps(metadata or {}),
            created_at=datetime.now(UTC),
            workspace_id=workspace_id,
            is_example=is_example,
        )
        session.add(row)
        session.commit()
    finally:
        session.close()


def test_patch_sets_title(client, db_engine):
    _make(db_engine, dataset_id="ds-t1", workspace_id="wsTest01")
    resp = client.patch(
        "/api/datasets/ds-t1",
        headers={"x-workspace-id": "wsTest01"},
        json={"title": "Natural capital pedotope"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Natural capital pedotope"


def test_patch_clears_title_with_null(client, db_engine):
    _make(db_engine, dataset_id="ds-t2", workspace_id="wsTest01",
          metadata={"title": "Old title"})
    resp = client.patch(
        "/api/datasets/ds-t2",
        headers={"x-workspace-id": "wsTest01"},
        json={"title": None},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] is None


def test_patch_rejects_empty_title(client, db_engine):
    _make(db_engine, dataset_id="ds-t3", workspace_id="wsTest01")
    resp = client.patch(
        "/api/datasets/ds-t3",
        headers={"x-workspace-id": "wsTest01"},
        json={"title": ""},
    )
    assert resp.status_code == 422


def test_patch_rejects_too_long_title(client, db_engine):
    _make(db_engine, dataset_id="ds-t4", workspace_id="wsTest01")
    resp = client.patch(
        "/api/datasets/ds-t4",
        headers={"x-workspace-id": "wsTest01"},
        json={"title": "x" * 201},
    )
    assert resp.status_code == 422


def test_patch_rejects_example(client, db_engine):
    _make(db_engine, dataset_id="ds-ex", workspace_id=None, is_example=True)
    resp = client.patch(
        "/api/datasets/ds-ex",
        headers={"x-workspace-id": "wsTest01"},
        json={"title": "x"},
    )
    assert resp.status_code == 403


def test_patch_rejects_cross_workspace(client, db_engine):
    _make(db_engine, dataset_id="ds-ws", workspace_id="wsOwner1")
    resp = client.patch(
        "/api/datasets/ds-ws",
        headers={"x-workspace-id": "wsOther1"},
        json={"title": "x"},
    )
    assert resp.status_code == 403
