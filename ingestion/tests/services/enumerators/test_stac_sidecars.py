from unittest.mock import AsyncMock, patch

import httpx
import pytest

from src.services.enumerators.stac_sidecars import enumerate_stac_sidecars

GEBCO_SIDECAR = {
    "type": "Feature",
    "stac_version": "1.0.0",
    "id": "GEBCO_2024",
    "bbox": [-180.0, -90.0, 180.0, 90.0],
    "geometry": {
        "type": "Polygon",
        "coordinates": [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
    },
    "properties": {"datetime": "2024-06-01T00:00:00Z"},
    "assets": {
        "data": {
            "href": "./GEBCO_2024.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "roles": ["data"],
        }
    },
}


@pytest.mark.asyncio
async def test_stac_sidecars_single_item():
    sidecar_url = (
        "https://data.source.coop/alexgleith/gebco-2024/GEBCO_2024.stac-item.json"
    )

    async def fake_get(self, url, **kwargs):
        assert url == sidecar_url
        return httpx.Response(200, json=GEBCO_SIDECAR)

    with (
        patch(
            "src.services.enumerators.stac_sidecars.list_sidecars",
            new=AsyncMock(return_value=[sidecar_url]),
        ),
        patch.object(httpx.AsyncClient, "get", new=fake_get),
    ):
        items = await enumerate_stac_sidecars(
            listing_url="https://data.source.coop/alexgleith/gebco-2024/",
            recursive=False,
        )

    assert len(items) == 1
    item = items[0]
    assert item.href == "https://data.source.coop/alexgleith/gebco-2024/GEBCO_2024.tif"
    assert item.datetime is not None
    assert item.datetime.year == 2024
    assert item.datetime.month == 6
    assert item.bbox == [-180.0, -90.0, 180.0, 90.0]


@pytest.mark.asyncio
async def test_stac_sidecars_skips_sidecars_without_data_asset():
    sidecar_url = "https://example.com/broken.stac-item.json"
    broken = {**GEBCO_SIDECAR, "assets": {}}

    async def fake_get(self, url, **kwargs):
        return httpx.Response(200, json=broken)

    with (
        patch(
            "src.services.enumerators.stac_sidecars.list_sidecars",
            new=AsyncMock(return_value=[sidecar_url]),
        ),
        patch.object(httpx.AsyncClient, "get", new=fake_get),
    ):
        items = await enumerate_stac_sidecars(
            listing_url="https://example.com/",
            recursive=False,
        )

    assert items == []
