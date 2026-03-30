"""Tests for the shared reproject_to_cog function."""

import os
import tempfile

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_bounds
from rio_cogeo import cog_validate

import pytest


def _make_geotiff(path, crs, bounds, width=64, height=64, nodata=-9999.0):
    """Create a synthetic single-band GeoTIFF."""
    transform = from_bounds(*bounds, width, height)
    rng = np.random.default_rng(42)
    data = rng.standard_normal((height, width)).astype(np.float32)
    data[0:5, 0:5] = nodata
    with rasterio.open(
        path, "w", driver="GTiff",
        width=width, height=height, count=1, dtype="float32",
        crs=crs, transform=transform, nodata=nodata,
    ) as dst:
        dst.write(data, 1)


@pytest.fixture
def tmp_dir():
    with tempfile.TemporaryDirectory() as d:
        yield d


def test_passthrough_4326(tmp_dir):
    input_path = os.path.join(tmp_dir, "input.tif")
    output_path = os.path.join(tmp_dir, "output.tif")
    _make_geotiff(input_path, CRS.from_epsg(4326), (-10, -10, 10, 10))

    from cng_shared import reproject_to_cog
    reproject_to_cog(input_path, output_path, verbose=True)

    is_valid, _, _ = cog_validate(output_path)
    assert is_valid

    with rasterio.open(output_path) as dst:
        assert dst.crs.to_epsg() == 4326
        assert dst.width == 64
        assert dst.height == 64


def test_reproject_epsg5070(tmp_dir):
    input_path = os.path.join(tmp_dir, "input.tif")
    output_path = os.path.join(tmp_dir, "output.tif")
    _make_geotiff(input_path, CRS.from_epsg(5070),
                  (1000000, 1500000, 1100000, 1600000))

    from cng_shared import reproject_to_cog
    reproject_to_cog(input_path, output_path, verbose=True)

    is_valid, _, _ = cog_validate(output_path)
    assert is_valid

    with rasterio.open(output_path) as dst:
        assert dst.crs.to_epsg() == 4326
        b = dst.bounds
        assert -180 <= b.left <= 180
        assert -90 <= b.bottom <= 90


def test_reproject_epsg32618(tmp_dir):
    input_path = os.path.join(tmp_dir, "input.tif")
    output_path = os.path.join(tmp_dir, "output.tif")
    _make_geotiff(input_path, CRS.from_epsg(32618),
                  (500000, 4400000, 600000, 4500000))

    from cng_shared import reproject_to_cog
    reproject_to_cog(input_path, output_path, verbose=True)

    with rasterio.open(output_path) as dst:
        assert dst.crs.to_epsg() == 4326


def test_nodata_preserved(tmp_dir):
    input_path = os.path.join(tmp_dir, "input.tif")
    output_path = os.path.join(tmp_dir, "output.tif")
    _make_geotiff(input_path, CRS.from_epsg(5070),
                  (1000000, 1500000, 1100000, 1600000), nodata=-9999.0)

    from cng_shared import reproject_to_cog
    reproject_to_cog(input_path, output_path)

    with rasterio.open(output_path) as dst:
        assert dst.nodata == -9999.0


def test_bilinear_resampling(tmp_dir):
    input_path = os.path.join(tmp_dir, "input.tif")
    output_path = os.path.join(tmp_dir, "output.tif")
    _make_geotiff(input_path, CRS.from_epsg(5070),
                  (1000000, 1500000, 1100000, 1600000))

    from cng_shared import reproject_to_cog
    reproject_to_cog(input_path, output_path, resampling="bilinear")

    with rasterio.open(output_path) as dst:
        assert dst.crs.to_epsg() == 4326
