import pytest
from pydantic import ValidationError

from src.models.story import (
    ChartChapter,
    ImageChapter,
    MapChapter,
    ProseChapter,
    ScrollytellingChapter,
    StoryCreate,
    StoryRow,
    StoryUpdate,
    VideoChapter,
)


def test_story_row_has_is_example_defaulting_false(db_session):
    row = StoryRow(id="t1", title="T", chapters_json="[]")
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    assert row.is_example is False


def test_story_row_is_example_can_be_true(db_session):
    row = StoryRow(id="t2", title="T", chapters_json="[]", is_example=True)
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    assert row.is_example is True


def test_scrollytelling_chapter_parses():
    payload = {
        "id": "a",
        "order": 0,
        "type": "scrollytelling",
        "title": "T",
        "narrative": "",
        "map_state": {
            "center": [0, 0],
            "zoom": 2,
            "bearing": 0,
            "pitch": 0,
            "basemap": "streets",
        },
        "layer_config": {
            "dataset_id": "x",
            "colormap": "viridis",
            "opacity": 0.8,
            "basemap": "streets",
        },
        "transition": "fly-to",
        "overlay_position": "left",
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], ScrollytellingChapter)


def test_map_chapter_parses():
    payload = {
        "id": "a",
        "order": 0,
        "type": "map",
        "title": "T",
        "narrative": "",
        "map_state": {
            "center": [0, 0],
            "zoom": 2,
            "bearing": 0,
            "pitch": 0,
            "basemap": "streets",
        },
        "layer_config": {
            "dataset_id": "x",
            "colormap": "viridis",
            "opacity": 0.8,
            "basemap": "streets",
        },
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], MapChapter)


def test_prose_chapter_parses_without_map_fields():
    payload = {
        "id": "a",
        "order": 0,
        "type": "prose",
        "title": "T",
        "narrative": "Body",
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], ProseChapter)


def test_image_chapter_parses():
    payload = {
        "id": "a",
        "order": 0,
        "type": "image",
        "title": "T",
        "narrative": "",
        "image": {
            "asset_id": "asset-1",
            "url": "https://example.com/img.jpg",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "alt_text": "",
            "width": 1024,
            "height": 768,
        },
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], ImageChapter)


def test_video_chapter_parses():
    payload = {
        "id": "a",
        "order": 0,
        "type": "video",
        "title": "T",
        "narrative": "",
        "video": {
            "provider": "youtube",
            "video_id": "dQw4w9WgXcQ",
            "original_url": "https://youtu.be/dQw4w9WgXcQ",
        },
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], VideoChapter)


def test_chart_chapter_with_csv_source_parses():
    payload = {
        "id": "a",
        "order": 0,
        "type": "chart",
        "title": "T",
        "narrative": "",
        "chart": {
            "source": {
                "kind": "csv",
                "asset_id": "asset-1",
                "url": "https://example.com/data.csv",
                "columns": ["year", "value"],
            },
            "viz": {
                "kind": "line",
                "x_field": "year",
                "y_fields": ["value"],
                "y_scale": "linear",
            },
        },
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], ChartChapter)


def test_chart_chapter_with_dataset_timeseries_source_parses():
    payload = {
        "id": "a",
        "order": 0,
        "type": "chart",
        "title": "T",
        "narrative": "",
        "chart": {
            "source": {
                "kind": "dataset_timeseries",
                "dataset_id": "ds-1",
                "point": [12.5, 41.9],
            },
            "viz": {
                "kind": "line",
                "x_field": "datetime",
                "y_fields": ["value"],
            },
        },
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], ChartChapter)


def test_chart_chapter_with_dataset_histogram_source_parses():
    payload = {
        "id": "a",
        "order": 0,
        "type": "chart",
        "title": "T",
        "narrative": "",
        "chart": {
            "source": {
                "kind": "dataset_histogram",
                "dataset_id": "ds-1",
                "bins": 20,
            },
            "viz": {
                "kind": "bar",
                "x_field": "bin",
                "y_fields": ["count"],
            },
        },
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], ChartChapter)


def test_story_update_accepts_new_chapter_types():
    payload = {
        "chapters": [
            {
                "id": "a",
                "order": 0,
                "type": "image",
                "title": "T",
                "narrative": "",
                "image": {
                    "asset_id": "asset-1",
                    "url": "https://example.com/img.jpg",
                    "thumbnail_url": "https://example.com/thumb.jpg",
                    "alt_text": "",
                    "width": 100,
                    "height": 100,
                },
            },
            {
                "id": "b",
                "order": 1,
                "type": "chart",
                "title": "T",
                "narrative": "",
                "chart": {
                    "source": {
                        "kind": "dataset_histogram",
                        "dataset_id": "ds-1",
                        "bins": 20,
                    },
                    "viz": {
                        "kind": "bar",
                        "x_field": "bin",
                        "y_fields": ["count"],
                    },
                },
            },
        ],
    }
    update = StoryUpdate(**payload)
    assert update.chapters is not None
    assert isinstance(update.chapters[0], ImageChapter)
    assert isinstance(update.chapters[1], ChartChapter)


def test_image_chapter_rejects_negative_dimensions():
    payload = {
        "id": "a",
        "order": 0,
        "type": "image",
        "title": "T",
        "narrative": "",
        "image": {
            "asset_id": "asset-1",
            "url": "https://example.com/img.jpg",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "alt_text": "",
            "width": -1,
            "height": 100,
        },
    }
    with pytest.raises(ValidationError):
        StoryCreate(chapters=[payload])


def test_chart_chapter_histogram_rejects_bins_below_two():
    payload = {
        "id": "a",
        "order": 0,
        "type": "chart",
        "title": "T",
        "narrative": "",
        "chart": {
            "source": {"kind": "dataset_histogram", "dataset_id": "ds-1", "bins": 1},
            "viz": {"kind": "bar", "x_field": "bin", "y_fields": ["count"]},
        },
    }
    with pytest.raises(ValidationError):
        StoryCreate(chapters=[payload])


def test_chart_chapter_histogram_rejects_bins_above_one_hundred():
    payload = {
        "id": "a",
        "order": 0,
        "type": "chart",
        "title": "T",
        "narrative": "",
        "chart": {
            "source": {"kind": "dataset_histogram", "dataset_id": "ds-1", "bins": 101},
            "viz": {"kind": "bar", "x_field": "bin", "y_fields": ["count"]},
        },
    }
    with pytest.raises(ValidationError):
        StoryCreate(chapters=[payload])


@pytest.mark.parametrize("bins", [2, 100])
def test_chart_chapter_histogram_accepts_boundary_bin_counts(bins):
    payload = {
        "id": "a",
        "order": 0,
        "type": "chart",
        "title": "T",
        "narrative": "",
        "chart": {
            "source": {"kind": "dataset_histogram", "dataset_id": "ds-1", "bins": bins},
            "viz": {"kind": "bar", "x_field": "bin", "y_fields": ["count"]},
        },
    }
    story = StoryCreate(chapters=[payload])
    assert isinstance(story.chapters[0], ChartChapter)


def test_unknown_chapter_type_rejected():
    payload = {
        "id": "a",
        "order": 0,
        "type": "definitely-not-a-type",
        "title": "T",
        "narrative": "",
    }
    with pytest.raises(ValidationError):
        StoryCreate(chapters=[payload])
