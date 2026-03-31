import json
import os

from scripts.convert import convert


def test_convert_calls_on_progress(tmp_path):
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [0, 0]},
                "properties": {"id": i},
            }
            for i in range(50)
        ],
    }
    input_path = str(tmp_path / "test.geojson")
    output_path = str(tmp_path / "test.parquet")
    with open(input_path, "w") as f:
        json.dump(geojson, f)

    calls = []
    convert(input_path, output_path, on_progress=lambda n: calls.append(n))

    assert os.path.exists(output_path)
    assert len(calls) > 0
    assert calls[-1] == 50


def test_convert_works_without_on_progress(tmp_path):
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [0, 0]},
                "properties": {"id": 1},
            }
        ],
    }
    input_path = str(tmp_path / "test.geojson")
    output_path = str(tmp_path / "test.parquet")
    with open(input_path, "w") as f:
        json.dump(geojson, f)

    convert(input_path, output_path)
    assert os.path.exists(output_path)
