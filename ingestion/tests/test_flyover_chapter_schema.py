import pytest
from pydantic import ValidationError

from src.models.story import StoryCreate

FLYOVER = {
    "id": "c1",
    "order": 0,
    "type": "flyover",
    "title": "Around the peak",
    "narrative": "",
    "keyframes": [
        {
            "center": [86.9, 27.9],
            "zoom": 11,
            "bearing": 0,
            "pitch": 60,
            "caption": "hi",
        },
        {"center": [86.95, 28.0], "zoom": 11, "bearing": 90, "pitch": 60},
    ],
    "map_state": {
        "center": [86.9, 27.9],
        "zoom": 11,
        "bearing": 0,
        "pitch": 60,
        "basemap": "streets",
        "terrain": {"enabled": True, "exaggeration": 1.5},
    },
    "scroll_length": 1.5,
}


def test_flyover_chapter_round_trip():
    story = StoryCreate.model_validate({"title": "T", "chapters": [FLYOVER]})
    ch = story.chapters[0]
    assert ch.type == "flyover"
    assert len(ch.keyframes) == 2
    assert ch.layer_config is None
    assert ch.scroll_length == 1.5
    dumped = story.model_dump()["chapters"][0]
    assert dumped["keyframes"][0]["caption"] == "hi"
    assert dumped["map_state"]["terrain"] == {"enabled": True, "exaggeration": 1.5}


def test_flyover_scroll_length_defaults_to_one():
    chapter = {k: v for k, v in FLYOVER.items() if k != "scroll_length"}
    story = StoryCreate.model_validate({"title": "T", "chapters": [chapter]})
    assert story.chapters[0].scroll_length == 1


def test_flyover_accepts_optional_layer_config():
    chapter = {
        **FLYOVER,
        "layer_config": {
            "dataset_id": "ds-1",
            "colormap": "viridis",
            "opacity": 0.8,
            "basemap": "streets",
        },
    }
    story = StoryCreate.model_validate({"title": "T", "chapters": [chapter]})
    assert story.chapters[0].layer_config.dataset_id == "ds-1"


def test_flyover_rejects_malformed_keyframes():
    chapter = {**FLYOVER, "keyframes": [{"zoom": "not-a-number"}]}
    with pytest.raises(ValidationError):
        StoryCreate.model_validate({"title": "T", "chapters": [chapter]})
