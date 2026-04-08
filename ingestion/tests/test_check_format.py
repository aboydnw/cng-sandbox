import json
import os
import tempfile

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from starlette.testclient import TestClient

from src.app import create_app
from src.config import Settings


@pytest.fixture
def client():
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _noop_lifespan(app):
        yield

    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
    )
    app = create_app(settings=settings, lifespan=_noop_lifespan)
    with TestClient(app, headers={"X-Workspace-Id": "testABCD"}) as c:
        yield c


@pytest.fixture
def valid_geotiff_bytes():
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        path = f.name
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64, count=1,
        dtype="float32", crs="EPSG:4326",
        transform=from_bounds(-10, -10, 10, 10, 64, 64),
    ) as dst:
        dst.write(np.zeros((64, 64), dtype=np.float32), 1)
    with open(path, "rb") as f:
        data = f.read()
    os.unlink(path)
    return data


def test_check_format_valid_geotiff(client, valid_geotiff_bytes):
    resp = client.post(
        "/api/check-format",
        files={"chunk": ("chunk", valid_geotiff_bytes)},
        data={"filename": "test.tif"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_check_format_invalid_magic_bytes(client):
    resp = client.post(
        "/api/check-format",
        files={"chunk": ("chunk", b"this is not a geotiff")},
        data={"filename": "fake.tif"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is False
    assert "does not match" in body["error"]


def test_check_format_unsupported_extension(client):
    resp = client.post(
        "/api/check-format",
        files={"chunk": ("chunk", b"data")},
        data={"filename": "data.xlsx"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is False
    assert "Unsupported" in body["error"]


def test_check_format_valid_geojson(client):
    geojson = json.dumps({
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [0.0, 0.0]},
                "properties": {"name": "test"},
            }
        ],
    }).encode()
    resp = client.post(
        "/api/check-format",
        files={"chunk": ("chunk", geojson)},
        data={"filename": "test.geojson"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True
