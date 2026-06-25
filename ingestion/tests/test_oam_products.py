from src.services.source_coop_config import get_product


def test_oam_hatay_products_registered():
    for slug in (
        "openaerialmap/hatay-flight1",
        "openaerialmap/hatay-defne",
        "openaerialmap/hatay-turinclu",
    ):
        p = get_product(slug)
        assert p.enumerator == "single_cog"
        assert p.kind == "mosaic"
        assert p.listing_url.startswith("https://oin-hotosm-temp.s3.amazonaws.com/")
        assert p.listing_url.endswith(".tif")
