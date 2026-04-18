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
    assert "start_prefix" not in p.enumerator_args


def test_gebco_uses_path_listing():
    p = get_product("alexgleith/gebco-2024")
    assert p.enumerator == "path_listing"


def test_lg_land_uses_path_listing():
    p = get_product("vizzuality/lg-land-carbon-data")
    assert p.enumerator == "path_listing"


def test_lg_land_pins_single_deforestation_emissions_raster():
    p = get_product("vizzuality/lg-land-carbon-data")
    assert p.enumerator_args.get("filenames") == ["deforest_carbon_100m_cog.tif"]
