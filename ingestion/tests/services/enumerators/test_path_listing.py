from unittest.mock import AsyncMock, patch

import pytest

from src.services.discovery import DiscoveredFile
from src.services.enumerators.path_listing import enumerate_path_listing


@pytest.mark.asyncio
async def test_path_listing_wraps_fetch_and_discover():
    fake_files = [
        DiscoveredFile(
            url="https://data.source.coop/vizzuality/lg-land-carbon-data/file_a.tif",
            filename="file_a.tif",
        ),
        DiscoveredFile(
            url="https://data.source.coop/vizzuality/lg-land-carbon-data/file_b.tif",
            filename="file_b.tif",
        ),
    ]
    with patch(
        "src.services.enumerators.path_listing.fetch_and_discover",
        new=AsyncMock(return_value=fake_files),
    ):
        items = await enumerate_path_listing(
            listing_url="https://data.source.coop/vizzuality/lg-land-carbon-data/"
        )

    assert len(items) == 2
    assert items[0].href == fake_files[0].url
    assert items[0].datetime is None
    assert items[0].bbox is None
    assert items[1].href == fake_files[1].url


@pytest.mark.asyncio
async def test_path_listing_returns_empty_when_no_files_found():
    with patch(
        "src.services.enumerators.path_listing.fetch_and_discover",
        new=AsyncMock(return_value=[]),
    ):
        items = await enumerate_path_listing(listing_url="https://example.com/empty/")
    assert items == []
