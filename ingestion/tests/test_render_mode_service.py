import json
import uuid
from datetime import UTC, datetime

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.services.render_mode import (
    CLIENT_RENDER_CAP_CONTINUOUS,
    CLIENT_RENDER_CAP_PALETTED,
    check_render_mode_allowed,
)


def _dataset(**kwargs):
    base = dict(
        id=str(uuid.uuid4()),
        filename="a.tif",
        dataset_type="raster",
        format_pair="GeoTIFF->COG",
        tile_url="https://example/tiles/{z}/{x}/{y}",
        created_at=datetime.now(UTC),
    )
    base.update(kwargs)
    return DatasetRow(**base)


def test_server_mode_always_allowed():
    row = _dataset()
    assert check_render_mode_allowed(row, "server") is None


def test_null_mode_always_allowed():
    row = _dataset()
    assert check_render_mode_allowed(row, None) is None


def test_client_mode_allowed_for_small_continuous_cog_with_bounds():
    meta = {
        "cog_url": "https://example/a.tif",
        "converted_file_size": 50 * 1024 * 1024,
        "dtype": "float32",
        "is_categorical": False,
    }
    row = _dataset(
        metadata_json=json.dumps(meta),
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
    )
    assert check_render_mode_allowed(row, "client") is None


def test_client_mode_rejected_when_temporal():
    meta = {"cog_url": "https://example/a.tif", "is_temporal": True}
    row = _dataset(
        metadata_json=json.dumps(meta),
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
    )
    assert check_render_mode_allowed(row, "client") == "Temporal dataset"


def test_client_mode_rejected_when_no_cog_url():
    row = _dataset(
        metadata_json=json.dumps({}),
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
    )
    assert check_render_mode_allowed(row, "client") == "No COG URL"


def test_client_mode_rejected_when_bounds_missing():
    meta = {"cog_url": "https://example/a.tif"}
    row = _dataset(metadata_json=json.dumps(meta), bounds_json=None)
    assert check_render_mode_allowed(row, "client") == "Bounds unavailable"


def test_client_mode_rejected_when_bounds_out_of_range():
    meta = {"cog_url": "https://example/a.tif"}
    row = _dataset(
        metadata_json=json.dumps(meta),
        bounds_json=json.dumps([-10.0, -86.0, 10.0, 10.0]),
    )
    assert "latitude" in check_render_mode_allowed(row, "client")


def test_client_mode_rejected_when_continuous_too_big():
    meta = {
        "cog_url": "https://example/a.tif",
        "converted_file_size": CLIENT_RENDER_CAP_CONTINUOUS + 1,
        "dtype": "float32",
        "is_categorical": False,
    }
    row = _dataset(
        metadata_json=json.dumps(meta),
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
    )
    assert "cap" in check_render_mode_allowed(row, "client")


def test_client_mode_allows_larger_paletted_files():
    meta = {
        "cog_url": "https://example/a.tif",
        "converted_file_size": 800 * 1024 * 1024,
        "dtype": "uint8",
        "is_categorical": True,
    }
    row = _dataset(
        metadata_json=json.dumps(meta),
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
    )
    assert check_render_mode_allowed(row, "client") is None


def test_connection_client_rejected_when_size_unknown():
    row = ConnectionRow(
        id=str(uuid.uuid4()),
        name="c",
        url="https://example.com/x.cog",
        connection_type="cog",
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
        file_size=None,
        created_at=datetime.now(UTC),
    )
    assert check_render_mode_allowed(row, "client") == "File size unknown"


def test_connection_client_rejected_when_paletted_too_big():
    row = ConnectionRow(
        id=str(uuid.uuid4()),
        name="c",
        url="https://example.com/x.cog",
        connection_type="cog",
        bounds_json=json.dumps([-10.0, -10.0, 10.0, 10.0]),
        file_size=CLIENT_RENDER_CAP_PALETTED + 1,
        is_categorical=True,
        created_at=datetime.now(UTC),
    )
    assert "cap" in check_render_mode_allowed(row, "client")
