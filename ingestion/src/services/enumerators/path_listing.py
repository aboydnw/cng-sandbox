"""path_listing enumerator: list a flat directory, return files as RemoteItems.

No datetime. No bbox. The registration pipeline must probe each COG to compute
its bounds before writing a pgSTAC item.
"""

from __future__ import annotations

from src.services.discovery import fetch_and_discover
from src.services.enumerators import RemoteItem


async def enumerate_path_listing(listing_url: str) -> list[RemoteItem]:
    """Enumerate files from a flat HTTP/S3 directory listing.

    Args:
        listing_url: URL returning an HTML index or S3 XML ListBucket response.
    """
    discovered = await fetch_and_discover(listing_url)
    return [
        RemoteItem(href=f.url, datetime=None, bbox=None) for f in discovered
    ]
