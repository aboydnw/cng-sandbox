from contextlib import asynccontextmanager

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from src.app import create_app
from src.config import Settings
from src.models.base import Base
from src.models.dataset import DatasetRow


@asynccontextmanager
async def _noop_lifespan(app):
    yield


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
def client(db_engine):
    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
    )
    app = create_app(settings, lifespan=_noop_lifespan)
    app.state.db_session_factory = sessionmaker(bind=db_engine)
    return TestClient(
        app, raise_server_exceptions=False, headers={"X-Workspace-Id": "testABCD"}
    )


@pytest.fixture
def seed_dataset(db_engine):
    session = sessionmaker(bind=db_engine)()
    row = DatasetRow(
        id="existing-123",
        filename="elevation.tif",
        dataset_type="raster",
        format_pair="geotiff_cog",
        tile_url="/raster/tiles",
        workspace_id="testABCD",
    )
    session.add(row)
    session.commit()
    session.close()


def test_upload_duplicate_returns_409(client, seed_dataset):
    resp = client.post(
        "/api/upload",
        files={"file": ("elevation.tif", b"fake content", "image/tiff")},
    )
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"] == "duplicate_dataset"
    assert data["dataset_id"] == "existing-123"
    assert data["filename"] == "elevation.tif"


def test_upload_unique_filename_succeeds(client, seed_dataset, monkeypatch):
    monkeypatch.setattr("src.routes.upload.run_pipeline", _fake_pipeline)
    resp = client.post(
        "/api/upload",
        files={"file": ("other.tif", b"fake content", "image/tiff")},
    )
    assert resp.status_code == 200


def test_upload_same_filename_different_workspace(client, seed_dataset, monkeypatch):
    monkeypatch.setattr("src.routes.upload.run_pipeline", _fake_pipeline)
    other_client = TestClient(
        client.app,
        raise_server_exceptions=False,
        headers={"X-Workspace-Id": "othrABCD"},
    )
    resp = other_client.post(
        "/api/upload",
        files={"file": ("elevation.tif", b"fake content", "image/tiff")},
    )
    assert resp.status_code == 200


def test_convert_url_duplicate_returns_409(client, seed_dataset):
    resp = client.post(
        "/api/convert-url",
        json={"url": "https://example.com/path/elevation.tif"},
    )
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"] == "duplicate_dataset"
    assert data["dataset_id"] == "existing-123"
    assert data["filename"] == "elevation.tif"


def test_check_duplicate_returns_409(client, seed_dataset):
    resp = client.get("/api/check-duplicate", params={"filename": "elevation.tif"})
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"] == "duplicate_dataset"
    assert data["dataset_id"] == "existing-123"


def test_check_duplicate_returns_ok(client, seed_dataset):
    resp = client.get("/api/check-duplicate", params={"filename": "other.tif"})
    assert resp.status_code == 200
    assert resp.json()["duplicate"] is False


async def _fake_pipeline(job, input_path, db_session_factory):
    pass
