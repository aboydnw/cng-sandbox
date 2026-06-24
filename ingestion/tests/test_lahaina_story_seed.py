from src.services.example_stories import ALL_STORIES, _build_chapter_dict


def _find_story(title):
    return next(s for s in ALL_STORIES if s.title.startswith(title))


def test_lahaina_story_present_and_references_both_datasets():
    story = _find_story("Lahaina")
    urls = {ch.dataset_source_url for ch in story.chapters if ch.dataset_source_url}
    assert any(u.endswith("#pre") for u in urls)
    assert any(u.endswith("#post") for u in urls)


def test_lahaina_map_chapter_builds_rgb_layer_config():
    story = _find_story("Lahaina")
    map_chapter = next(ch for ch in story.chapters if ch.dataset_source_url)
    built = _build_chapter_dict(map_chapter, order=0, dataset_id="ds-123")
    assert built["layer_config"]["dataset_id"] == "ds-123"
    assert built["map_state"]["center"] == [
        map_chapter.center[0],
        map_chapter.center[1],
    ]
