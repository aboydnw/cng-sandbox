import pytest
from pydantic import ValidationError

from src.models.story import (
    MapChapter,
    ProseChapter,
    ScrollytellingChapter,
    StoryCreate,
    StoryRow,
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
        "map_state": {"center": [0, 0], "zoom": 2, "bearing": 0, "pitch": 0, "basemap": "streets"},
        "layer_config": {"dataset_id": "x", "colormap": "viridis", "opacity": 0.8, "basemap": "streets"},
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
        "map_state": {"center": [0, 0], "zoom": 2, "bearing": 0, "pitch": 0, "basemap": "streets"},
        "layer_config": {"dataset_id": "x", "colormap": "viridis", "opacity": 0.8, "basemap": "streets"},
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
