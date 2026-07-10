import itertools

from src.services.example_stories import (
    ALL_STORIES,
    GEBCO_URL,
    _build_chapter_dict,
)


def _story():
    return next(s for s in ALL_STORIES if s.title == "Earth's high places")


def _flyover_chapter():
    return next(c for c in _story().chapters if c.type == "flyover")


def test_high_places_story_meets_chapter_invariants():
    chapters = _story().chapters
    assert 6 <= len(chapters) <= 10
    assert {"scrollytelling", "prose", "map", "flyover"} <= {c.type for c in chapters}


def test_high_places_includes_a_terrain_orbit_flyover():
    ch = _flyover_chapter()
    assert ch.terrain
    assert ch.keyframes is not None
    assert len(ch.keyframes) >= 2
    assert ch.dataset_source_url is None


def test_flyover_keyframes_are_well_formed_and_gentle():
    kfs = _flyover_chapter().keyframes
    for k in kfs:
        assert set(k) >= {"center", "zoom", "bearing", "pitch"}
        assert len(k["center"]) == 2
    zooms = [k["zoom"] for k in kfs]
    for a, b in itertools.pairwise(zooms):
        assert abs(b - a) <= 3  # under the editor's pop-in warning threshold


def test_flyover_chapter_dict_shape():
    built = _build_chapter_dict(_flyover_chapter(), order=3, dataset_id=None)
    assert built["type"] == "flyover"
    assert built["scroll_length"] == 1.0
    assert len(built["keyframes"]) >= 2
    assert built["map_state"]["terrain"] == {"enabled": True, "exaggeration": 1.5}
    assert "layer_config" not in built
    assert "transition" not in built
    assert "overlay_position" not in built


def test_flyover_dict_never_gains_layer_config_even_with_dataset_id():
    # Passing a dataset_id must not attach a layer — that would flip the
    # terrain policy off for the whole chapter.
    built = _build_chapter_dict(_flyover_chapter(), order=3, dataset_id="ds-x")
    assert "layer_config" not in built


def test_high_places_exercises_all_three_3d_features():
    chapters = _story().chapters
    assert any(c.globe for c in chapters)
    assert any(c.terrain for c in chapters)
    assert any(c.buildings for c in chapters)


def test_terrain_chapters_carry_no_data_layer():
    # A chapter with a data overlay force-disables terrain (allowTerrain policy),
    # so terrain stops must be scene-setting only.
    for ch in _story().chapters:
        if ch.terrain:
            assert ch.dataset_source_url is None


def test_only_referenced_dataset_is_gebco():
    urls = {ch.dataset_source_url for ch in _story().chapters if ch.dataset_source_url}
    assert urls == {GEBCO_URL}


def test_3d_fields_flow_into_map_state():
    globe_ch = next(c for c in _story().chapters if c.globe)
    terrain_ch = next(c for c in _story().chapters if c.terrain)
    buildings_ch = next(c for c in _story().chapters if c.buildings)

    assert _build_chapter_dict(globe_ch, order=0, dataset_id=None)["map_state"]["globe"]
    assert _build_chapter_dict(terrain_ch, order=0, dataset_id=None)["map_state"][
        "terrain"
    ] == {"enabled": True, "exaggeration": 1.5}
    assert _build_chapter_dict(buildings_ch, order=0, dataset_id=None)["map_state"][
        "buildings"
    ]


def test_gebco_map_chapter_builds_layer_config():
    ch = next(c for c in _story().chapters if c.dataset_source_url == GEBCO_URL)
    built = _build_chapter_dict(ch, order=0, dataset_id="ds-gebco")
    assert built["layer_config"]["dataset_id"] == "ds-gebco"
