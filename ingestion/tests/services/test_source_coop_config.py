import pytest

from src.services.source_coop_config import (
    SourceCoopProduct,
    get_product,
    list_products,
)


def test_list_products_returns_three_v1_entries():
    products = list_products()
    slugs = {p.slug for p in products}
    assert slugs == {
        "ausantarctic/ghrsst-mur-v2",
        "alexgleith/gebco-2024",
        "vizzuality/lg-land-carbon-data",
    }


def test_get_product_returns_metadata():
    p = get_product("alexgleith/gebco-2024")
    assert isinstance(p, SourceCoopProduct)
    assert p.name
    assert p.description
    assert p.listing_url.startswith("https://data.source.coop/")
    assert p.enumerator in ("stac_sidecars", "path_listing")


def test_get_product_unknown_raises():
    with pytest.raises(KeyError):
        get_product("nonexistent/product")


def test_ghrsst_uses_recursive_sidecars():
    p = get_product("ausantarctic/ghrsst-mur-v2")
    assert p.enumerator == "stac_sidecars"
    assert p.enumerator_args.get("recursive") is True
    assert p.enumerator_args.get("start_prefix") == "2024/"


def test_gebco_uses_path_listing():
    p = get_product("alexgleith/gebco-2024")
    assert p.enumerator == "path_listing"


def test_lg_land_uses_path_listing():
    p = get_product("vizzuality/lg-land-carbon-data")
    assert p.enumerator == "path_listing"


def test_lg_land_pins_single_deforestation_emissions_raster():
    p = get_product("vizzuality/lg-land-carbon-data")
    assert p.enumerator_args.get("filenames") == ["deforest_carbon_100m_cog.tif"]


def test_product_defaults_to_mosaic_kind():
    p = get_product("alexgleith/gebco-2024")
    assert p.kind == "mosaic"
    assert p.pmtiles_url is None


def test_pmtiles_product_validates_required_fields():
    with pytest.raises(ValueError):
        SourceCoopProduct(
            slug="test/bad",
            name="bad",
            description="bad",
            listing_url="https://data.source.coop/test/bad/",
            kind="pmtiles",
            pmtiles_url=None,
        )


def test_pmtiles_product_rejects_enumerator_fields():
    with pytest.raises(ValueError):
        SourceCoopProduct(
            slug="test/bad",
            name="bad",
            description="bad",
            listing_url="https://data.source.coop/test/bad/",
            kind="pmtiles",
            pmtiles_url="https://data.source.coop/test/bad/x.pmtiles",
            enumerator="path_listing",
        )


def test_pmtiles_product_accepts_valid_shape():
    p = SourceCoopProduct(
        slug="test/good",
        name="good",
        description="good",
        listing_url="https://data.source.coop/test/good/",
        kind="pmtiles",
        pmtiles_url="https://data.source.coop/test/good/x.pmtiles",
    )
    assert p.kind == "pmtiles"
    assert p.pmtiles_url == "https://data.source.coop/test/good/x.pmtiles"
    assert p.enumerator == ""
    assert p.is_temporal is False
