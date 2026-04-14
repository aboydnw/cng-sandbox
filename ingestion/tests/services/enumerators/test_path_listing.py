from unittest.mock import AsyncMock, patch

import pytest

from src.services.enumerators.path_listing import enumerate_path_listing


@pytest.mark.asyncio
async def test_path_listing_returns_raster_items_only():
    fake_keys = [
        "file_a.tif",
        "file_b.tif",
        "README.md",
        "sidecar.stac-item.json",
    ]
    with patch(
        "src.services.enumerators.path_listing._list_one_level",
        new=AsyncMock(return_value=([], fake_keys)),
    ):
        items = await enumerate_path_listing(
            listing_url="https://data.source.coop/vizzuality/lg-land-carbon-data/"
        )

    assert len(items) == 2
    assert items[0].href == (
        "https://data.source.coop/vizzuality/lg-land-carbon-data/file_a.tif"
    )
    assert items[0].datetime is None
    assert items[0].bbox is None
    assert items[1].href == (
        "https://data.source.coop/vizzuality/lg-land-carbon-data/file_b.tif"
    )


@pytest.mark.asyncio
async def test_path_listing_returns_empty_when_no_files_found():
    with patch(
        "src.services.enumerators.path_listing._list_one_level",
        new=AsyncMock(return_value=([], [])),
    ):
        items = await enumerate_path_listing(listing_url="https://example.com/empty/")
    assert items == []


@pytest.mark.asyncio
async def test_path_listing_empty_filenames_allowlist_returns_nothing():
    with patch(
        "src.services.enumerators.path_listing._list_one_level",
        new=AsyncMock(return_value=([], ["a.tif", "b.tif"])),
    ):
        items = await enumerate_path_listing(
            listing_url="https://example.com/x/", filenames=[]
        )
    assert items == []


@pytest.mark.asyncio
async def test_path_listing_filenames_allowlist_excludes_other_rasters():
    fake_keys = [
        "deforest_100m_cog.tif",
        "deforest_carbon_100m_cog.tif",
        "natcrop_bii_100m_cog.tif",
        "README.md",
    ]
    with patch(
        "src.services.enumerators.path_listing._list_one_level",
        new=AsyncMock(return_value=([], fake_keys)),
    ):
        items = await enumerate_path_listing(
            listing_url="https://data.source.coop/vizzuality/lg-land-carbon-data/",
            filenames=["deforest_carbon_100m_cog.tif"],
        )

    assert len(items) == 1
    assert items[0].href.endswith("/deforest_carbon_100m_cog.tif")
