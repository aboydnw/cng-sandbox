"""Tests for story access control — unpublished stories are private."""

from sqlalchemy.orm import sessionmaker


def test_unpublished_story_visible_to_owner(client):
    resp = client.post(
        "/api/stories",
        json={"title": "Draft", "chapters": [], "published": False},
    )
    assert resp.status_code == 201
    story_id = resp.json()["id"]

    resp = client.get(f"/api/stories/{story_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Draft"


def test_unpublished_story_hidden_from_other_workspace(client, app):
    resp = client.post(
        "/api/stories",
        json={"title": "Secret", "chapters": [], "published": False},
    )
    story_id = resp.json()["id"]

    from starlette.testclient import TestClient

    other = TestClient(app, headers={"X-Workspace-Id": "otherWS1"})
    resp = other.get(f"/api/stories/{story_id}")
    assert resp.status_code == 404


def test_unpublished_story_hidden_without_workspace(client, app):
    resp = client.post(
        "/api/stories",
        json={"title": "Secret", "chapters": [], "published": False},
    )
    story_id = resp.json()["id"]

    from starlette.testclient import TestClient

    anon = TestClient(app)
    resp = anon.get(f"/api/stories/{story_id}")
    assert resp.status_code == 404


def test_published_story_visible_to_anyone(client, app):
    resp = client.post(
        "/api/stories",
        json={"title": "Public", "chapters": [], "published": True},
    )
    story_id = resp.json()["id"]

    from starlette.testclient import TestClient

    anon = TestClient(app)
    resp = anon.get(f"/api/stories/{story_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Public"


def test_published_story_visible_to_other_workspace(client, app):
    resp = client.post(
        "/api/stories",
        json={"title": "Shared", "chapters": [], "published": True},
    )
    story_id = resp.json()["id"]

    from starlette.testclient import TestClient

    other = TestClient(app, headers={"X-Workspace-Id": "otherWS2"})
    resp = other.get(f"/api/stories/{story_id}")
    assert resp.status_code == 200
