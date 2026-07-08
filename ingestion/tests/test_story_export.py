import json
from datetime import UTC, datetime

from src.models.connection import ConnectionRow
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services import story_export


def _make_story(session, *, chapters, workspace_id="ws-test"):
    row = StoryRow(
        id="story-1",
        title="My Story",
        description="A test",
        dataset_id=None,
        chapters_json=json.dumps(chapters),
        published=False,
        is_example=False,
        workspace_id=workspace_id,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        updated_at=datetime(2026, 4, 28, tzinfo=UTC),
    )
    session.add(row)
    session.commit()
    return row


def test_export_prose_chapter_no_layers(db_session):
    row = _make_story(
        db_session,
        chapters=[{"id": "c1", "type": "prose", "title": "Hi", "body": "Text"}],
    )
    config = story_export.build_config(row, db_session)
    assert config.version == "1"
    assert config.origin.story_id == "story-1"
    assert config.origin.workspace_id == "ws-test"
    assert len(config.chapters) == 1
    assert config.chapters[0].type == "prose"
    assert config.layers == {}


def test_export_resolves_connection_to_source_url(db_session):
    conn = ConnectionRow(
        id="conn-1",
        name="GEBCO",
        url="https://source.coop/gebco/data.tif",
        connection_type="cog",
        tile_url=None,
        bounds_json=None,
        min_zoom=0,
        max_zoom=12,
        tile_type="raster",
        is_shared=True,
        workspace_id="ws-test",
    )
    db_session.add(conn)
    db_session.commit()

    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "map",
                "title": "Bathymetry",
                "body": "",
                "map_state": {"center": [-122.4, 37.7], "zoom": 8},
                "layer_config": {
                    "connection_id": "conn-1",
                    "colormap": "viridis",
                    "opacity": 1.0,
                    "rescale_min": 0,
                    "rescale_max": 1000,
                },
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    assert len(config.layers) == 1
    layer = next(iter(config.layers.values()))
    assert layer.type == "raster-cog"
    assert layer.source_url == "https://source.coop/gebco/data.tif"
    assert layer.cng_url is None
    assert layer.render.colormap == "viridis"
    assert layer.render.rescale == (0, 1000)


def test_export_maps_copc_connection_to_copc_layer_type(db_session):
    conn = ConnectionRow(
        id="conn-copc",
        name="Autzen",
        url="https://example.com/a.copc.laz",
        connection_type="copc",
        tile_url=None,
        bounds_json=None,
        workspace_id="ws-test",
    )
    db_session.add(conn)
    db_session.commit()

    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "map",
                "title": "Lidar",
                "body": "",
                "map_state": {"center": [-123.07, 44.05], "zoom": 12},
                "layer_config": {"connection_id": "conn-copc", "opacity": 1.0},
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    layer = next(iter(config.layers.values()))
    assert layer.type == "copc"


def test_export_image_chapter_carries_nested_payload(db_session):
    image_payload = {
        "asset_id": "asset-1",
        "url": "https://example.com/img.jpg",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "alt_text": "An image",
        "width": 800,
        "height": 600,
    }
    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "image",
                "title": "Photo",
                "body": "",
                "image": image_payload,
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    assert config.chapters[0].extra == {"image": image_payload}


def test_export_video_chapter_carries_nested_payload(db_session):
    video_payload = {
        "provider": "youtube",
        "video_id": "abc123",
        "original_url": "https://youtu.be/abc123",
    }
    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "video",
                "title": "Clip",
                "body": "",
                "video": video_payload,
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    assert config.chapters[0].extra == {"video": video_payload}


def test_export_rescale_requires_both_min_and_max(db_session):
    conn = ConnectionRow(
        id="conn-2",
        name="GEBCO",
        url="https://source.coop/gebco/data.tif",
        connection_type="cog",
        tile_url=None,
        bounds_json=None,
        min_zoom=0,
        max_zoom=12,
        tile_type="raster",
        is_shared=True,
        workspace_id="ws-test",
    )
    db_session.add(conn)
    db_session.commit()

    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "map",
                "title": "Bathymetry",
                "body": "",
                "map_state": {"center": [0, 0], "zoom": 1},
                "layer_config": {
                    "connection_id": "conn-2",
                    "rescale_min": 0,
                    "opacity": 1.0,
                },
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    layer = next(iter(config.layers.values()))
    assert layer.render.rescale is None


def test_export_resolves_dataset_to_cng_url(db_session):
    ds = DatasetRow(
        id="ds-1",
        filename="data.parquet",
        dataset_type="vector",
        format_pair="geojson-to-geoparquet",
        tile_url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        metadata_json=json.dumps(
            {
                "title": "My Vector Data",
                "source_url": "https://example.com/original.geojson",
                "parquet_url": "https://r2.cng.devseed.com/data.parquet",
            }
        ),
    )
    db_session.add(ds)
    db_session.commit()

    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "map",
                "title": "Vector Layer",
                "body": "",
                "layer_config": {
                    "dataset_id": "ds-1",
                    "opacity": 0.8,
                },
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    assert len(config.layers) == 1
    layer = next(iter(config.layers.values()))
    assert layer.type == "vector-geoparquet"
    assert layer.source_url == "https://example.com/original.geojson"
    assert layer.cng_url == "https://r2.cng.devseed.com/data.parquet"
    assert layer.render.opacity == 0.8


def test_export_accepts_integer_timestep(db_session):
    ds = DatasetRow(
        id="ds-temporal",
        filename="precip",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="https://example.com/raster/collections/sandbox-ds-temporal/tiles/{z}/{x}/{y}",
        metadata_json=json.dumps({"title": "Daily Precipitation"}),
    )
    db_session.add(ds)
    db_session.commit()

    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "scrollytelling",
                "title": "Kristin Strikes",
                "body": "",
                "map_state": {"center": [-11, 39.5], "zoom": 6},
                "layer_config": {
                    "dataset_id": "ds-temporal",
                    "colormap": "blues",
                    "opacity": 0.9,
                    "rescale_min": 0,
                    "rescale_max": 80,
                    "timestep": 58,
                },
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    layer = next(iter(config.layers.values()))
    assert layer.render.timestep == 58


def test_export_strips_3d_map_state_fields(db_session):
    row = _make_story(
        db_session,
        chapters=[
            {
                "id": "c1",
                "type": "map",
                "title": "Globe",
                "body": "",
                "map_state": {
                    "center": [10, 20],
                    "zoom": 3,
                    "bearing": 0,
                    "pitch": 45,
                    "terrain": {"enabled": True, "exaggeration": 1.5},
                    "globe": True,
                    "buildings": True,
                },
                "layer_config": None,
            }
        ],
    )
    config = story_export.build_config(row, db_session)
    map_view = config.chapters[0].map
    assert map_view is not None
    dumped = map_view.model_dump()
    assert "terrain" not in dumped
    assert "globe" not in dumped
    assert "buildings" not in dumped
