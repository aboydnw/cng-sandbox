from src.services.example_stories import (
    ALL_STORIES,
    HATAY_DEFNE_URL,
    HATAY_FLIGHT1_URL,
    HATAY_TURINCLU_URL,
    _build_chapter_dict,
)


def _story():
    return next(s for s in ALL_STORIES if "Antakya" in s.title)


def test_antakya_story_references_all_three_datasets():
    urls = {ch.dataset_source_url for ch in _story().chapters if ch.dataset_source_url}
    assert urls == {HATAY_FLIGHT1_URL, HATAY_DEFNE_URL, HATAY_TURINCLU_URL}


def test_antakya_story_meets_chapter_invariants():
    chapters = _story().chapters
    assert 6 <= len(chapters) <= 10
    assert {"scrollytelling", "prose", "map"} <= {c.type for c in chapters}


def test_antakya_map_chapter_builds_layer_config():
    ch = next(c for c in _story().chapters if c.dataset_source_url)
    built = _build_chapter_dict(ch, order=0, dataset_id="ds-1")
    assert built["layer_config"]["dataset_id"] == "ds-1"
