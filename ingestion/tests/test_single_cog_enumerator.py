from src.services import example_datasets
from src.services.enumerators.single_cog import enumerate_single_cog
from src.services.source_coop_config import SourceCoopProduct


async def test_single_cog_returns_one_bboxless_item():
    items = await enumerate_single_cog("https://x/scene.tif")
    assert len(items) == 1
    assert items[0].href == "https://x/scene.tif"
    assert items[0].bbox is None


async def test_run_enumerator_dispatches_single_cog(monkeypatch):
    called = {}

    async def fake(cog_url):
        called["url"] = cog_url
        return ["sentinel"]

    monkeypatch.setattr(example_datasets, "enumerate_single_cog", fake)

    product = SourceCoopProduct(
        slug="openaerialmap/x",
        name="X",
        description="",
        listing_url="https://x/scene.tif",
        enumerator="single_cog",
    )
    result = await example_datasets.run_enumerator(product)

    assert result == ["sentinel"]
    assert called == {"url": "https://x/scene.tif"}
