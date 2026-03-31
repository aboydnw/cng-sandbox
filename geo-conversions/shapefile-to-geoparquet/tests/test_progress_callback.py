import os

import geopandas as gpd
from shapely.geometry import Point

from scripts.convert import convert


def test_convert_calls_on_progress(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"id": range(50)},
        geometry=[Point(i, i) for i in range(50)],
        crs="EPSG:4326",
    )
    shp_path = str(tmp_path / "test.shp")
    gdf.to_file(shp_path)
    output_path = str(tmp_path / "test.parquet")

    calls = []
    convert(shp_path, output_path, on_progress=lambda n: calls.append(n))

    assert os.path.exists(output_path)
    assert len(calls) > 0
    assert calls[-1] == 50


def test_convert_works_without_on_progress(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"id": [1]},
        geometry=[Point(0, 0)],
        crs="EPSG:4326",
    )
    shp_path = str(tmp_path / "test.shp")
    gdf.to_file(shp_path)
    output_path = str(tmp_path / "test.parquet")

    convert(shp_path, output_path)
    assert os.path.exists(output_path)
