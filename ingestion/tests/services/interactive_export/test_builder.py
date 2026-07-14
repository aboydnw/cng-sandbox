import io
import json
import zipfile
from pathlib import Path

import httpx
import pytest

from src.models.cng_rc import (
    CngRcChapter,
    CngRcConfig,
    CngRcLayer,
    CngRcMapView,
    CngRcMetadata,
    CngRcOrigin,
    CngRcRender,
)
from src.services.interactive_export import builder

FIXTURE_COG = Path(__file__).parent / "fixtures" / "small_cog.tif"
FIXTURE_GEOJSON = Path(__file__).parent / "fixtures" / "small_polygons.geojson"


def _empty_config() -> CngRcConfig:
    return CngRcConfig(
        version="1",
        origin=CngRcOrigin(
            story_id="s1", workspace_id="ws1", exported_at="2026-05-20T00:00:00Z"
        ),
        metadata=CngRcMetadata(
            title="Demo",
            description="",
            author=None,
            created="2026-05-20T00:00:00Z",
            updated="2026-05-20T00:00:00Z",
        ),
        chapters=[],
        layers={},
        assets={},
    )


def _config_with_one_map_chapter(layer: CngRcLayer) -> tuple[CngRcConfig, list[dict]]:
    layer_id = "layer-1"
    chapter_id = "ch1"
    config = _empty_config()
    config.layers[layer_id] = layer
    config.chapters.append(
        CngRcChapter(
            id=chapter_id,
            type="map",
            title="Map",
            body="",
            map=CngRcMapView(center=(0.0, 0.0), zoom=1, bearing=0, pitch=0),
            layers=[layer_id],
            extra=None,
        )
    )
    chapters_raw = [
        {
            "id": chapter_id,
            "type": "map",
            "title": "Map",
            "narrative": "",
            "map_state": {
                "center": [0.0, 0.0],
                "zoom": 1,
                "bearing": 0,
                "pitch": 0,
                "basemap": "streets",
            },
            "layer_config": {"dataset_id": "ds1"},
        }
    ]
    return config, chapters_raw


def test_map_chapter_with_raster_layer_emits_pmtiles():
    layer = CngRcLayer(
        type="raster-cog",
        source_url=str(FIXTURE_COG),
        cng_url=str(FIXTURE_COG),
        label="Raster",
        attribution=None,
        render=CngRcRender(
            colormap="viridis",
            rescale=(0.0, 1.0),
            opacity=0.8,
            band=None,
            timestep=None,
            colormap_reversed=True,
        ),
    )
    config, chapters_raw = _config_with_one_map_chapter(layer)
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    names = archive.namelist()
    assert any(n.startswith("chapters/ch1/") and n.endswith(".pmtiles") for n in names)
    manifest = json.loads(archive.read("manifest.json"))
    raster = manifest["chapters"][0]["layers"][0]
    assert raster["kind"] == "raster"
    assert raster["colormap"] == "viridis"
    assert raster["opacity"] == 0.8
    assert raster["rescale_min"] == 0.0
    assert raster["rescale_max"] == 1.0
    assert raster["colormap_reversed"] is True


def test_map_chapter_with_vector_layer_emits_arrow():
    layer = CngRcLayer(
        type="vector-geoparquet",
        source_url=str(FIXTURE_GEOJSON),
        cng_url=str(FIXTURE_GEOJSON),
        label="Vec",
        attribution=None,
        render=CngRcRender(
            colormap=None,
            rescale=None,
            opacity=1.0,
            band=None,
            timestep=None,
        ),
    )
    config, chapters_raw = _config_with_one_map_chapter(layer)
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    names = archive.namelist()
    assert any(n.startswith("chapters/ch1/") and n.endswith(".arrow") for n in names)


def test_map_chapter_with_trajectory_layer_emits_trips_json(monkeypatch):
    from src.services.interactive_export import source_resolver

    tracks = [
        {"trajectory_id": "a", "path": [[0, 0], [1, 1]], "timestamps": [0, 1], "speeds": [1, 2]}
    ]

    def fake_fetch(src_url, out_path, storage=None):
        out_path.write_text(json.dumps(tracks))

    monkeypatch.setattr(source_resolver, "fetch_trips_json", fake_fetch)

    layer = CngRcLayer(
        type="trajectory",
        source_url=None,
        cng_url="/storage/datasets/ds1/converted/trips.json",
        label="Track",
        attribution=None,
        render=CngRcRender(
            colormap=None,
            rescale=None,
            opacity=0.9,
            band=None,
            timestep=None,
            trail_length=300,
        ),
    )
    config, chapters_raw = _config_with_one_map_chapter(layer)
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    assert "chapters/ch1/layer-1.trips.json" in archive.namelist()
    manifest = json.loads(archive.read("manifest.json"))
    trips = manifest["chapters"][0]["layers"][0]
    assert trips["kind"] == "trips"
    assert trips["trail_length"] == 300
    assert trips["opacity"] == 0.9


