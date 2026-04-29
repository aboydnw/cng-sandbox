"""Tests for GET /api/stories/{id}/export/config endpoint."""


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
