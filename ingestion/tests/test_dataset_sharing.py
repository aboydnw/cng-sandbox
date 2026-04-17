import json

from starlette.testclient import TestClient

from src.models.dataset import DatasetRow
from src.models.story import StoryRow


def _make_dataset(db_session, **kwargs):
    defaults = dict(
        id=kwargs.pop("id", "d1"),
        filename="x.tif",
        dataset_type="raster",
        format_pair="geotiff_to_cog",
        tile_url="/raster/x",
        workspace_id=kwargs.pop("workspace_id", "ownerWSAA"),
    )
    defaults.update(kwargs)
    row = DatasetRow(**defaults)
    db_session.add(row)
    db_session.commit()
    return row


def test_owner_can_get_private_dataset(client, db_session):
    _make_dataset(db_session, id="d1", workspace_id="testABCD")
    resp = client.get("/api/datasets/d1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "d1"
    assert body["is_shared"] is False


def test_anonymous_cannot_get_private_dataset(app, db_session):
    _make_dataset(db_session, id="d1", workspace_id="ownerWSAA")
    anon = TestClient(app)
    resp = anon.get("/api/datasets/d1")
    assert resp.status_code == 404


def test_anonymous_can_get_shared_dataset(app, db_session):
    _make_dataset(db_session, id="d1", workspace_id="ownerWSAA", is_shared=True)
    anon = TestClient(app)
    resp = anon.get("/api/datasets/d1")
    assert resp.status_code == 200


def test_anonymous_can_get_dataset_referenced_by_published_story(app, db_session):
    _make_dataset(db_session, id="d1", workspace_id="ownerWSAA")
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
            "layer_config": {"dataset_id": "d1"},
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
    resp = anon.get("/api/datasets/d1")
    assert resp.status_code == 200


def test_owner_can_share_dataset(client, db_session):
    _make_dataset(db_session, id="d1", workspace_id="testABCD")
    resp = client.patch("/api/datasets/d1/share", json={"is_shared": True})
    assert resp.status_code == 200
    assert resp.json()["is_shared"] is True


def test_owner_can_unshare_dataset(client, db_session):
    _make_dataset(db_session, id="d1", workspace_id="testABCD", is_shared=True)
    resp = client.patch("/api/datasets/d1/share", json={"is_shared": False})
    assert resp.status_code == 200
    assert resp.json()["is_shared"] is False


def test_non_owner_cannot_share_dataset(app, db_session):
    _make_dataset(db_session, id="d1", workspace_id="ownerWSAA")
    other = TestClient(app, headers={"X-Workspace-Id": "otherWSB"})
    resp = other.patch("/api/datasets/d1/share", json={"is_shared": True})
    assert resp.status_code == 403


def test_example_dataset_cannot_be_shared_or_unshared(client, db_session):
    _make_dataset(
        db_session,
        id="d1",
        workspace_id=None,
        is_example=True,
    )
    resp = client.patch("/api/datasets/d1/share", json={"is_shared": True})
    assert resp.status_code == 403
