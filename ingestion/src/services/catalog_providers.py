"""Static configuration for external STAC catalog providers."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CatalogProvider:
    id: str
    name: str
    description: str
    stac_api_url: str

PROVIDERS: dict[str, CatalogProvider] = {
    "earth-search": CatalogProvider(
        id="earth-search",
        name="Earth Search",
        description="Sentinel-2, Landsat, NAIP, and Copernicus DEM from Element 84",
        stac_api_url="https://earth-search.aws.element84.com/v1",
    ),
}
