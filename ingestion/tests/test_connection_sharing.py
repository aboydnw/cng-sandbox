import json

from starlette.testclient import TestClient

from src.models.connection import ConnectionRow
from src.models.story import StoryRow


def _make_connection(db_session, **kwargs):
    defaults = dict(
        id=kwargs.pop("id", "c1"),
        name="X",
        url="https://example.com/x.pmtiles",
        connection_type="pmtiles",
        workspace_id=kwargs.pop("workspace_id", "ownerWSAA"),
    )
    defaults.update(kwargs)
    row = ConnectionRow(**defaults)
    db_session.add(row)
    db_session.commit()
    return row


def test_owner_can_get_private_connection(client, db_session):
    _make_connection(db_session, id="c1", workspace_id="testABCD")
    resp = client.get("/api/connections/c1")
    assert resp.status_code == 200
    assert resp.json()["is_shared"] is False


def test_anonymous_cannot_get_private_connection(app, db_session):
    _make_connection(db_session, id="c1", workspace_id="ownerWSAA")
    anon = TestClient(app)
    resp = anon.get("/api/connections/c1")
    assert resp.status_code == 404


def test_anonymous_can_get_shared_connection(app, db_session):
    _make_connection(db_session, id="c1", workspace_id="ownerWSAA", is_shared=True)
    anon = TestClient(app)
    resp = anon.get("/api/connections/c1")
    assert resp.status_code == 200


def test_anonymous_can_get_connection_referenced_by_published_story(app, db_session):
    _make_connection(db_session, id="c1", workspace_id="ownerWSAA")
    chapters = [
        {
            "id": "ch1",
            "order": 0,
            "type": "scrollytelling",
            "title": "C",
            "narrative": "",
            "map_state": {},
            "transition": "fly-to",
            "overlay_position": "left",
            "layer_config": {"connection_id": "c1"},
        }
    ]
    db_session.add(
        StoryRow(
            id="s1",
            title="S",
            chapters_json=json.dumps(chapters),
            published=True,
            workspace_id="ownerWSAA",
        )
    )
    db_session.commit()
    anon = TestClient(app)
    resp = anon.get("/api/connections/c1")
    assert resp.status_code == 200


def test_owner_can_share_connection(client, db_session):
    _make_connection(db_session, id="c1", workspace_id="testABCD")
    resp = client.patch("/api/connections/c1/share", json={"is_shared": True})
    assert resp.status_code == 200
    assert resp.json()["is_shared"] is True


def test_owner_can_unshare_connection(client, db_session):
    _make_connection(db_session, id="c1", workspace_id="testABCD", is_shared=True)
    resp = client.patch("/api/connections/c1/share", json={"is_shared": False})
    assert resp.status_code == 200
    assert resp.json()["is_shared"] is False


def test_non_owner_cannot_share_connection(app, db_session):
    _make_connection(db_session, id="c1", workspace_id="ownerWSAA")
    other = TestClient(app, headers={"X-Workspace-Id": "otherWSB"})
    resp = other.patch("/api/connections/c1/share", json={"is_shared": True})
    assert resp.status_code == 403


def test_stream_accessible_without_workspace_auth(app, db_session):
    # Browser EventSource can't send custom headers, so /stream is intentionally
    # UUID-gated only. An anonymous client (no x-workspace-id) must be able to
    # subscribe to a private connection's conversion status stream.
    _make_connection(
        db_session,
        id="c1",
        workspace_id="ownerWSAA",
        conversion_status="ready",
    )
    anon = TestClient(app)
    with anon.stream("GET", "/api/connections/c1/stream") as resp:
        assert resp.status_code == 200


def test_anonymous_can_stream_shared_connection(app, db_session):
    _make_connection(
        db_session,
        id="c1",
        workspace_id="ownerWSAA",
        is_shared=True,
        conversion_status="ready",
    )
    anon = TestClient(app)
    with anon.stream("GET", "/api/connections/c1/stream") as resp:
        assert resp.status_code == 200
