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


@pytest.fixture(autouse=True)
def _r2_public_url(monkeypatch):
    monkeypatch.setenv("R2_PUBLIC_URL", "https://r2.example")


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
def seeded_story_with_prose_chapter(client):
    resp = client.post(
        "/api/stories",
        json={
            "title": "Prose Story",
            "description": "Prose desc",
            "chapters": [
                {
                    "id": "ch-prose",
                    "order": 0,
                    "type": "prose",
                    "title": "Hello",
                    "narrative": "hello",
                }
            ],
            "published": True,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.fixture
def seeded_story_with_chart_chapter(client):
    resp = client.post(
        "/api/stories",
        json={
            "title": "Chart Story",
            "description": "",
            "chapters": [
                {
                    "id": "ch-chart",
                    "order": 0,
                    "type": "chart",
                    "title": "Yearly",
                    "narrative": "",
                    "chart": {
                        "source": {
                            "kind": "csv",
                            "asset_id": "asset-x",
                            "url": "https://example.test/x.csv",
                            "columns": ["year", "v"],
                        },
                        "viz": {
                            "kind": "line",
                            "x_field": "year",
                            "y_fields": ["v"],
                            "series_field": None,
                            "x_label": "Year",
                            "y_label": "Value",
                            "y_scale": "linear",
                        },
                    },
                }
            ],
            "published": True,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.fixture
def seeded_story_with_scrolly_chapter(client):
    resp = client.post(
        "/api/stories",
        json={
            "title": "Scrolly Story",
            "description": "",
            "chapters": [
                {
                    "id": "ch-scrolly",
                    "order": 0,
                    "type": "scrollytelling",
                    "title": "Scroll",
                    "narrative": "story narrative",
                    "map_state": {
                        "center": [0.0, 0.0],
                        "zoom": 1.0,
                        "bearing": 0.0,
                        "pitch": 0.0,
                        "basemap": "voyager",
                    },
                    "layer_config": {
                        "dataset_id": "ds-x",
                        "colormap": "viridis",
                        "opacity": 1.0,
                        "basemap": "voyager",
                    },
                }
            ],
            "published": True,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


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
