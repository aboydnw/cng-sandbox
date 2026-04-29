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
