from contextlib import asynccontextmanager

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from src.app import create_app
from src.config import Settings
from src.models.story import Base


@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest.fixture
def app(db_engine):
    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
    )
    application = create_app(settings, lifespan=_noop_lifespan)
    application.state.db_session_factory = sessionmaker(bind=db_engine)
    return application


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def test_stories_table_created(db_engine):
    inspector = inspect(db_engine)
    assert "stories" in inspector.get_table_names()


def test_create_story(client):
    resp = client.post("/api/stories", json={
        "title": "My Story",
        "dataset_id": "ds-123",
        "chapters": [{
            "id": "ch-1",
            "order": 0,
            "title": "Chapter 1",
            "narrative": "Hello world",
            "map_state": {"center": [0, 0], "zoom": 2, "bearing": 0, "pitch": 0, "basemap": "streets"},
            "transition": "fly-to",
        }],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Story"
    assert data["dataset_id"] == "ds-123"
    assert len(data["chapters"]) == 1
    assert "id" in data


def test_get_story(client):
    create_resp = client.post("/api/stories", json={
        "title": "Test", "dataset_id": "ds-1", "chapters": [],
    })
    story_id = create_resp.json()["id"]
    resp = client.get(f"/api/stories/{story_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test"


def test_get_story_not_found(client):
    resp = client.get("/api/stories/nonexistent")
    assert resp.status_code == 404


def test_list_stories(client):
    client.post("/api/stories", json={"title": "A", "dataset_id": "ds-1", "chapters": []})
    client.post("/api/stories", json={"title": "B", "dataset_id": "ds-2", "chapters": []})
    resp = client.get("/api/stories")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_story(client):
    create_resp = client.post("/api/stories", json={
        "title": "Old", "dataset_id": "ds-1", "chapters": [],
    })
    story_id = create_resp.json()["id"]
    resp = client.patch(f"/api/stories/{story_id}", json={"title": "New"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New"


def test_delete_story(client):
    create_resp = client.post("/api/stories", json={
        "title": "Doomed", "dataset_id": "ds-1", "chapters": [],
    })
    story_id = create_resp.json()["id"]
    resp = client.delete(f"/api/stories/{story_id}")
    assert resp.status_code == 204
    assert client.get(f"/api/stories/{story_id}").status_code == 404
