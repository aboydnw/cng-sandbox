import json
import uuid

from src.models.dataset import DatasetRow
from src.models.story import StoryRow


def _seed_master(app):
    session = app.state.db_session_factory()
    try:
        ds = DatasetRow(
            id=str(uuid.uuid4()),
            filename="m.tif",
            dataset_type="cog",
            format_pair="geotiff_cog",
            tile_url="/cog/tiles/master",
            metadata_json="{}",
            is_example=True,
        )
        session.add(ds)
        story = StoryRow(
            id=str(uuid.uuid4()),
            title="Master",
            dataset_id=ds.id,
            chapters_json=json.dumps([]),
            is_example=True,
        )
        session.add(story)
        session.commit()
        return story.id
    finally:
        session.close()


def test_get_state_defaults_none(client):
    resp = client.get("/api/workspaces/testABCD/examples")
    assert resp.status_code == 200
    assert resp.json()["state"] == "none"


def test_post_seeds_and_returns_story_map(client, app):
    master_story_id = _seed_master(app)
    resp = client.post("/api/workspaces/testABCD/examples")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["state"] == "seeded"
    assert master_story_id in body["story_id_map"]


def test_delete_removes(client, app):
    _seed_master(app)
    client.post("/api/workspaces/testABCD/examples")
    resp = client.delete("/api/workspaces/testABCD/examples")
    assert resp.status_code == 200, resp.text
    assert resp.json()["state"] == "removed"
    assert resp.json()["deleted"] > 0
    assert client.get("/api/workspaces/testABCD/examples").json()["state"] == "removed"

    session = app.state.db_session_factory()
    try:
        remaining = (
            session.query(StoryRow)
            .filter(
                StoryRow.workspace_id == "testABCD",
                StoryRow.is_example_copy.is_(True),
            )
            .count()
        )
        assert remaining == 0
    finally:
        session.close()
