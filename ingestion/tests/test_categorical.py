import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from src.services.categorical import detect_categories


@pytest.fixture
def categorical_tif_with_colormap(tmp_path):
    path = str(tmp_path / "landcover.tif")
    data = np.array([[1, 2, 3], [4, 5, 1]], dtype="uint8")
    transform = from_bounds(0, 0, 1, 1, 3, 2)
    with rasterio.open(
        path, "w", driver="GTiff", width=3, height=2, count=1,
        dtype="uint8", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data, 1)
        dst.write_colormap(1, {
            1: (255, 0, 0, 255), 2: (0, 255, 0, 255), 3: (0, 0, 255, 255),
            4: (255, 255, 0, 255), 5: (128, 128, 128, 255),
        })
    return path


@pytest.fixture
def categorical_tif_no_colormap(tmp_path):
    path = str(tmp_path / "classes.tif")
    data = np.array([[1, 2, 3], [4, 5, 1]], dtype="uint8")
    transform = from_bounds(0, 0, 1, 1, 3, 2)
    with rasterio.open(
        path, "w", driver="GTiff", width=3, height=2, count=1,
        dtype="uint8", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data, 1)
    return path


@pytest.fixture
def continuous_float_tif(tmp_path):
    path = str(tmp_path / "elevation.tif")
    data = np.random.rand(64, 64).astype("float32")
    transform = from_bounds(0, 0, 1, 1, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64, count=1,
        dtype="float32", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data, 1)
    return path


@pytest.fixture
def continuous_int_many_values(tmp_path):
    path = str(tmp_path / "elevation_int.tif")
    data = np.arange(0, 64 * 64, dtype="int16").reshape(64, 64)
    transform = from_bounds(0, 0, 1, 1, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64, count=1,
        dtype="int16", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data, 1)
    return path


@pytest.fixture
def categorical_tif_with_nodata(tmp_path):
    path = str(tmp_path / "landcover_nodata.tif")
    data = np.array([[1, 2, 255], [3, 255, 1]], dtype="uint8")
    transform = from_bounds(0, 0, 1, 1, 3, 2)
    with rasterio.open(
        path, "w", driver="GTiff", width=3, height=2, count=1,
        dtype="uint8", crs="EPSG:4326", transform=transform, nodata=255,
    ) as dst:
        dst.write(data, 1)
    return path


def test_detects_colormap(categorical_tif_with_colormap):
    result = detect_categories(categorical_tif_with_colormap)
    assert result.is_categorical is True
    assert len(result.categories) == 5
    colors = {c.value: c.color for c in result.categories}
    assert colors[1] == "#FF0000"
    assert colors[2] == "#00FF00"


def test_colormap_labels_default_to_class_value(categorical_tif_with_colormap):
    result = detect_categories(categorical_tif_with_colormap)
    labels = {c.value: c.label for c in result.categories}
    assert labels[1] == "Class 1"
    assert labels[5] == "Class 5"


def test_heuristic_detects_few_unique_integers(categorical_tif_no_colormap):
    result = detect_categories(categorical_tif_no_colormap)
    assert result.is_categorical is True
    assert len(result.categories) == 5


def test_heuristic_skips_float(continuous_float_tif):
    result = detect_categories(continuous_float_tif)
    assert result.is_categorical is False


def test_heuristic_skips_many_unique_integers(continuous_int_many_values):
    result = detect_categories(continuous_int_many_values)
    assert result.is_categorical is False


def test_nodata_excluded_from_categories(categorical_tif_with_nodata):
    result = detect_categories(categorical_tif_with_nodata)
    assert result.is_categorical is True
    values = {c.value for c in result.categories}
    assert 255 not in values
    assert values == {1, 2, 3}


def test_multiband_raster_rejected(tmp_path):
    path = str(tmp_path / "rgb.tif")
    data = np.zeros((3, 4, 4), dtype="uint8")
    transform = from_bounds(0, 0, 1, 1, 4, 4)
    with rasterio.open(
        path, "w", driver="GTiff", width=4, height=4, count=3,
        dtype="uint8", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data)
    result = detect_categories(path)
    assert result.is_categorical is False


def test_uint8_without_colormap_many_values_not_categorical(tmp_path):
    path = str(tmp_path / "continuous_uint8.tif")
    data = np.arange(0, 64, dtype="uint8").repeat(64).reshape(64, 64)
    transform = from_bounds(0, 0, 1, 1, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64, count=1,
        dtype="uint8", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data, 1)
    result = detect_categories(path)
    assert result.is_categorical is False
