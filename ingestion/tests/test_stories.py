import json
from datetime import UTC, datetime

import pytest
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker

from src.models.story import StoryRow


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


def test_fork_example_story_copies_to_callers_workspace(client, db_session):
    now = datetime.now(UTC)
    original = StoryRow(
        id="example-1",
        title="Example",
        description="Desc",
        dataset_id="ds-1",
        chapters_json=json.dumps(
            [
                {
                    "id": "ch1",
                    "order": 0,
                    "type": "scrollytelling",
                    "title": "C1",
                    "narrative": "n",
                    "map_state": {},
                    "transition": "fly-to",
                    "overlay_position": "left",
                    "layer_config": None,
                }
            ]
        ),
        published=True,
        created_at=now,
        updated_at=now,
        workspace_id="system",
        is_example=True,
    )
    db_session.add(original)
    db_session.commit()

    resp = client.post("/api/stories/example-1/fork")
    assert resp.status_code == 200
    forked = resp.json()
    assert forked["id"] != "example-1"
    assert forked["title"] == "Example"
    assert len(forked["chapters"]) == 1
    assert forked["chapters"][0]["id"] == "ch1"


def test_fork_nonexistent_story_returns_404(client):
    resp = client.post("/api/stories/does-not-exist/fork")
    assert resp.status_code == 404


def test_fork_regular_story_from_other_workspace(client, db_session):
    now = datetime.now(UTC)
    original = StoryRow(
        id="regular-story",
        title="Regular",
        chapters_json="[]",
        published=False,
        created_at=now,
        updated_at=now,
        workspace_id="someone-else",
        is_example=False,
    )
    db_session.add(original)
    db_session.commit()

    resp = client.post("/api/stories/regular-story/fork")
    assert resp.status_code == 200
    forked = resp.json()
    assert forked["id"] != "regular-story"
    assert forked["title"] == "Regular"


def test_list_stories_includes_example_rows_from_other_workspaces(client, db_session):
    now = datetime.now(UTC)
    caller_ws = "testABCD"  # matches the client fixture header

    db_session.add(
        StoryRow(
            id="system-example",
            title="Example Story",
            chapters_json="[]",
            published=True,
            created_at=now,
            updated_at=now,
            workspace_id="system",
            is_example=True,
        )
    )
    db_session.add(
        StoryRow(
            id="caller-own",
            title="My Story",
            chapters_json="[]",
            published=False,
            created_at=now,
            updated_at=now,
            workspace_id=caller_ws,
            is_example=False,
        )
    )
    db_session.add(
        StoryRow(
            id="other-private",
            title="Private",
            chapters_json="[]",
            published=False,
            created_at=now,
            updated_at=now,
            workspace_id="someone-else",
            is_example=False,
        )
    )
    db_session.commit()

    resp = client.get("/api/stories")
    assert resp.status_code == 200
    ids = {s["id"] for s in resp.json()}
    assert "system-example" in ids
    assert "caller-own" in ids
    assert "other-private" not in ids


def test_list_stories_excludes_non_example_cross_workspace_rows(client, db_session):
    now = datetime.now(UTC)
    db_session.add(
        StoryRow(
            id="leak-candidate",
            title="Other",
            chapters_json="[]",
            published=True,  # Published but not example — still must not leak into list
            created_at=now,
            updated_at=now,
            workspace_id="someone-else",
            is_example=False,
        )
    )
    db_session.commit()

    resp = client.get("/api/stories")
    assert resp.status_code == 200
    ids = {s["id"] for s in resp.json()}
    assert "leak-candidate" not in ids


def test_patch_example_story_returns_403(client, db_session):
    now = datetime.now(UTC)
    db_session.add(
        StoryRow(
            id="example-patch",
            title="Example",
            chapters_json="[]",
            published=False,
            created_at=now,
            updated_at=now,
            workspace_id="testABCD",  # same as caller — so not a workspace 403
            is_example=True,
        )
    )
    db_session.commit()

    resp = client.patch("/api/stories/example-patch", json={"title": "Modified"})
    assert resp.status_code == 403


def test_delete_example_story_returns_403(client, db_session):
    now = datetime.now(UTC)
    db_session.add(
        StoryRow(
            id="example-delete",
            title="Example",
            chapters_json="[]",
            published=False,
            created_at=now,
            updated_at=now,
            workspace_id="testABCD",
            is_example=True,
        )
    )
    db_session.commit()

    resp = client.delete("/api/stories/example-delete")
    assert resp.status_code == 403


def test_fork_is_deep_copy_not_reference(client, db_session):
    """Mutating the original after forking must not change the forked copy."""
    now = datetime.now(UTC)
    original = StoryRow(
        id="deep-copy-src",
        title="Original",
        chapters_json=json.dumps(
            [{"id": "ch1", "order": 0, "title": "T", "narrative": "", "map_state": {}}]
        ),
        published=False,
        created_at=now,
        updated_at=now,
        workspace_id="other",
        is_example=False,
    )
    db_session.add(original)
    db_session.commit()

    resp = client.post("/api/stories/deep-copy-src/fork")
    assert resp.status_code == 200
    forked_id = resp.json()["id"]

    # Mutate the original
    original.title = "MUTATED"
    original.chapters_json = "[]"
    db_session.commit()

    # Forked copy should be unchanged
    get_resp = client.get(f"/api/stories/{forked_id}")
    # A forked copy is not published by default — but the caller IS the owner,
    # and the GET handler returns owner-owned stories regardless of published.
    assert get_resp.status_code == 200
    assert get_resp.json()["title"] == "Original"
    assert len(get_resp.json()["chapters"]) == 1
