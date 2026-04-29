"""Tests for GET /api/stories/{id}/export/config endpoint."""

from datetime import UTC, datetime

from src.models.story import StoryRow


def test_export_config_returns_cng_rc_json(client):
    create_resp = client.post(
        "/api/stories",
        json={
            "title": "Test",
            "description": "Desc",
            "chapters": [
                {"id": "c1", "type": "prose", "title": "Hi", "narrative": "Text", "order": 0}
            ],
            "published": True,
        },
    )
    assert create_resp.status_code == 201
    story_id = create_resp.json()["id"]

    resp = client.get(f"/api/stories/{story_id}/export/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"] == "1"
    assert body["origin"]["story_id"] == story_id
    assert body["metadata"]["title"] == "Test"
    assert len(body["chapters"]) == 1


def test_export_config_404_for_unowned_unpublished(client, app):
    create_resp = client.post(
        "/api/stories",
        json={"title": "Draft", "description": "", "chapters": [], "published": False},
    )
    story_id = create_resp.json()["id"]

    other = client.__class__(app, headers={"X-Workspace-Id": "otherWS01"})
    resp = other.get(f"/api/stories/{story_id}/export/config")
    assert resp.status_code == 404


def test_export_config_visible_to_non_owners_if_example(client, app, db_session):
    now = datetime.now(UTC)
    db_session.add(
        StoryRow(
            id="example-1",
            title="Example",
            description="",
            chapters_json="[]",
            published=False,
            is_example=True,
            created_at=now,
            updated_at=now,
            workspace_id="ownerWS01",
        )
    )
    db_session.commit()

    other = client.__class__(app, headers={"X-Workspace-Id": "otherWS01"})
    resp = other.get("/api/stories/example-1/export/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"] == "1"
    assert body["metadata"]["title"] == "Example"
