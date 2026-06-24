"""maxar_event enumerator: walk a Maxar Open Data event STAC collection.

Maxar publishes per-event STAC catalogs whose items carry a ``visual`` asset
(a 3-band RGB COG). This enumerator follows ``child``/``item`` links from an
event collection, selects the ``visual`` asset of each item, and returns
RemoteItems. Asset hrefs are resolved against the item URL since Maxar items
use relative hrefs. Optional ``min_date``/``max_date`` bounds isolate
pre-/post-event acquisition windows.
"""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urljoin

import httpx

from src.services.enumerators import RemoteItem
from src.services.enumerators.stac_sidecars import pick_rgb_asset


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _walk(
    client: httpx.AsyncClient, url: str, items: list[tuple[str, dict]]
) -> None:
    resp = await client.get(url)
    resp.raise_for_status()
    node = resp.json()
    if node.get("type") == "Feature":
        items.append((url, node))
        return
    for link in node.get("links", []):
        rel = link.get("rel")
        href = link.get("href")
        if rel in ("item", "child") and href:
            await _walk(client, urljoin(url, href), items)


async def enumerate_maxar_event(
    collection_url: str,
    *,
    max_items: int | None = None,
    min_date: str | None = None,
    max_date: str | None = None,
) -> list[RemoteItem]:
    """Walk a Maxar event STAC collection and return RemoteItems for the
    ``visual`` (RGB) asset of each item, optionally filtered to items whose
    ``datetime`` falls within [min_date, max_date] (inclusive ISO-8601 bounds).
    """
    lo = _parse_dt(min_date)
    hi = _parse_dt(max_date)
    fetch_url = collection_url.split("#", 1)[0]

    raw_items: list[tuple[str, dict]] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        await _walk(client, fetch_url, raw_items)

    remote: list[RemoteItem] = []
    for item_url, item in raw_items:
        asset = pick_rgb_asset(item)
        if asset is None:
            continue
        dt = _parse_dt(item.get("properties", {}).get("datetime"))
        if lo is not None and (dt is None or dt < lo):
            continue
        if hi is not None and (dt is None or dt > hi):
            continue
        href = urljoin(item_url, asset["href"])
        remote.append(RemoteItem(href=href, datetime=dt, bbox=item.get("bbox")))
        if max_items is not None and len(remote) >= max_items:
            break
    return remote
