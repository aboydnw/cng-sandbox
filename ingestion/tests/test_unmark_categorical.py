import json
from datetime import UTC, datetime

from sqlalchemy.orm import sessionmaker

from src.models.dataset import DatasetRow


def _make_dataset(
    db_engine,
    *,
    dataset_id,
    workspace_id,
    filename,
    is_example=False,
    metadata=None,
    dataset_type="raster",
):
    session = sessionmaker(bind=db_engine)()
    try:
        row = DatasetRow(
            id=dataset_id,
            filename=filename,
            dataset_type=dataset_type,
            format_pair="geotiff-to-cog",
            tile_url=f"/raster/collections/sandbox-{dataset_id}/tiles/{{z}}/{{x}}/{{y}}",
            metadata_json=json.dumps(metadata or {}),
            created_at=datetime.now(UTC),
            workspace_id=workspace_id,
            is_example=is_example,
        )
        session.add(row)
        session.commit()
    finally:
        session.close()


def _categorical_metadata():
    return {
        "cog_path": "r2://bucket/scl.tif",
        "is_categorical": True,
        "categories": [
            {"value": 0, "label": "Class 0", "color": "#111111"},
            {"value": 1, "label": "Class 1", "color": "#222222"},
        ],
    }


def test_unmark_categorical_clears_metadata(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-unmark-1",
        workspace_id="wsTest01",
        filename="scl.tif",
        metadata=_categorical_metadata(),
    )
    resp = client.post(
        "/api/datasets/ds-unmark-1/unmark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert not body.get("is_categorical")
    assert "categories" not in body


def test_unmark_categorical_rejects_example(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-ex",
        workspace_id=None,
        filename="ex.tif",
        is_example=True,
        metadata=_categorical_metadata(),
    )
    resp = client.post(
        "/api/datasets/ds-ex/unmark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 403


def test_unmark_categorical_rejects_cross_workspace(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-ws",
        workspace_id="wsOwner1",
        filename="x.tif",
        metadata=_categorical_metadata(),
    )
    resp = client.post(
        "/api/datasets/ds-ws/unmark-categorical",
        headers={"x-workspace-id": "wsOther1"},
    )
    assert resp.status_code == 403


def test_unmark_categorical_returns_409_when_not_categorical(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-continuous",
        workspace_id="wsTest01",
        filename="cont.tif",
        metadata={"cog_path": "r2://bucket/cont.tif"},
    )
    resp = client.post(
        "/api/datasets/ds-continuous/unmark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 409


def test_unmark_categorical_rejects_vector(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-vec",
        workspace_id="wsTest01",
        filename="roads.geojson",
        dataset_type="vector",
        metadata=_categorical_metadata(),
    )
    resp = client.post(
        "/api/datasets/ds-vec/unmark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "not_a_raster"


def test_unmark_categorical_returns_404_when_missing(client):
    resp = client.post(
        "/api/datasets/ds-missing/unmark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 404


def test_unmark_categorical_requires_workspace_header(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-no-header",
        workspace_id="wsTest01",
        filename="scl.tif",
        metadata=_categorical_metadata(),
    )
    resp = client.post("/api/datasets/ds-no-header/unmark-categorical")
    assert resp.status_code == 403
