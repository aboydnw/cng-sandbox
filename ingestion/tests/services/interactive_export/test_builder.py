import io
import json
import zipfile
from pathlib import Path

import pytest

from src.services.interactive_export import builder

FIXTURE_COG = Path(__file__).parent / "fixtures" / "small_cog.tif"
FIXTURE_GEOJSON = Path(__file__).parent / "fixtures" / "small_polygons.geojson"


def _story():
    return {"id": "s1", "title": "Demo", "description": ""}


def test_map_chapter_emits_raster_and_vector_assets():
    chapters = [
        {
            "id": "ch1",
            "type": "map",
            "title": "Map",
            "narrative": "",
            "map_state": {
                "center": [0, 0],
                "zoom": 1,
                "bearing": 0,
                "pitch": 0,
                "basemap": "voyager",
            },
            "layer_config": {
                "raster": [
                    {
                        "id": "r1",
                        "source_url": str(FIXTURE_COG),
                        "bbox": [-5, -5, 5, 5],
                        "colormap": "viridis",
                        "rescale": [0, 1],
                    }
                ],
                "vector": [
                    {
                        "id": "v1",
                        "source_url": str(FIXTURE_GEOJSON),
                        "bbox": [-5, -5, 5, 5],
                        "style": {"fill": [255, 0, 0, 180]},
                        "geom": "polygon",
                        "keep_columns": ["name"],
                    }
                ],
            },
        }
    ]
    zip_bytes = builder.build_interactive_export(
        story=_story(),
        chapters=chapters,
        datasets={},
        connections={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    names = archive.namelist()
    assert any(n.startswith("chapters/ch1/") and n.endswith(".pmtiles") for n in names)
    assert any(n.startswith("chapters/ch1/") and n.endswith(".arrow") for n in names)


def test_chart_chapter_emits_chart_json(monkeypatch):
    def fake_fetch(url: str) -> list[dict]:
        return [{"year": 2020, "v": 1.0}, {"year": 2021, "v": 2.0}]

    monkeypatch.setattr(
        "src.services.interactive_export.builder._fetch_csv_rows", fake_fetch
    )
    chapters = [
        {
            "id": "ch1",
            "type": "chart",
            "title": "Chart",
            "narrative": "",
            "chart": {
                "source": {"kind": "csv", "url": "https://example.com/x.csv"},
                "viz": {
                    "kind": "line",
                    "x_field": "year",
                    "y_fields": ["v"],
                    "series_field": None,
                    "x_label": "",
                    "y_label": "",
                    "y_scale": "linear",
                },
            },
        }
    ]
    zip_bytes = builder.build_interactive_export(
        story=_story(),
        chapters=chapters,
        datasets={},
        connections={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    chart_path = "chapters/ch1/chart.json"
    assert chart_path in archive.namelist()
    chart = json.loads(archive.read(chart_path))
    assert chart["series"][0]["type"] == "line"


def test_scrolly_chapter_embeds_uploaded_png():
    chapters = [
        {"id": "ch1", "type": "scrollytelling", "title": "Scrolly", "narrative": ""}
    ]
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    zip_bytes = builder.build_interactive_export(
        story=_story(),
        chapters=chapters,
        datasets={},
        connections={},
        scrolly_pngs={"ch1": fake_png},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    assert "chapters/ch1/snapshot.png" in archive.namelist()
    assert archive.read("chapters/ch1/snapshot.png") == fake_png


def test_scrolly_chapter_without_upload_fails():
    chapters = [
        {"id": "ch1", "type": "scrollytelling", "title": "Scrolly", "narrative": ""}
    ]
    with pytest.raises(ValueError, match="snapshot"):
        builder.build_interactive_export(
            story=_story(),
            chapters=chapters,
            datasets={},
            connections={},
            scrolly_pngs={},
        )


def test_chart_chapter_csv_url_with_disallowed_scheme_rejected():
    chapters = [
        {
            "id": "ch1",
            "type": "chart",
            "title": "Chart",
            "narrative": "",
            "chart": {
                "source": {"kind": "csv", "url": "file:///etc/passwd"},
                "viz": {
                    "kind": "line",
                    "x_field": "year",
                    "y_fields": ["v"],
                    "series_field": None,
                    "x_label": "",
                    "y_label": "",
                    "y_scale": "linear",
                },
            },
        }
    ]
    with pytest.raises(ValueError, match="disallowed URL"):
        builder.build_interactive_export(
            story=_story(),
            chapters=chapters,
            datasets={},
            connections={},
            scrolly_pngs={},
        )


def test_chart_chapter_csv_url_with_internal_host_rejected():
    chapters = [
        {
            "id": "ch1",
            "type": "chart",
            "title": "Chart",
            "narrative": "",
            "chart": {
                "source": {"kind": "csv", "url": "http://127.0.0.1/x.csv"},
                "viz": {
                    "kind": "line",
                    "x_field": "year",
                    "y_fields": ["v"],
                    "series_field": None,
                    "x_label": "",
                    "y_label": "",
                    "y_scale": "linear",
                },
            },
        }
    ]
    with pytest.raises(ValueError, match="disallowed URL"):
        builder.build_interactive_export(
            story=_story(),
            chapters=chapters,
            datasets={},
            connections={},
            scrolly_pngs={},
        )


def test_chapter_id_path_traversal_rejected():
    chapters = [{"id": "../escape", "type": "prose", "title": "x", "narrative": ""}]
    with pytest.raises(ValueError, match="invalid chapter id"):
        builder.build_interactive_export(
            story=_story(),
            chapters=chapters,
            datasets={},
            connections={},
            scrolly_pngs={},
        )


def test_zarr_connection_in_map_chapter_rejected():
    chapters = [
        {
            "id": "ch1",
            "type": "map",
            "title": "Z",
            "narrative": "",
            "map_state": {
                "center": [0, 0],
                "zoom": 1,
                "bearing": 0,
                "pitch": 0,
                "basemap": "voyager",
            },
            "layer_config": {
                "raster": [
                    {"id": "r1", "connection_id": "conn-zarr", "bbox": [-5, -5, 5, 5]}
                ],
                "vector": [],
            },
        }
    ]
    connections = {"conn-zarr": {"id": "conn-zarr", "connection_type": "zarr"}}
    with pytest.raises(ValueError, match="zarr"):
        builder.build_interactive_export(
            story=_story(),
            chapters=chapters,
            datasets={},
            connections=connections,
            scrolly_pngs={},
        )