def test_raster_pyramid_build_timeout_raises(monkeypatch):
    import time

    from src.services.interactive_export import raster_pyramid

    monkeypatch.setattr(builder, "PYRAMID_BUILD_TIMEOUT_SECONDS", 0.05)

    def slow_build(*args, **kwargs):
        time.sleep(0.5)

    monkeypatch.setattr(raster_pyramid, "build_pyramid", slow_build)

    layer = CngRcLayer(
        type="raster-cog",
        source_url=str(FIXTURE_COG),
        cng_url=str(FIXTURE_COG),
        label="Raster",
        attribution=None,
        render=CngRcRender(
            colormap="viridis",
            rescale=(0.0, 1.0),
            opacity=1.0,
            band=None,
            timestep=None,
        ),
    )
    config, chapters_raw = _config_with_one_map_chapter(layer)
    start = time.monotonic()
    with pytest.raises(ValueError, match="timed out"):
        builder.build_interactive_export(
            config=config,
            chapters_raw=chapters_raw,
            chart_data_by_chapter={},
            scrolly_pngs={},
        )
    assert time.monotonic() - start < 0.3


def test_unsupported_layer_type_raises():
    layer = CngRcLayer(
        type="xyz",
        source_url="https://example.com/tiles/{z}/{x}/{y}.png",
        cng_url=None,
        label="XYZ",
        attribution=None,
        render=CngRcRender(
            colormap=None,
            rescale=None,
            opacity=1.0,
            band=None,
            timestep=None,
        ),
    )
    config, chapters_raw = _config_with_one_map_chapter(layer)
    with pytest.raises(ValueError, match="xyz"):
        builder.build_interactive_export(
            config=config,
            chapters_raw=chapters_raw,
            chart_data_by_chapter={},
            scrolly_pngs={},
        )


def test_chart_chapter_emits_chart_json_from_csv_rows_payload():
    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="ch1",
            type="chart",
            title="Chart",
            body="",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [
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
    payload = {
        "kind": "csv_rows",
        "rows": [{"year": 2020, "v": 1.0}, {"year": 2021, "v": 2.0}],
    }
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={"ch1": payload},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    chart_path = "chapters/ch1/chart.json"
    assert chart_path in archive.namelist()
    chart = json.loads(archive.read(chart_path))
    assert chart["series"][0]["type"] == "line"


def test_chart_chapter_with_dataset_timeseries_payload():
    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="c1",
            type="chart",
            title="T",
            body="",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [
        {
            "id": "c1",
            "type": "chart",
            "title": "T",
            "narrative": "",
            "chart": {
                "source": {
                    "kind": "dataset_timeseries",
                    "dataset_id": "ds1",
                    "point": [10, 20],
                },
                "viz": {
                    "kind": "line",
                    "x_field": "datetime",
                    "y_fields": ["value"],
                    "series_field": None,
                    "x_label": "",
                    "y_label": "",
                    "y_scale": "linear",
                },
            },
        }
    ]
    payload = {
        "kind": "timeseries_points",
        "points": [
            {"datetime": "2020-01-01", "value": 1.0},
            {"datetime": "2021-01-01", "value": 2.0},
        ],
    }
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={"c1": payload},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    chart = json.loads(archive.read("chapters/c1/chart.json"))
    assert chart["series"][0]["type"] == "line"
    assert chart["xAxis"]["type"] == "time"


def test_chart_chapter_with_histogram_payload():
    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="h1",
            type="chart",
            title="H",
            body="",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [
        {
            "id": "h1",
            "type": "chart",
            "title": "H",
            "narrative": "",
            "chart": {
                "source": {
                    "kind": "dataset_histogram",
                    "dataset_id": "ds1",
                    "bins": 3,
                },
                "viz": {},
            },
        }
    ]
    payload = {
        "kind": "histogram_bins",
        "bins": [
            {"bin_min": 0.0, "bin_max": 1.0, "count": 3},
            {"bin_min": 1.0, "bin_max": 2.0, "count": 7},
        ],
    }
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={"h1": payload},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    chart = json.loads(archive.read("chapters/h1/chart.json"))
    assert chart["series"][0]["type"] == "bar"


def test_scrolly_chapter_embeds_uploaded_png():
    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="ch1",
            type="scrollytelling",
            title="Scrolly",
            body="",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [
        {"id": "ch1", "type": "scrollytelling", "title": "Scrolly", "narrative": ""}
    ]
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={"ch1": fake_png},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    assert "chapters/ch1/snapshot.png" in archive.namelist()
    assert archive.read("chapters/ch1/snapshot.png") == fake_png


def test_scrolly_chapter_without_upload_fails():
    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="ch1",
            type="scrollytelling",
            title="Scrolly",
            body="",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [
        {"id": "ch1", "type": "scrollytelling", "title": "Scrolly", "narrative": ""}
    ]
    with pytest.raises(ValueError, match="snapshot"):
        builder.build_interactive_export(
            config=config,
            chapters_raw=chapters_raw,
            chart_data_by_chapter={},
            scrolly_pngs={},
        )


def test_chapter_id_path_traversal_rejected():
    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="../escape",
            type="prose",
            title="x",
            body="",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [{"id": "../escape", "type": "prose", "title": "x", "narrative": ""}]
    with pytest.raises(ValueError, match="invalid chapter id"):
        builder.build_interactive_export(
            config=config,
            chapters_raw=chapters_raw,
            chart_data_by_chapter={},
            scrolly_pngs={},
        )


def test_zip_contains_runtime_bundle_when_available(monkeypatch):
    from src.services.interactive_export import runtime_assets

    fake_runtime = Path(__file__).parent / "fixtures" / "fake_runtime"
    monkeypatch.setattr(runtime_assets, "RUNTIME_DIR", fake_runtime)

    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="p1",
            type="prose",
            title="Hi",
            body="yo",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [{"id": "p1", "type": "prose", "title": "Hi", "narrative": "yo"}]
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    assert "runtime/bundle.js" in archive.namelist()
    assert "runtime/bundle.css" in archive.namelist()
    html = archive.read("index.html").decode("utf-8")
    assert "./runtime/bundle.js" in html


def test_zip_uses_placeholder_html_when_runtime_missing(monkeypatch, tmp_path):
    from src.services.interactive_export import runtime_assets

    monkeypatch.setattr(runtime_assets, "RUNTIME_DIR", tmp_path / "missing")

    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="p1",
            type="prose",
            title="Hi",
            body="yo",
            map=None,
            layers=[],
            extra=None,
        )
    )
    chapters_raw = [{"id": "p1", "type": "prose", "title": "Hi", "narrative": "yo"}]
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    assert "runtime/bundle.js" not in archive.namelist()
    html = archive.read("index.html").decode("utf-8")
    assert "placeholder" in html.lower()


