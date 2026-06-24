from src.services import example_datasets
from src.services.source_coop_config import SourceCoopProduct


async def test_run_enumerator_dispatches_maxar(monkeypatch):
    called = {}

    async def fake(collection_url, *, max_items=None, min_date=None, max_date=None):
        called["url"] = collection_url
        called["max_items"] = max_items
        called["max_date"] = max_date
        return ["sentinel"]

    monkeypatch.setattr(example_datasets, "enumerate_maxar_event", fake)

    product = SourceCoopProduct(
        slug="maxar/lahaina",
        name="Maxar Lahaina",
        description="",
        listing_url="https://maxar/collection.json",
        enumerator="maxar_event",
        enumerator_args={"max_items": 40, "max_date": "2023-08-07T00:00:00Z"},
    )

    result = await example_datasets.run_enumerator(product)

    assert result == ["sentinel"]
    assert called == {
        "url": "https://maxar/collection.json",
        "max_items": 40,
        "max_date": "2023-08-07T00:00:00Z",
    }
