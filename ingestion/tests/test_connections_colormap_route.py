import uuid
from datetime import UTC, datetime

from starlette.testclient import TestClient

from src.models.connection import ConnectionRow


def _insert_connection(db_session, **overrides) -> str:
    conn_id = str(uuid.uuid4())
    row = ConnectionRow(
        id=conn_id,
        name=overrides.pop("name", "c"),
        url=overrides.pop("url", "https://example.com/a.tif"),
        connection_type=overrides.pop("connection_type", "cog"),
        tile_type=overrides.pop("tile_type", "raster"),
        workspace_id=overrides.pop("workspace_id", "testABCD"),
        created_at=datetime.now(UTC),
        preferred_colormap=overrides.pop("preferred_colormap", None),
        preferred_colormap_reversed=overrides.pop(
            "preferred_colormap_reversed", None
        ),
    )
    db_session.add(row)
    db_session.commit()
    return conn_id


def test_patch_colormap_happy_path(client, db_session):
    conn_id = _insert_connection(db_session)
    resp = client.patch(
        f"/api/connections/{conn_id}/colormap",
        json={
            "preferred_colormap": "terrain",
            "preferred_colormap_reversed": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["preferred_colormap"] == "terrain"
    assert body["preferred_colormap_reversed"] is True


def test_patch_colormap_null_clears_both_fields(client, db_session):
    conn_id = _insert_connection(
        db_session, preferred_colormap="plasma", preferred_colormap_reversed=True
    )
    resp = client.patch(
        f"/api/connections/{conn_id}/colormap",
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
    conn_id = _insert_connection(db_session)
    resp = client.patch(
        f"/api/connections/{conn_id}/colormap",
        json={
            "preferred_colormap": "nope",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 422


def test_patch_colormap_rejects_vector_connection(client, db_session):
    conn_id = _insert_connection(
        db_session, connection_type="xyz_vector", tile_type="vector"
    )
    resp = client.patch(
        f"/api/connections/{conn_id}/colormap",
        json={
            "preferred_colormap": "viridis",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 400


def test_patch_colormap_forbidden_for_other_workspace(app, db_session):
    conn_id = _insert_connection(db_session, workspace_id="wsAAAAAA")
    other = TestClient(app, headers={"X-Workspace-Id": "testABCD"})
    resp = other.patch(
        f"/api/connections/{conn_id}/colormap",
        json={
            "preferred_colormap": "viridis",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 403


def test_patch_colormap_404_for_missing_connection(client):
    resp = client.patch(
        f"/api/connections/{uuid.uuid4()}/colormap",
        json={
            "preferred_colormap": "viridis",
            "preferred_colormap_reversed": False,
        },
    )
    assert resp.status_code == 404