def test_image_chapter_inlines_external_asset(monkeypatch):
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16

    def fake_get(url, *args, **kwargs):
        return httpx.Response(
            200,
            content=fake_png,
            request=httpx.Request("GET", url),
            headers={"content-type": "image/png"},
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    monkeypatch.setattr(
        "src.services.interactive_export.asset_inline.validate_url_safe",
        lambda url: None,
    )

    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="img1",
            type="image",
            title="Pic",
            body="",
            map=None,
            layers=[],
            extra={"image": {"url": "https://example.com/x.png", "alt_text": "X"}},
        )
    )
    chapters_raw = [
        {
            "id": "img1",
            "type": "image",
            "title": "Pic",
            "narrative": "",
            "image": {"url": "https://example.com/x.png", "alt_text": "X"},
        }
    ]
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    assert "assets/img1-image.png" in archive.namelist()
    manifest = json.loads(archive.read("manifest.json"))
    assert manifest["chapters"][0]["image_src"] == "assets/img1-image.png"


def test_video_chapter_inlines_youtube_thumbnail(monkeypatch):
    fake_jpg = b"\xff\xd8\xff" + b"\x00" * 16

    def fake_get(url, *args, **kwargs):
        return httpx.Response(
            200,
            content=fake_jpg,
            request=httpx.Request("GET", url),
            headers={"content-type": "image/jpeg"},
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    monkeypatch.setattr(
        "src.services.interactive_export.asset_inline.validate_url_safe",
        lambda url: None,
    )

    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="vid1",
            type="video",
            title="V",
            body="",
            map=None,
            layers=[],
            extra={"video": {"provider": "youtube", "video_id": "abc"}},
        )
    )
    chapters_raw = [
        {
            "id": "vid1",
            "type": "video",
            "title": "V",
            "narrative": "",
            "video": {"provider": "youtube", "video_id": "abc"},
        }
    ]
    zip_bytes = builder.build_interactive_export(
        config=config,
        chapters_raw=chapters_raw,
        chart_data_by_chapter={},
        scrolly_pngs={},
    )
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    assert "assets/vid1-thumb.jpg" in archive.namelist()
    manifest = json.loads(archive.read("manifest.json"))
    assert manifest["chapters"][0]["thumbnail_src"] == "assets/vid1-thumb.jpg"


def _flyover_config() -> CngRcConfig:
    config = _empty_config()
    config.chapters.append(
        CngRcChapter(
            id="c1", type="flyover", title="Fly", body=None, map=None, layers=[]
        )
    )
    return config


def test_flyover_rejection_maps_to_client_error():
    # endpoint.py returns 400 (not 500) only when the ValueError message
    # contains "not yet supported" — this substring is a functional contract.
    with pytest.raises(ValueError, match="not yet supported"):
        builder.build_interactive_export(
            config=_flyover_config(),
            chapters_raw=[{"id": "c1", "type": "flyover"}],
            chart_data_by_chapter={},
            scrolly_pngs={},
        )
