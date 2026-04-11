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
import warnings
from datetime import datetime
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

from src.services.enumerators import RemoteItem

logger = logging.getLogger(__name__)

SIDECAR_SUFFIX = ".stac-item.json"


async def list_sidecars(listing_url: str) -> list[str]:
    """List sidecar JSON URLs in a single S3 prefix level.

    Uses ListObjectsV2 with ``delimiter=/`` so this is the "flat" (non-recursive)
    equivalent of ``_list_sidecars_recursive``.
    """
    _common, keys = await _list_one_level(listing_url, prefix="")
    return [urljoin(listing_url, key) for key in keys if key.endswith(SIDECAR_SUFFIX)]


def _resolve_asset_href(sidecar_url: str, relative_href: str) -> str:
    """Resolve a possibly-relative asset href against the sidecar URL."""
    if relative_href.startswith(("http://", "https://")):
        return relative_href
    return urljoin(sidecar_url, relative_href)


def _pick_data_asset(sidecar: dict) -> dict | None:
    """Return the asset dict for the primary data asset, or None."""
    assets = sidecar.get("assets", {})
    for asset in assets.values():
        roles = asset.get("roles", [])
        if "data" in roles:
            return asset
    for asset in assets.values():
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
    listing_url: str, recursive: bool = False, start_prefix: str = ""
) -> list[RemoteItem]:
    """Enumerate sidecar-backed items under a listing URL.

    When ``recursive`` is true, ``start_prefix`` limits the walk to a subtree
    (e.g. ``"2024/"`` to only ingest 2024 data). Ignored in flat mode.
    """
    if recursive:
        sidecar_urls = await _list_sidecars_recursive(
            listing_url, start_prefix=start_prefix
        )
    else:
        sidecar_urls = await list_sidecars(listing_url)

    items: list[RemoteItem] = []
    async with httpx.AsyncClient() as client:
        for url in sidecar_urls:
            item = await _read_sidecar(client, url)
            if item is not None:
                items.append(item)
    return items


async def _list_one_level(
    bucket_url: str, prefix: str
) -> tuple[list[str], list[str]]:
    """Call S3 ListObjectsV2 for a single level of a bucket.

    Paginates via NextContinuationToken until IsTruncated is false. Returns
    (common_prefixes, keys). common_prefixes are direct subdirectories under
    `prefix`, terminated by `/`. keys are full object keys at this level, both
    expressed relative to the product root (not full paths including the bucket
    prefix).
    """
    from urllib.parse import quote

    parsed = urlparse(bucket_url)
    base_path = parsed.path.strip("/")

    segments = base_path.split("/", 1) if base_path else [""]
    bucket = segments[0]
    bucket_prefix = segments[1] if len(segments) > 1 else ""
    if bucket_prefix and not bucket_prefix.endswith("/"):
        bucket_prefix = f"{bucket_prefix}/"

    full_prefix = f"{bucket_prefix}{prefix}"

    base_list_url = (
        f"{parsed.scheme}://{parsed.netloc}/{bucket}/"
        f"?list-type=2&prefix={full_prefix}&delimiter=/"
    )

    common: list[str] = []
    keys: list[str] = []
    continuation_token: str | None = None

    async with httpx.AsyncClient() as client:
        while True:
            list_url = base_list_url
            if continuation_token:
                list_url = (
                    f"{base_list_url}&continuation-token={quote(continuation_token)}"
                )

            resp = await client.get(list_url, timeout=30.0)
            resp.raise_for_status()
            xml_text = resp.text

            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
                soup = BeautifulSoup(xml_text, "html.parser")

            for cp in soup.find_all("commonprefixes"):
                prefix_tag = cp.find("prefix")
                if prefix_tag:
                    sub = prefix_tag.get_text()
                    if bucket_prefix and sub.startswith(bucket_prefix):
                        sub = sub[len(bucket_prefix) :]
                    common.append(sub)

            for contents in soup.find_all("contents"):
                key_tag = contents.find("key")
                if key_tag:
                    key = key_tag.get_text()
                    if bucket_prefix and key.startswith(bucket_prefix):
                        key = key[len(bucket_prefix) :]
                    keys.append(key)

            is_truncated_tag = soup.find("istruncated")
            if (
                not is_truncated_tag
                or is_truncated_tag.get_text().strip().lower() != "true"
            ):
                break

            next_token_tag = soup.find("nextcontinuationtoken")
            if not next_token_tag:
                break
            continuation_token = next_token_tag.get_text()

    return common, keys


async def _list_sidecars_recursive(
    listing_url: str, max_depth: int = 10, start_prefix: str = ""
) -> list[str]:
    """Walk nested bucket prefixes and return all sidecar URLs found.

    ``start_prefix`` sets the starting point for the walk. Defaults to ``""``
    (the product root). Pass e.g. ``"2024/"`` to only walk under that prefix.
    """
    sidecar_urls: list[str] = []
    stack: list[tuple[str, int]] = [(start_prefix, 0)]

    while stack:
        prefix, depth = stack.pop()
        common, keys = await _list_one_level(listing_url, prefix)

        for key in keys:
            if key.endswith(SIDECAR_SUFFIX):
                sidecar_urls.append(urljoin(listing_url, key))

        if depth < max_depth:
            for sub in common:
                stack.append((sub, depth + 1))

    return sidecar_urls
