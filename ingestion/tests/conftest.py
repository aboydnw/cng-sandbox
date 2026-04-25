import json
import os
import tempfile
from contextlib import asynccontextmanager

import numpy as np
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from src.app import create_app
from src.config import Settings
from src.models.base import Base


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    from src.rate_limit import limiter

    limiter.reset()
    yield
    limiter.reset()


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
def app(db_engine):
    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
    )
    application = create_app(settings, lifespan=_noop_lifespan)
    application.state.db_session_factory = sessionmaker(bind=db_engine)
    return application


@pytest.fixture
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def client(app):
    return TestClient(
        app, raise_server_exceptions=False, headers={"X-Workspace-Id": "testABCD"}
    )


@pytest.fixture
def synthetic_geotiff():
    import rasterio
    from rasterio.transform import from_bounds

    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        path = f.name

    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_bounds(-10, -10, 10, 10, 64, 64),
        nodata=-9999.0,
    ) as dst:
        data = np.random.default_rng(42).standard_normal((64, 64)).astype(np.float32)
        dst.write(data, 1)

    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def synthetic_geojson():
    with tempfile.NamedTemporaryFile(suffix=".geojson", mode="w", delete=False) as f:
        geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [0.0, 0.0]},
                    "properties": {"name": "origin"},
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [1.0, 1.0]},
                    "properties": {"name": "northeast"},
                },
            ],
        }
        json.dump(geojson, f)
        path = f.name

    yield path
    if os.path.exists(path):
        os.unlink(path)
