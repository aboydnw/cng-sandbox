"""Fetch external image / thumbnail assets and stage them in the export zip.

Mirrors `frontend/src/lib/story/archival/inlineAsset.ts` so static archival
and interactive archival surface the same images.

SSRF protection: routes the fetch through the same `validate_url_safe` +
`raise_if_redirect` pair used by the chart CSV fetcher. Network errors return
None — image chapters degrade to a missing-image placeholder in the runtime
rather than failing the entire export.
"""

from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import urlparse

import httpx

from src.services.url_validation import SSRFError, raise_if_redirect, validate_url_safe

logger = logging.getLogger(__name__)

_CONTENT_TYPE_EXTS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}


def _extension_for(url: str, content_type: str | None) -> str:
    if content_type:
        primary = content_type.split(";")[0].strip().lower()
        ext = _CONTENT_TYPE_EXTS.get(primary)
        if ext:
            return ext
    path = urlparse(url).path
    if "." in path:
        return "." + path.rsplit(".", 1)[1].lower()[:8]
    return ".bin"


def fetch_into(url: str, assets_dir: Path, slug: str) -> str | None:
    """Fetch `url` into `assets_dir`, name the file `<slug><ext>`.

    Returns the basename of the written file, or None on failure.
    """
    if not url:
        return None
    try:
        validate_url_safe(url)
    except SSRFError as exc:
        logger.warning("asset_inline: refusing to fetch %s: %s", url, exc)
        return None

    try:
        resp = httpx.get(url, timeout=15.0, follow_redirects=False)
        raise_if_redirect(resp)
        resp.raise_for_status()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("asset_inline: fetch failed for %s: %s", url, exc)
        return None

    ext = _extension_for(url, resp.headers.get("content-type"))
    out_name = f"{slug}{ext}"
    (assets_dir / out_name).write_bytes(resp.content)
    return out_name
