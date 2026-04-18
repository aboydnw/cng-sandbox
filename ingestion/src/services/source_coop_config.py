"""Hardcoded registry of curated source.coop products for v1.

Each entry describes a product the user can connect from the homepage gallery.
The backend uses this registry to resolve a slug to a listing URL and an
enumerator strategy; the frontend has a mirror of this data for display in
frontend/src/lib/sourceCoopCatalog.ts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass(frozen=True)
class SourceCoopProduct:
    slug: str
    name: str
    description: str
    listing_url: str
    kind: Literal["mosaic", "pmtiles"] = "mosaic"
    enumerator: str = ""
    enumerator_args: dict[str, Any] = field(default_factory=dict)
    is_temporal: bool = False
    pmtiles_url: str | None = None

    def __post_init__(self) -> None:
        if self.kind == "pmtiles":
            if not self.pmtiles_url:
                raise ValueError(f"{self.slug}: pmtiles kind requires pmtiles_url")
            if self.enumerator:
                raise ValueError(f"{self.slug}: pmtiles kind must not set enumerator")
            if self.enumerator_args:
                raise ValueError(
                    f"{self.slug}: pmtiles kind must not set enumerator_args"
                )
            if self.is_temporal:
                raise ValueError(f"{self.slug}: pmtiles kind must not set is_temporal")
        elif self.kind == "mosaic":
            if not self.enumerator:
                raise ValueError(f"{self.slug}: mosaic kind requires enumerator")
            if self.pmtiles_url:
                raise ValueError(f"{self.slug}: mosaic kind must not set pmtiles_url")


_PRODUCTS: dict[str, SourceCoopProduct] = {
    "ausantarctic/ghrsst-mur-v2": SourceCoopProduct(
        slug="ausantarctic/ghrsst-mur-v2",
        name="GHRSST MUR v2 — Daily Global SST",
        description=(
            "Multi-scale Ultra-high Resolution sea surface temperature analysis, "
            "daily global coverage across the product's full temporal range."
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
        enumerator="path_listing",
        enumerator_args={},
        is_temporal=False,
    ),
    "vizzuality/lg-land-carbon-data": SourceCoopProduct(
        slug="vizzuality/lg-land-carbon-data",
        name="Land & Carbon Lab: Deforestation Carbon Emissions",
        description=(
            "Gross carbon emissions from deforestation at 100 m resolution, "
            "produced by the WRI Land & Carbon Lab. The source bucket holds an "
            "atlas of related layers; this example pins the headline emissions "
            "raster so the mosaic stays coherent."
        ),
        listing_url="https://data.source.coop/vizzuality/lg-land-carbon-data/",
        enumerator="path_listing",
        enumerator_args={"filenames": ["deforest_carbon_100m_cog.tif"]},
        is_temporal=False,
    ),
    "vida/google-microsoft-osm-open-buildings": SourceCoopProduct(
        slug="vida/google-microsoft-osm-open-buildings",
        name="Global Buildings (VIDA)",
        description=(
            "Combined Google, Microsoft, and OpenStreetMap building "
            "footprints worldwide, published as a single PMTiles archive."
        ),
        listing_url="https://data.source.coop/vida/google-microsoft-osm-open-buildings/",
        kind="pmtiles",
        pmtiles_url="https://data.source.coop/vida/google-microsoft-osm-open-buildings/pmtiles/goog_msft_osm.pmtiles",
    ),
}


def list_products() -> list[SourceCoopProduct]:
    """Return all curated products in registration order."""
    return list(_PRODUCTS.values())


def get_product(slug: str) -> SourceCoopProduct:
    """Look up a product by slug. Raises KeyError if not found."""
    return _PRODUCTS[slug]
