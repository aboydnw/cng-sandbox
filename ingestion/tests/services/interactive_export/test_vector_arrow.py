from pathlib import Path

import pyarrow.ipc as ipc

from src.services.interactive_export import vector_arrow

FIXTURE_GEOJSON = Path(__file__).parent / "fixtures" / "small_polygons.geojson"


def test_clips_features_to_bbox(tmp_path):
    output = tmp_path / "vector.arrow"
    vector_arrow.write_arrow(
        source_url=str(FIXTURE_GEOJSON),
        bbox=(-1.0, -1.0, 5.0, 5.0),
        keep_columns=["name", "value"],
        output_path=output,
    )
    with ipc.open_stream(output) as reader:
        table = reader.read_all()
    names = table.column("name").to_pylist()
    assert sorted(names) == ["a", "b"]


def test_drops_unreferenced_columns(tmp_path):
    output = tmp_path / "vector.arrow"
    vector_arrow.write_arrow(
        source_url=str(FIXTURE_GEOJSON),
        bbox=(-100.0, -100.0, 100.0, 100.0),
        keep_columns=["name"],
        output_path=output,
    )
    with ipc.open_stream(output) as reader:
        table = reader.read_all()
    assert "value" not in table.column_names
    assert "name" in table.column_names
    assert "geometry" in table.column_names


def test_includes_geoarrow_extension_metadata(tmp_path):
    output = tmp_path / "vector.arrow"
    vector_arrow.write_arrow(
        source_url=str(FIXTURE_GEOJSON),
        bbox=(-100.0, -100.0, 100.0, 100.0),
        keep_columns=[],
        output_path=output,
    )
    with ipc.open_stream(output) as reader:
        table = reader.read_all()
    geom_field = table.schema.field("geometry")
    assert geom_field.metadata is not None
    assert b"ARROW:extension:name" in geom_field.metadata
    assert geom_field.metadata[b"ARROW:extension:name"].startswith(b"geoarrow.")
