"""maxar_event enumerator: walk a Maxar Open Data event STAC collection.

Maxar publishes per-event STAC catalogs whose items carry a ``visual`` asset
(a 3-band RGB COG). This enumerator follows ``child``/``item`` links from an
event collection, selects the ``visual`` asset of each item, and returns
RemoteItems. Asset hrefs are resolved against the item URL since Maxar items
use relative hrefs. Optional ``min_date``/``max_date`` bounds isolate
pre-/post-event acquisition windows.
"""

from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import urljoin

import httpx

from src.services.enumerators import RemoteItem
from src.services.enumerators.stac_sidecars import pick_rgb_asset


def _parse_item_dt(value: str | None) -> datetime | None:
    """Parse a STAC item datetime, normalized to UTC; None if absent/malformed."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _parse_bound_dt(value: str | None) -> datetime | None:
    """Parse a filter bound to a UTC datetime; raise on malformed/naive input.

    Bounds must be explicit so a typo silently disabling the filter (and
    registering the wrong scenes) can't happen.
    """
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Invalid ISO-8601 date bound: {value!r}") from exc
    if dt.tzinfo is None:
        raise ValueError(f"Date bound must include a timezone: {value!r}")
    return dt.astimezone(UTC)


async def _walk(
    client: httpx.AsyncClient,
    url: str,
    items: list[tuple[str, dict]],
    *,
    limit: int | None = None,
) -> None:
    if limit is not None and len(items) >= limit:
        return
    resp = await client.get(url)
    resp.raise_for_status()
    node = resp.json()
    if node.get("type") == "Feature":
        items.append((url, node))
        return
    for link in node.get("links", []):
        if limit is not None and len(items) >= limit:
            return
        rel = link.get("rel")
        href = link.get("href")
        if rel in ("item", "child") and href:
            await _walk(client, urljoin(url, href), items, limit=limit)


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
    lo = _parse_bound_dt(min_date)
    hi = _parse_bound_dt(max_date)
    fetch_url = collection_url.split("#", 1)[0]

    # When no date filter is set, max_items can bound the crawl itself; with a
    # filter we must visit every item to decide which fall in range.
    walk_limit = max_items if lo is None and hi is None else None

    raw_items: list[tuple[str, dict]] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        await _walk(client, fetch_url, raw_items, limit=walk_limit)

    remote: list[RemoteItem] = []
    for item_url, item in raw_items:
        asset = pick_rgb_asset(item)
        if asset is None:
            continue
        dt = _parse_item_dt(item.get("properties", {}).get("datetime"))
        if lo is not None and (dt is None or dt < lo):
            continue
        if hi is not None and (dt is None or dt > hi):
            continue
        href = urljoin(item_url, asset["href"])
        remote.append(RemoteItem(href=href, datetime=dt, bbox=item.get("bbox")))
        if max_items is not None and len(remote) >= max_items:
            break
    return remote
