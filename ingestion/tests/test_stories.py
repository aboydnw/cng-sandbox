import pytest
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


def test_stories_table_created(db_engine):
    inspector = inspect(db_engine)
    assert "stories" in inspector.get_table_names()


def test_create_story(client):
    resp = client.post(
        "/api/stories",
        json={
            "title": "My Story",
            "dataset_id": "ds-123",
            "chapters": [
                {
                    "id": "ch-1",
                    "order": 0,
                    "title": "Chapter 1",
                    "narrative": "Hello world",
                    "map_state": {
                        "center": [0, 0],
                        "zoom": 2,
                        "bearing": 0,
                        "pitch": 0,
                        "basemap": "streets",
                    },
                    "transition": "fly-to",
                }
            ],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Story"
    assert data["dataset_id"] == "ds-123"
    assert len(data["chapters"]) == 1
    assert "id" in data


def test_get_story(client):
    create_resp = client.post(
        "/api/stories",
        json={
            "title": "Test",
            "dataset_id": "ds-1",
            "chapters": [],
        },
    )
    story_id = create_resp.json()["id"]
    resp = client.get(f"/api/stories/{story_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test"


def test_get_story_not_found(client):
    resp = client.get("/api/stories/nonexistent")
    assert resp.status_code == 404


def test_list_stories(client):
    client.post(
        "/api/stories", json={"title": "A", "dataset_id": "ds-1", "chapters": []}
    )
    client.post(
        "/api/stories", json={"title": "B", "dataset_id": "ds-2", "chapters": []}
    )
    resp = client.get("/api/stories")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_story(client):
    create_resp = client.post(
        "/api/stories",
        json={
            "title": "Old",
            "dataset_id": "ds-1",
            "chapters": [],
        },
    )
    story_id = create_resp.json()["id"]
    resp = client.patch(f"/api/stories/{story_id}", json={"title": "New"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New"


def test_delete_story(client):
    create_resp = client.post(
        "/api/stories",
        json={
            "title": "Doomed",
            "dataset_id": "ds-1",
            "chapters": [],
        },
    )
    story_id = create_resp.json()["id"]
    resp = client.delete(f"/api/stories/{story_id}")
    assert resp.status_code == 204
    assert client.get(f"/api/stories/{story_id}").status_code == 404


def test_response_includes_dataset_ids(client):
    resp = client.post(
        "/api/stories",
        json={
            "title": "Multi",
            "dataset_id": "ds-primary",
            "chapters": [
                {
                    "id": "ch-1",
                    "order": 0,
                    "title": "Ch1",
                    "narrative": "",
                    "map_state": {},
                    "transition": "fly-to",
                    "layer_config": {
                        "dataset_id": "ds-1",
                        "colormap": "viridis",
                        "opacity": 0.8,
                        "basemap": "streets",
                    },
                },
                {
                    "id": "ch-2",
                    "order": 1,
                    "title": "Ch2",
                    "narrative": "",
                    "map_state": {},
                    "transition": "fly-to",
                    "layer_config": {
                        "dataset_id": "ds-2",
                        "colormap": "plasma",
                        "opacity": 0.6,
                        "basemap": "dark",
                    },
                },
            ],
        },
    )
    data = resp.json()
    assert "dataset_ids" in data
    assert sorted(data["dataset_ids"]) == ["ds-1", "ds-2"]


def test_create_story_without_dataset_id(client):
    resp = client.post(
        "/api/stories",
        json={
            "title": "No Dataset",
            "chapters": [],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["dataset_ids"] == []
    assert data["dataset_id"] is None


def test_dataset_ids_falls_back_to_dataset_id(client):
    resp = client.post(
        "/api/stories",
        json={
            "title": "Old-style",
            "dataset_id": "ds-only",
            "chapters": [
                {
                    "id": "ch-1",
                    "order": 0,
                    "title": "Ch1",
                    "narrative": "",
                    "map_state": {},
                    "transition": "fly-to",
                },
            ],
        },
    )
    data = resp.json()
    assert data["dataset_ids"] == ["ds-only"]
