import json
import uuid
from datetime import UTC, datetime

from starlette.testclient import TestClient

from src.models.dataset import DatasetRow


def _insert_dataset(db_session, **overrides) -> str:
    dataset_id = str(uuid.uuid4())
    meta = {"dtype": "int16"}
    meta.update(overrides.pop("meta", {}))
    row = DatasetRow(
        id=dataset_id,
        filename="a.tif",
        dataset_type=overrides.pop("dataset_type", "raster"),
        format_pair="GeoTIFF->COG",
        tile_url="/raster/x/{z}/{x}/{y}",
        created_at=datetime.now(UTC),
        workspace_id=overrides.pop("workspace_id", "testABCD"),
        is_example=overrides.pop("is_example", False),
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
        metadata_json=json.dumps(meta),
        preferred_colormap=overrides.pop("preferred_colormap", None),
        preferred_colormap_reversed=overrides.pop(
            "preferred_colormap_reversed", None
        ),
    )
    db_session.add(row)
    db_session.commit()
    return dataset_id


def test_patch_colormap_happy_path(client, db_session):
    ds_id = _insert_dataset(db_session)
    resp = client.patch(
        f"/api/datasets/{ds_id}/colormap",
        json={
            "preferred_colormap": "terrain",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["preferred_colormap"] == "terrain"
    assert body["preferred_colormap_reversed"] is False


def test_patch_colormap_null_clears_both_fields(client, db_session):
    ds_id = _insert_dataset(
        db_session,
        preferred_colormap="plasma",
        preferred_colormap_reversed=True,
    )
    resp = client.patch(
        f"/api/datasets/{ds_id}/colormap",
        json={
            "preferred_colormap": None,
            "preferred_colormap_reversed": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["preferred_colormap"] is None
    assert body["preferred_colormap_reversed"] is None


def test_patch_colormap_rejects_unknown_name(client, db_session):
    ds_id = _insert_dataset(db_session)
    resp = client.patch(
        f"/api/datasets/{ds_id}/colormap",
        json={
            "preferred_colormap": "definitely-not-a-colormap",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 422


def test_patch_colormap_rejects_non_raster(client, db_session):
    ds_id = _insert_dataset(db_session, dataset_type="vector")
    resp = client.patch(
        f"/api/datasets/{ds_id}/colormap",
        json={
            "preferred_colormap": "viridis",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 400


def test_patch_colormap_forbidden_for_example(client, db_session):
    ds_id = _insert_dataset(db_session, is_example=True, workspace_id="testABCD")
    resp = client.patch(
        f"/api/datasets/{ds_id}/colormap",
        json={
            "preferred_colormap": "viridis",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 403


def test_patch_colormap_forbidden_for_other_workspace(app, db_session):
    ds_id = _insert_dataset(db_session, workspace_id="wsAAAAAA")
    other = TestClient(app, headers={"X-Workspace-Id": "testABCD"})
    resp = other.patch(
        f"/api/datasets/{ds_id}/colormap",
        json={
            "preferred_colormap": "viridis",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 403


def test_patch_colormap_404_for_missing_dataset(client):
    resp = client.patch(
        f"/api/datasets/{uuid.uuid4()}/colormap",
        json={
            "preferred_colormap": "viridis",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 404


def test_patch_colormap_normalizes_case(client, db_session):
    ds_id = _insert_dataset(db_session)
    resp = client.patch(
        f"/api/datasets/{ds_id}/colormap",
        json={
            "preferred_colormap": "Terrain",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["preferred_colormap"] == "terrain"
