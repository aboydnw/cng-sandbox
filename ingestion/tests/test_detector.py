import os
import tempfile

import pytest

from src.models import FormatPair
from src.services.detector import (
    UnsupportedFormatError,
    detect_format,
    validate_magic_bytes,
)


def test_detect_geotiff():
    assert detect_format("data.tif") == FormatPair.GEOTIFF_TO_COG
    assert detect_format("DATA.TIFF") == FormatPair.GEOTIFF_TO_COG


def test_detect_shapefile():
    assert detect_format("rivers.shp") == FormatPair.SHAPEFILE_TO_GEOPARQUET
    assert detect_format("rivers.zip") == FormatPair.SHAPEFILE_TO_GEOPARQUET


def test_detect_geojson():
    assert detect_format("points.geojson") == FormatPair.GEOJSON_TO_GEOPARQUET


def test_detect_netcdf():
    assert detect_format("sst.nc") == FormatPair.NETCDF_TO_COG


def test_detect_unsupported():
    with pytest.raises(UnsupportedFormatError):
        detect_format("data.xlsx")


def test_validate_magic_bytes_geojson():
    with tempfile.NamedTemporaryFile(suffix=".geojson", mode="w", delete=False) as f:
        f.write('{"type": "FeatureCollection", "features": []}')
        path = f.name
    try:
        validate_magic_bytes(path, FormatPair.GEOJSON_TO_GEOPARQUET)
    finally:
        os.unlink(path)


def test_validate_magic_bytes_netcdf4_hdf5():
    """NetCDF4 files are HDF5-based; libmagic reports application/x-hdf5."""
    nc_path = (
        "/home/anthony/projects/map-app-builder/sandbox/sample-data/air.mon.mean.nc"
    )
    if os.path.isfile(nc_path):
        validate_magic_bytes(nc_path, FormatPair.NETCDF_TO_COG)


def test_validate_magic_bytes_mismatch():
    with tempfile.NamedTemporaryFile(suffix=".tif", mode="w", delete=False) as f:
        f.write("this is not a tiff file")
        path = f.name
    try:
        with pytest.raises(UnsupportedFormatError, match="does not match"):
            validate_magic_bytes(path, FormatPair.GEOTIFF_TO_COG)
    finally:
        os.unlink(path)
