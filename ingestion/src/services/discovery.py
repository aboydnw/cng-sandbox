"""URL discovery service for finding geospatial files from web pages and S3 listings."""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

from src.services.url_validation import SSRFError, raise_if_redirect

_SUPPORTED_EXTENSIONS = {
    ".tif",
    ".tiff",
    ".geojson",
    ".json",
    ".nc",
    ".nc4",
    ".h5",
    ".hdf5",
}


class DiscoveryError(Exception):
    pass


@dataclass
class DiscoveredFile:
    url: str
    filename: str


def extract_file_links(html: str, base_url: str) -> list[DiscoveredFile]:
    """Parse HTML and return geospatial file links resolved against base_url."""
    soup = BeautifulSoup(html, "html.parser")
    seen: dict[str, DiscoveredFile] = {}

    for tag in soup.find_all("a", href=True):
        href: str = tag["href"]
        ext = _get_extension(href)
        if ext not in _SUPPORTED_EXTENSIONS:
            continue
        absolute = urljoin(base_url, href)
        if absolute not in seen:
            seen[absolute] = DiscoveredFile(
                url=absolute, filename=_filename_from_url(absolute)
            )

    return _filter_to_most_common_extension(list(seen.values()))


def _parse_s3_listing(xml_text: str, base_url: str) -> list[DiscoveredFile]:
    """Parse an S3 ListBucket XML response and return geospatial file links.

    S3 ListBucket responses return object keys relative to the bucket. When the
    listing is served under a URL like ``https://host/bucket/prefix/`` (e.g.
    source.coop) the bucket name is part of the URL path, and the ``Name``
    element in the XML holds the bucket. Absolute URLs for each object are
    therefore ``origin + / + bucket + / + key``.

    For listings served directly at the bucket root (e.g. ``https://bucket.s3
    .amazonaws.com/``) the bucket is the host and keys stand alone, so we fall
    back to ``origin + / + key``.
    """
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
        soup = BeautifulSoup(xml_text, "html.parser")
    origin = _origin(base_url)
    seen: dict[str, DiscoveredFile] = {}

    parsed_base = urlparse(base_url)
    base_path_segments = [seg for seg in parsed_base.path.split("/") if seg]

    name_tag = soup.find("name")
    bucket = name_tag.get_text().strip() if name_tag else ""
    bucket_in_path = bool(
        bucket and base_path_segments and base_path_segments[0] == bucket
    )

    for key_tag in soup.find_all("key"):
        key = key_tag.get_text()
        ext = _get_extension(key)
        if ext not in _SUPPORTED_EXTENSIONS:
            continue
        if bucket_in_path:
            absolute = f"{origin}/{bucket}/{key}"
        else:
            path = key if key.startswith("/") else f"/{key}"
            absolute = origin + path
        if absolute not in seen:
            seen[absolute] = DiscoveredFile(
                url=absolute, filename=_filename_from_url(absolute)
            )

    return _filter_to_most_common_extension(list(seen.values()))


async def fetch_and_discover(url: str) -> list[DiscoveredFile]:
    """Fetch a URL and discover geospatial files from its content."""
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=30.0) as client:
            response = await client.get(url)
            raise_if_redirect(response)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            text = response.text

            if "xml" in content_type or text.lstrip().startswith("<?xml"):
                return _parse_s3_listing(text, url)
            return extract_file_links(text, url)
    except SSRFError as e:
        raise DiscoveryError(str(e)) from e
    except httpx.ConnectError as e:
        raise DiscoveryError(f"Could not connect to {url}") from e
    except httpx.TimeoutException as e:
        raise DiscoveryError(f"Request timed out fetching {url}") from e
    except httpx.HTTPStatusError as e:
        raise DiscoveryError(f"HTTP {e.response.status_code} fetching {url}") from e


def _get_extension(path: str) -> str:
    parsed = urlparse(path)
    name = parsed.path.rsplit("/", 1)[-1]
    if "." in name:
        return "." + name.rsplit(".", 1)[-1].lower()
    return ""


def _filename_from_url(url: str) -> str:
    return urlparse(url).path.rsplit("/", 1)[-1]


def _origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _filter_to_most_common_extension(
    files: list[DiscoveredFile],
) -> list[DiscoveredFile]:
    if not files:
        return files

    counts: dict[str, int] = {}
    for f in files:
        ext = _get_extension(f.url)
        counts[ext] = counts.get(ext, 0) + 1

    most_common = max(counts, key=lambda e: counts[e])
    return [f for f in files if _get_extension(f.url) == most_common]
