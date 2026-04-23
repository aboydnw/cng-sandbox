import json
import uuid
from datetime import UTC, datetime

from starlette.testclient import TestClient

from src.models.dataset import DatasetRow


def _insert_dataset(db_session, **overrides) -> str:
    dataset_id = str(uuid.uuid4())
    meta = {
        "cog_url": "https://example.com/a.tif",
        "converted_file_size": 50 * 1024 * 1024,
        "dtype": "float32",
        "is_categorical": False,
    }
    meta.update(overrides.pop("meta", {}))
    row = DatasetRow(
        id=dataset_id,
        filename="a.tif",
        dataset_type="raster",
        format_pair="GeoTIFF->COG",
        tile_url="https://example/tiles/{z}/{x}/{y}",
        created_at=datetime.now(UTC),
        workspace_id=overrides.get("workspace_id", "testABCD"),
        is_example=overrides.get("is_example", False),
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
        metadata_json=json.dumps(meta),
    )
    db_session.add(row)
    db_session.commit()
    return dataset_id


def test_patch_render_mode_server_happy_path(client, db_session):
    ds_id = _insert_dataset(db_session)
    resp = client.patch(
        f"/api/datasets/{ds_id}/render-mode",
        json={"render_mode": "server"},
    )
    assert resp.status_code == 200
    assert resp.json()["render_mode"] == "server"


def test_patch_render_mode_null_clears(client, db_session):
    ds_id = _insert_dataset(db_session)
    resp = client.patch(
        f"/api/datasets/{ds_id}/render-mode",
        json={"render_mode": None},
    )
    assert resp.status_code == 200
    assert resp.json()["render_mode"] is None


def test_patch_render_mode_client_allowed_when_eligible(client, db_session):
    ds_id = _insert_dataset(db_session)
    resp = client.patch(
        f"/api/datasets/{ds_id}/render-mode",
        json={"render_mode": "client"},
    )
    assert resp.status_code == 200
    assert resp.json()["render_mode"] == "client"


def test_patch_render_mode_client_rejected_when_temporal(client, db_session):
    ds_id = _insert_dataset(db_session, meta={"is_temporal": True})
    resp = client.patch(
        f"/api/datasets/{ds_id}/render-mode",
        json={"render_mode": "client"},
    )
    assert resp.status_code == 400


def test_patch_render_mode_forbidden_for_example(app, db_session):
    ds_id = _insert_dataset(db_session, is_example=True, workspace_id=None)
    other = TestClient(app, headers={"X-Workspace-Id": "testABCD"})
    resp = other.patch(
        f"/api/datasets/{ds_id}/render-mode",
        json={"render_mode": "server"},
    )
    assert resp.status_code == 403


def test_patch_render_mode_forbidden_for_other_workspace(app, db_session):
    ds_id = _insert_dataset(db_session, workspace_id="wsAAAAAA")
    other = TestClient(app, headers={"X-Workspace-Id": "testABCD"})
    resp = other.patch(
        f"/api/datasets/{ds_id}/render-mode",
        json={"render_mode": "server"},
    )
    assert resp.status_code == 403


def test_patch_render_mode_404_for_missing_dataset(client, db_session):
    resp = client.patch(
        f"/api/datasets/{uuid.uuid4()}/render-mode",
        json={"render_mode": "server"},
    )
    assert resp.status_code == 404
