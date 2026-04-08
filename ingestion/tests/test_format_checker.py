import json
import os
import tempfile

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from src.services.format_checker import check_format


@pytest.fixture
def valid_geotiff():
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
    ) as dst:
        dst.write(np.zeros((64, 64), dtype=np.float32), 1)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def geotiff_no_crs():
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
        transform=from_bounds(-10, -10, 10, 10, 64, 64),
    ) as dst:
        dst.write(np.zeros((64, 64), dtype=np.float32), 1)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def valid_geojson():
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [0.0, 0.0]},
                "properties": {"name": "test"},
            }
        ],
    }
    with tempfile.NamedTemporaryFile(suffix=".geojson", mode="w", delete=False) as f:
        json.dump(geojson, f)
        path = f.name
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def not_a_tiff():
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"this is a PDF pretending to be a TIFF")
        path = f.name
    yield path
    if os.path.exists(path):
        os.unlink(path)


def test_valid_geotiff(valid_geotiff):
    result = check_format(valid_geotiff, "test.tif")
    assert result["valid"] is True


def test_geotiff_missing_crs(geotiff_no_crs):
    result = check_format(geotiff_no_crs, "test.tif")
    assert result["valid"] is False
    assert "coordinate reference system" in result["error"].lower()


def test_valid_geojson(valid_geojson):
    result = check_format(valid_geojson, "test.geojson")
    assert result["valid"] is True


def test_magic_bytes_mismatch(not_a_tiff):
    result = check_format(not_a_tiff, "fake.tif")
    assert result["valid"] is False
    assert "does not match" in result["error"]


def test_unsupported_extension():
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
        f.write(b"fake")
        path = f.name
    try:
        result = check_format(path, "data.xlsx")
        assert result["valid"] is False
        assert "Unsupported" in result["error"]
    finally:
        os.unlink(path)
