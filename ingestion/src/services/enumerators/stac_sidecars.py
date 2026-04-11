"""stac_sidecars enumerator: find colocated .stac-item.json files and read them.

Two modes:
    - Flat: list a single directory, read every .stac-item.json found there.
    - Recursive: walk nested prefixes (e.g. YYYY/MM/DD/), reading sidecars at
      each leaf. Used for products like GHRSST MUR v2.

Each sidecar must contain an asset with role 'data' or (failing that) the
first asset whose href ends in .tif or .tiff. The asset href, properties.datetime,
and bbox are extracted and returned as a RemoteItem.
"""

from __future__ import annotations

import logging
from datetime import datetime
from urllib.parse import urljoin

import httpx

from src.services.discovery import fetch_and_discover
from src.services.enumerators import RemoteItem

logger = logging.getLogger(__name__)

SIDECAR_SUFFIX = ".stac-item.json"


async def list_sidecars(listing_url: str) -> list[str]:
    """List sidecar JSON URLs in a single directory using fetch_and_discover."""
    discovered = await fetch_and_discover(listing_url)
    return [f.url for f in discovered if f.url.endswith(SIDECAR_SUFFIX)]


def _resolve_asset_href(sidecar_url: str, relative_href: str) -> str:
    """Resolve a possibly-relative asset href against the sidecar URL."""
    if relative_href.startswith(("http://", "https://")):
        return relative_href
    return urljoin(sidecar_url, relative_href)


def _pick_data_asset(sidecar: dict) -> dict | None:
    """Return the asset dict for the primary data asset, or None."""
    assets = sidecar.get("assets", {})
    for name, asset in assets.items():
        roles = asset.get("roles", [])
        if "data" in roles:
            return asset
    for name, asset in assets.items():
        href = asset.get("href", "")
        if href.lower().endswith((".tif", ".tiff")):
            return asset
    return None


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _read_sidecar(client: httpx.AsyncClient, url: str) -> RemoteItem | None:
    try:
        resp = await client.get(url, timeout=15.0)
        if resp.status_code >= 400:
            logger.warning("Sidecar %s returned status %d", url, resp.status_code)
            return None
        sidecar = resp.json()
    except Exception:
        logger.exception("Failed to read sidecar %s", url)
        return None

    asset = _pick_data_asset(sidecar)
    if asset is None:
        logger.warning("No data asset in sidecar %s", url)
        return None

    href = _resolve_asset_href(url, asset["href"])
    dt = _parse_datetime(sidecar.get("properties", {}).get("datetime"))
    bbox = sidecar.get("bbox")
    return RemoteItem(href=href, datetime=dt, bbox=bbox)


async def enumerate_stac_sidecars(
    listing_url: str, recursive: bool = False
) -> list[RemoteItem]:
    """Enumerate sidecar-backed items under a listing URL."""
    if recursive:
        sidecar_urls = await _list_sidecars_recursive(listing_url)
    else:
        sidecar_urls = await list_sidecars(listing_url)

    items: list[RemoteItem] = []
    async with httpx.AsyncClient() as client:
        for url in sidecar_urls:
            item = await _read_sidecar(client, url)
            if item is not None:
                items.append(item)
    return items


async def _list_sidecars_recursive(listing_url: str) -> list[str]:
    """Placeholder — implemented in Task 5."""
    raise NotImplementedError("Recursive listing is added in Task 5")
