import json
from datetime import UTC, datetime

from sqlalchemy.orm import sessionmaker

from src.models.dataset import DatasetRow


def _make_dataset(db_engine, *, dataset_id, workspace_id, filename, is_example=False,
                  metadata=None, dataset_type="raster"):
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


def test_mark_categorical_writes_metadata(client, db_engine, monkeypatch):
    _make_dataset(
        db_engine,
        dataset_id="ds-mark-1",
        workspace_id="wsTest01",
        filename="pedo.tif",
        metadata={"cog_path": "r2://bucket/pedo.tif"},
    )

    import src.routes.datasets as routes

    monkeypatch.setattr(
        routes, "extract_unique_values_from_dataset",
        lambda row: [0, 1, 2],
    )

    resp = client.post(
        "/api/datasets/ds-mark-1/mark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["is_categorical"] is True
    values = [c["value"] for c in body["categories"]]
    assert values == [0, 1, 2]
    for cat in body["categories"]:
        assert cat["label"] == f"Class {cat['value']}"
        assert cat["color"].startswith("#")
        assert cat["defaultColor"] == cat["color"]


def test_mark_categorical_rejects_example(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-ex",
        workspace_id=None,
        filename="ex.tif",
        is_example=True,
    )
    resp = client.post(
        "/api/datasets/ds-ex/mark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 403


def test_mark_categorical_rejects_cross_workspace(client, db_engine):
    _make_dataset(db_engine, dataset_id="ds-ws", workspace_id="wsOwner1",
                  filename="x.tif")
    resp = client.post(
        "/api/datasets/ds-ws/mark-categorical",
        headers={"x-workspace-id": "wsOther1"},
    )
    assert resp.status_code == 403


def test_mark_categorical_returns_409_when_already_categorical(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-already",
        workspace_id="wsTest01",
        filename="c.tif",
        metadata={
            "is_categorical": True,
            "categories": [{"value": 1, "label": "A", "color": "#000000"}],
        },
    )
    resp = client.post(
        "/api/datasets/ds-already/mark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 409


def test_mark_categorical_surfaces_too_many_values(client, db_engine, monkeypatch):
    _make_dataset(db_engine, dataset_id="ds-tmv", workspace_id="wsTest01", filename="t.tif")
    import src.routes.datasets as routes
    from src.services.categorical_extract import TooManyValues

    def _raise(_row):
        raise TooManyValues(42)

    monkeypatch.setattr(routes, "extract_unique_values_from_dataset", _raise)

    resp = client.post(
        "/api/datasets/ds-tmv/mark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["detail"]["error"] == "too_many_values"
    assert body["detail"]["count"] == 42


def test_mark_categorical_surfaces_unsupported_dtype(client, db_engine, monkeypatch):
    _make_dataset(db_engine, dataset_id="ds-bad", workspace_id="wsTest01", filename="f.tif")
    import src.routes.datasets as routes
    from src.services.categorical_extract import UnsupportedDtype

    def _raise_dtype(_row):
        raise UnsupportedDtype("float32")

    monkeypatch.setattr(routes, "extract_unique_values_from_dataset", _raise_dtype)

    resp = client.post(
        "/api/datasets/ds-bad/mark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "unsupported_dtype"
    assert resp.json()["detail"]["dtype"] == "float32"


def test_mark_categorical_rejects_vector(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-vec",
        workspace_id="wsTest01",
        filename="roads.geojson",
        dataset_type="vector",
    )
    resp = client.post(
        "/api/datasets/ds-vec/mark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "not_a_raster"


def test_mark_categorical_400_when_no_raster_path(client, db_engine):
    _make_dataset(
        db_engine,
        dataset_id="ds-nopath",
        workspace_id="wsTest01",
        filename="mystery.tif",
        metadata={"some_other_key": "value"},
    )
    resp = client.post(
        "/api/datasets/ds-nopath/mark-categorical",
        headers={"x-workspace-id": "wsTest01"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "no_raster_path"
