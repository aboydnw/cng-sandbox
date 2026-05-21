from pathlib import Path

import pyarrow.ipc as ipc
import pytest

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


def test_reprojects_clip_geom_when_source_is_not_4326(tmp_path):
    import geopandas as gpd
    from shapely.geometry import Polygon

    # 100m square around UTM zone 33N origin (Easting=500000, Northing=0)
    poly = Polygon(
        [(500000, 0), (500100, 0), (500100, 100), (500000, 100), (500000, 0)]
    )
    gdf = gpd.GeoDataFrame({"name": ["x"]}, geometry=[poly], crs="EPSG:32633")
    source = tmp_path / "utm.parquet"
    gdf.to_parquet(source)

    output = tmp_path / "vector.arrow"
    # UTM 33N central meridian is 15°E; easting=500000 lands near lon=15.
    vector_arrow.write_arrow(
        source_url=str(source),
        bbox=(14.99, -0.01, 15.01, 0.01),
        keep_columns=["name"],
        output_path=output,
    )
    with ipc.open_stream(output) as reader:
        table = reader.read_all()
    assert table.column("name").to_pylist() == ["x"]


def test_raises_when_arrow_output_exceeds_size_cap(tmp_path, monkeypatch):
    monkeypatch.setattr(vector_arrow, "MAX_ARROW_BYTES", 100)
    output = tmp_path / "vector.arrow"
    with pytest.raises(ValueError, match="too large"):
        vector_arrow.write_arrow(
            source_url=str(FIXTURE_GEOJSON),
            bbox=(-100.0, -100.0, 100.0, 100.0),
            keep_columns=["name", "value"],
            output_path=output,
        )
    assert not output.exists()


def test_raises_value_error_when_source_missing(tmp_path):
    output = tmp_path / "vector.arrow"
    missing = tmp_path / "does-not-exist.geojson"
    with pytest.raises(ValueError, match="vector source unavailable"):
        vector_arrow.write_arrow(
            source_url=str(missing),
            bbox=(-1.0, -1.0, 5.0, 5.0),
            keep_columns=[],
            output_path=output,
        )


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
