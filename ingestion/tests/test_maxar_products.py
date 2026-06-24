from src.services.source_coop_config import get_product


def test_maxar_lahaina_products_registered():
    pre = get_product("maxar/lahaina-pre")
    post = get_product("maxar/lahaina-post")

    assert pre.enumerator == "maxar_event"
    assert post.enumerator == "maxar_event"
    assert pre.listing_url != post.listing_url
    assert pre.enumerator_args.get("max_date") is not None
    assert post.enumerator_args.get("min_date") is not None
