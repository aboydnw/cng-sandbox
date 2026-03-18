import os
import json
import tempfile

import numpy as np
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from src.app import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def synthetic_geotiff():
    """Generate a small synthetic GeoTIFF for testing."""
    import rasterio
    from rasterio.transform import from_bounds

    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        path = f.name

    with rasterio.open(
        path, "w", driver="GTiff",
        width=64, height=64, count=1, dtype="float32",
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
    """Generate a small synthetic GeoJSON for testing."""
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
