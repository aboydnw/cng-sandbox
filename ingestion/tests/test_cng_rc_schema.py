from src.models.cng_rc import CngRcConfig, CngRcLayer


def test_minimal_config_validates():
    raw = {
        "version": "1",
        "origin": {
            "story_id": "abc-123",
            "workspace_id": "ws-xyz",
            "exported_at": "2026-04-28T10:00:00Z",
        },
        "metadata": {
            "title": "Coastal Erosion 2024",
            "description": None,
            "author": None,
            "created": "2026-01-01T00:00:00Z",
            "updated": "2026-04-28T00:00:00Z",
        },
        "chapters": [
            {
                "id": "ch-1",
                "type": "prose",
                "title": "Intro",
                "body": "Hello",
                "map": None,
                "layers": [],
            }
        ],
        "layers": {},
        "assets": {},
    }
    config = CngRcConfig.model_validate(raw)
    assert config.version == "1"
    assert config.origin.story_id == "abc-123"
    assert len(config.chapters) == 1


def test_layer_with_dual_urls_validates():
    raw = {
        "type": "raster-cog",
        "source_url": "https://source.coop/org/data.tif",
        "cng_url": "https://r2.cng.devseed.com/data.tif",
        "label": "Bathymetry",
        "attribution": "GEBCO",
        "render": {
            "colormap": "viridis",
            "rescale": [0, 1000],
            "opacity": 1.0,
            "band": 1,
            "timestep": None,
        },
    }
    layer = CngRcLayer.model_validate(raw)
    assert layer.source_url == "https://source.coop/org/data.tif"
    assert layer.cng_url == "https://r2.cng.devseed.com/data.tif"


def test_layer_allows_null_source_url():
    raw = {
        "type": "raster-cog",
        "source_url": None,
        "cng_url": "https://r2.cng.devseed.com/uploaded.tif",
        "label": "Local upload",
        "attribution": None,
        "render": {"colormap": "viridis", "rescale": [0, 1], "opacity": 1.0, "band": 1, "timestep": None},
    }
    layer = CngRcLayer.model_validate(raw)
    assert layer.source_url is None
