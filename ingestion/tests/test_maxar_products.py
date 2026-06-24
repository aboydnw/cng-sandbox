from src.services.source_coop_config import get_product


def test_maxar_lahaina_product_registered():
    product = get_product("maxar/lahaina")

    assert product.enumerator == "maxar_event"
    assert product.kind == "mosaic"
    assert product.listing_url.endswith("collection.json")
    assert "maxar-opendata" in product.listing_url
