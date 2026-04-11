"""path_listing enumerator: list a flat S3 prefix, return files as RemoteItems.

No datetime. No bbox. The registration pipeline must probe each COG to compute
its bounds before writing a pgSTAC item.

Unlike ``fetch_and_discover`` (which applies a "most common extension" filter
that can accidentally drop the real data files when sidecars are tied), this
enumerator does its own paginated S3 ListObjectsV2 call at a single prefix and
keeps only files matching a whitelist of raster extensions.
"""

from __future__ import annotations

from urllib.parse import urljoin

from src.services.enumerators import RemoteItem
from src.services.enumerators.stac_sidecars import _list_one_level

_RASTER_EXTENSIONS = (".tif", ".tiff", ".nc", ".nc4", ".h5", ".hdf5")


async def enumerate_path_listing(listing_url: str) -> list[RemoteItem]:
    """Enumerate raster files from a flat S3 prefix.

    Args:
        listing_url: URL of the S3 prefix (e.g. ``https://host/bucket/prefix/``).
    """
    _common, keys = await _list_one_level(listing_url, prefix="")
    items: list[RemoteItem] = []
    for key in keys:
        if key.lower().endswith(_RASTER_EXTENSIONS):
            items.append(
                RemoteItem(href=urljoin(listing_url, key), datetime=None, bbox=None)
            )
    return items
