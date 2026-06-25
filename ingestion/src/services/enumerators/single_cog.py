"""single_cog enumerator: register one directly-addressed public COG URL.

Used for sources (e.g. OpenAerialMap) that expose a single COG at a stable
HTTPS URL rather than a listable prefix or STAC catalog. Bounds are left None
so register_remote_collection probes them from the COG.
"""

from __future__ import annotations

from src.services.enumerators import RemoteItem


async def enumerate_single_cog(cog_url: str) -> list[RemoteItem]:
    """Return a single RemoteItem for a direct COG URL."""
    return [RemoteItem(href=cog_url, datetime=None, bbox=None)]
