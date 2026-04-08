import importlib
import json

import pytest
import rasterio.errors

from src.services.error_mapping import map_pipeline_error

_has_fiona = importlib.util.find_spec("fiona") is not None


def test_rasterio_io_error():
    exc = rasterio.errors.RasterioIOError("not a supported file format")
    msg = map_pipeline_error(exc)
    assert "Could not read this file as a raster" in msg


def test_crs_error():
    exc = rasterio.errors.CRSError("Invalid CRS")
    msg = map_pipeline_error(exc)
    assert "coordinate reference system" in msg.lower()


def test_json_decode_error():
    exc = json.JSONDecodeError("Expecting value", "", 0)
    msg = map_pipeline_error(exc)
    assert "not valid JSON" in msg


def test_unknown_error_passes_through():
    exc = RuntimeError("something completely unexpected")
    msg = map_pipeline_error(exc)
    assert msg == "something completely unexpected"


@pytest.mark.skipif(not _has_fiona, reason="fiona not installed")
def test_fiona_driver_error():
    import fiona.errors

    exc = fiona.errors.DriverError("unsupported driver")
    msg = map_pipeline_error(exc)
    assert "Could not read this file as a vector" in msg
