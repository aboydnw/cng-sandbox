"""Hardcoded registry of curated source.coop products for v1.

Each entry describes a product the user can connect from the homepage gallery.
The backend uses this registry to resolve a slug to a listing URL and an
enumerator strategy; the frontend has a mirror of this data for display in
frontend/src/lib/sourceCoopCatalog.ts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class SourceCoopProduct:
    slug: str
    name: str
    description: str
    listing_url: str
    enumerator: str
    enumerator_args: dict[str, Any] = field(default_factory=dict)
    is_temporal: bool = False


_PRODUCTS: dict[str, SourceCoopProduct] = {
    "ausantarctic/ghrsst-mur-v2": SourceCoopProduct(
        slug="ausantarctic/ghrsst-mur-v2",
        name="GHRSST MUR v2 — Daily Global SST",
        description=(
            "Multi-scale Ultra-high Resolution (MUR) sea surface temperature analysis, "
            "daily global coverage at 0.01° resolution."
        ),
        listing_url="https://data.source.coop/ausantarctic/ghrsst-mur-v2/",
        enumerator="stac_sidecars",
        enumerator_args={"recursive": True},
        is_temporal=True,
    ),
    "alexgleith/gebco-2024": SourceCoopProduct(
        slug="alexgleith/gebco-2024",
        name="GEBCO 2024 Bathymetry",
        description=(
            "Global ocean and land terrain model from the General Bathymetric Chart "
            "of the Oceans, 2024 release."
        ),
        listing_url="https://data.source.coop/alexgleith/gebco-2024/",
        enumerator="stac_sidecars",
        enumerator_args={"recursive": False},
        is_temporal=False,
    ),
    "vizzuality/lg-land-carbon-data": SourceCoopProduct(
        slug="vizzuality/lg-land-carbon-data",
        name="Land & Carbon Lab Carbon Data",
        description=(
            "Land carbon flux and stock rasters produced by the WRI Land & Carbon Lab."
        ),
        listing_url="https://data.source.coop/vizzuality/lg-land-carbon-data/",
        enumerator="path_listing",
        enumerator_args={},
        is_temporal=False,
    ),
}


def list_products() -> list[SourceCoopProduct]:
    """Return all curated products in registration order."""
    return list(_PRODUCTS.values())


def get_product(slug: str) -> SourceCoopProduct:
    """Look up a product by slug. Raises KeyError if not found."""
    return _PRODUCTS[slug]
