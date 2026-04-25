import json
import uuid
from datetime import UTC, datetime

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow


def _make_dataset_row(**overrides) -> DatasetRow:
    return DatasetRow(
        id=str(uuid.uuid4()),
        filename="a.tif",
        dataset_type="raster",
        format_pair="GeoTIFF->COG",
        tile_url="/raster/x/{z}/{x}/{y}",
        created_at=datetime.now(UTC),
        metadata_json=json.dumps({}),
        **overrides,
    )


def _make_connection_row(**overrides) -> ConnectionRow:
    return ConnectionRow(
        id=str(uuid.uuid4()),
        name="c",
        url="https://example.com/a.tif",
        connection_type="cog",
        created_at=datetime.now(UTC),
        **overrides,
    )


def test_dataset_to_dict_includes_preferred_colormap_fields_when_null():
    row = _make_dataset_row()
    d = row.to_dict()
    assert d["preferred_colormap"] is None
    assert d["preferred_colormap_reversed"] is None


def test_dataset_to_dict_includes_preferred_colormap_fields_when_set():
    row = _make_dataset_row(
        preferred_colormap="terrain", preferred_colormap_reversed=False
    )
    d = row.to_dict()
    assert d["preferred_colormap"] == "terrain"
    assert d["preferred_colormap_reversed"] is False


def test_connection_to_dict_includes_preferred_colormap_fields_when_null():
    row = _make_connection_row()
    d = row.to_dict()
    assert d["preferred_colormap"] is None
    assert d["preferred_colormap_reversed"] is None


def test_connection_to_dict_includes_preferred_colormap_fields_when_set():
    row = _make_connection_row(
        preferred_colormap="plasma", preferred_colormap_reversed=True
    )
    d = row.to_dict()
    assert d["preferred_colormap"] == "plasma"
    assert d["preferred_colormap_reversed"] is True
