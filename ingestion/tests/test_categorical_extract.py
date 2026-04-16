import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from src.services.categorical_extract import (
    TooManyValues,
    UnsupportedDtype,
    extract_unique_values,
)


def _write_raster(path, data, nodata=None):
    height, width = data.shape
    transform = from_bounds(0, 0, 1, 1, width, height)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=width,
        height=height,
        count=1,
        dtype=data.dtype,
        transform=transform,
        crs="EPSG:4326",
        nodata=nodata,
    ) as dst:
        dst.write(data, 1)


def test_extract_returns_sorted_unique_integers(tmp_path):
    path = str(tmp_path / "r.tif")
    data = np.array([[3, 1, 2], [1, 2, 3]], dtype="uint8")
    _write_raster(path, data)
    assert extract_unique_values(path) == [1, 2, 3]


def test_extract_excludes_nodata(tmp_path):
    path = str(tmp_path / "r.tif")
    data = np.array([[0, 1, 2], [1, 2, 3]], dtype="uint8")
    _write_raster(path, data, nodata=0)
    assert extract_unique_values(path) == [1, 2, 3]


def test_extract_rejects_float_dtype(tmp_path):
    path = str(tmp_path / "r.tif")
    data = np.array([[0.1, 0.2]], dtype="float32")
    _write_raster(path, data)
    with pytest.raises(UnsupportedDtype):
        extract_unique_values(path)


def test_extract_rejects_too_many_values(tmp_path):
    path = str(tmp_path / "r.tif")
    data = np.arange(40, dtype="uint8").reshape(4, 10)
    _write_raster(path, data)
    with pytest.raises(TooManyValues) as exc:
        extract_unique_values(path)
    assert exc.value.count == 40


def test_extract_handles_large_raster_via_windowed_read(tmp_path):
    path = str(tmp_path / "r.tif")
    data = np.tile(np.array([1, 2, 3, 4, 5], dtype="uint8"), (2000, 400))
    _write_raster(path, data)
    assert extract_unique_values(path) == [1, 2, 3, 4, 5]
