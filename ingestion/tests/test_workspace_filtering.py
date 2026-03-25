import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.app import create_app
from src.models.base import Base
from src.models.dataset import DatasetRow
from src.models.story import StoryRow


@pytest.fixture
def db_session_factory(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture
def client(db_session_factory):
    async def noop_lifespan(app):
        yield

    app = create_app(lifespan=noop_lifespan)
    app.state.db_engine = db_session_factory.kw["bind"]
    app.state.db_session_factory = db_session_factory

    return TestClient(app)


@pytest.fixture
def seed_data(client, db_session_factory):
    session = db_session_factory()

    ds_a = DatasetRow(
        id="ds-a", filename="a.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/a",
        workspace_id="aaaaaaaa",
    )
    ds_b = DatasetRow(
        id="ds-b", filename="b.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/b",
        workspace_id="bbbbbbbb",
    )
    ds_orphan = DatasetRow(
        id="ds-orphan", filename="orphan.tif", dataset_type="raster",
        format_pair="geotiff-to-cog", tile_url="/tiles/orphan",
        workspace_id=None,
    )
    session.add_all([ds_a, ds_b, ds_orphan])

    st_a = StoryRow(id="st-a", title="Story A", workspace_id="aaaaaaaa")
    st_b = StoryRow(id="st-b", title="Story B", workspace_id="bbbbbbbb")
    session.add_all([st_a, st_b])

    session.commit()
    session.close()


def test_list_datasets_filtered_by_workspace(client, seed_data):
    resp = client.get("/api/datasets", headers={"X-Workspace-Id": "aaaaaaaa"})
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()]
    assert "ds-a" in ids
    assert "ds-b" not in ids
    assert "ds-orphan" not in ids


def test_list_datasets_no_header_returns_empty(client, seed_data):
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_dataset_by_id_ignores_workspace(client, seed_data):
    resp = client.get("/api/datasets/ds-b", headers={"X-Workspace-Id": "aaaaaaaa"})
    assert resp.status_code == 200
    assert resp.json()["id"] == "ds-b"


def test_delete_dataset_wrong_workspace_returns_403(client, seed_data):
    resp = client.delete("/api/datasets/ds-a", headers={"X-Workspace-Id": "bbbbbbbb"})
    assert resp.status_code == 403


def test_delete_dataset_no_header_returns_400(client, seed_data):
    resp = client.delete("/api/datasets/ds-a")
    assert resp.status_code == 400


def test_list_stories_filtered_by_workspace(client, seed_data):
    resp = client.get("/api/stories", headers={"X-Workspace-Id": "aaaaaaaa"})
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert "st-a" in ids
    assert "st-b" not in ids


def test_create_story_stores_workspace(client, seed_data):
    resp = client.post(
        "/api/stories",
        json={"title": "New"},
        headers={"X-Workspace-Id": "aaaaaaaa"},
    )
    assert resp.status_code == 201
    story_id = resp.json()["id"]

    resp2 = client.get("/api/stories", headers={"X-Workspace-Id": "aaaaaaaa"})
    ids = [s["id"] for s in resp2.json()]
    assert story_id in ids


def test_patch_story_wrong_workspace_returns_403(client, seed_data):
    resp = client.patch(
        "/api/stories/st-a",
        json={"title": "Hacked"},
        headers={"X-Workspace-Id": "bbbbbbbb"},
    )
    assert resp.status_code == 403


def test_delete_story_wrong_workspace_returns_403(client, seed_data):
    resp = client.delete("/api/stories/st-a", headers={"X-Workspace-Id": "bbbbbbbb"})
    assert resp.status_code == 403
