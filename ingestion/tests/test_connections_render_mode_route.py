import json
import uuid
from datetime import UTC, datetime

import pytest
from starlette.testclient import TestClient

from src.models.connection import ConnectionRow


def _insert_connection(db_session, **overrides) -> str:
    conn_id = str(uuid.uuid4())
    row = ConnectionRow(
        id=conn_id,
        name="c",
        url="https://example.com/x.cog",
        connection_type="cog",
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
        file_size=50 * 1024 * 1024,
        workspace_id=overrides.get("workspace_id", "testABCD"),
        created_at=datetime.now(UTC),
    )
    for k, v in overrides.items():
        if k == "workspace_id":
            continue
        setattr(row, k, v)
    db_session.add(row)
    db_session.commit()
    return conn_id


def test_patch_render_mode_server_happy_path(client, db_session):
    conn_id = _insert_connection(db_session)
    resp = client.patch(
        f"/api/connections/{conn_id}/render-mode",
        json={"render_mode": "server"},
    )
    assert resp.status_code == 200
    assert resp.json()["render_mode"] == "server"


def test_patch_render_mode_client_rejected_when_size_unknown(client, db_session):
    conn_id = _insert_connection(db_session, file_size=None)
    resp = client.patch(
        f"/api/connections/{conn_id}/render-mode",
        json={"render_mode": "client"},
    )
    assert resp.status_code == 400


def test_patch_render_mode_forbidden_for_other_workspace(app, db_session):
    conn_id = _insert_connection(db_session, workspace_id="wsAAAAAA")
    other = TestClient(app, headers={"X-Workspace-Id": "testABCD"})
    resp = other.patch(
        f"/api/connections/{conn_id}/render-mode",
        json={"render_mode": "server"},
    )
    assert resp.status_code == 403


def test_patch_render_mode_404_for_missing(client, db_session):
    resp = client.patch(
        f"/api/connections/{uuid.uuid4()}/render-mode",
        json={"render_mode": "server"},
    )
    assert resp.status_code == 404
