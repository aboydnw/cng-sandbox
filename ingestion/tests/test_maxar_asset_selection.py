from src.services.enumerators.stac_sidecars import pick_rgb_asset


def test_pick_rgb_asset_prefers_visual_role():
    item = {
        "assets": {
            "b1": {"href": "https://x/b1.tif", "roles": ["data"]},
            "visual": {"href": "https://x/visual.tif", "roles": ["visual"]},
        }
    }
    assert pick_rgb_asset(item)["href"] == "https://x/visual.tif"


def test_pick_rgb_asset_prefers_visual_key_without_roles():
    item = {
        "assets": {
            "b1": {"href": "https://x/b1.tif"},
            "visual": {"href": "https://x/visual.tif"},
        }
    }
    assert pick_rgb_asset(item)["href"] == "https://x/visual.tif"


def test_pick_rgb_asset_falls_back_to_data_role():
    item = {"assets": {"d": {"href": "https://x/d.tif", "roles": ["data"]}}}
    assert pick_rgb_asset(item)["href"] == "https://x/d.tif"


def test_pick_rgb_asset_none_when_no_assets():
    assert pick_rgb_asset({"assets": {}}) is None
