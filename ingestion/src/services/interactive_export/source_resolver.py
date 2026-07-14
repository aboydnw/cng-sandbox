"""Resolve a layer's `/storage/<key>` URL into a path the readers can open.

The ingestion pipeline stores converted COGs and GeoParquet in R2 and records
their location on the dataset row as `/storage/<key>`. This `/storage/...` form
is a virtual scheme that the rest of the codebase translates into either a
GDAL `/vsis3/<bucket>/<key>` path (for rasterio / rio_tiler) or an `s3://` URI
(for pyarrow / fsspec) when it actually needs to read the bytes.

The interactive export builder used to hand the raw `/storage/...` string to
`rio_tiler.Reader` and `geopandas.read_parquet`, which interpret it as a local
filesystem path and fail with `No such file or directory`. This module is the
shared translation layer so both the raster and vector paths agree on how to
turn the virtual URL into a real one.
"""

from __future__ import annotations

import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import httpx
import obstore

from src.services.storage import StorageService
from src.services.url_validation import raise_if_redirect, validate_url_safe

_STORAGE_PREFIX = "/storage/"


def _is_storage_url(url: str) -> bool:
    return url.startswith(_STORAGE_PREFIX)


def _storage_key(url: str) -> str:
    return url[len(_STORAGE_PREFIX) :].lstrip("/")


def resolve_raster_source(url: str, storage: StorageService | None = None) -> str:
    """Return a path or URL `rio_tiler.Reader` can open.

    For `/storage/<key>` virtual URLs, translates to `/vsis3/<bucket>/<key>` so
    GDAL streams the COG from R2. For any other input (https URL, local path,
    `s3://`), returns the input unchanged.
    """
    if not _is_storage_url(url):
        return url
    storage = storage or StorageService()
    return f"/vsis3/{storage.bucket}/{_storage_key(url)}"


@contextmanager
def vector_source_path(
    url: str,
    storage: StorageService | None = None,
) -> Iterator[str]:
    """Yield a path that `geopandas.read_*` can open.

    For `/storage/<key>` virtual URLs, downloads the object to a tempfile (the
    suffix is preserved so geopandas picks the right driver) and yields the
    local path; cleans up on exit. For any other input, yields it unchanged.
    """
    if not _is_storage_url(url):
        yield url
        return

    storage = storage or StorageService()
    key = _storage_key(url)
    suffix = "." + key.rsplit(".", 1)[1] if "." in key else ""

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as fd:
        tmp_path = Path(fd.name)
    try:
        try:
            result = obstore.get(storage.store, key)
        except Exception as exc:
            raise ValueError(f"vector source unavailable: {url} ({exc})") from exc
        tmp_path.write_bytes(bytes(result.bytes()))
        yield str(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)


def fetch_trips_json(
    src_url: str,
    out_path: Path,
    storage: StorageService | None = None,
) -> None:
    """Write a trajectory `trips.json` sidecar to `out_path`.

    For `/storage/<key>` virtual URLs, streams the object from R2. For absolute
    URLs, fetches through the SSRF-guarded `validate_url_safe` + `raise_if_redirect`
    pair. Raises on any failure — a missing trajectory fails the export loudly
    rather than silently dropping the layer.
    """
    if _is_storage_url(src_url):
        storage = storage or StorageService()
        key = _storage_key(src_url)
        try:
            result = obstore.get(storage.store, key)
        except Exception as exc:
            raise ValueError(f"trips source unavailable: {src_url} ({exc})") from exc
        out_path.write_bytes(bytes(result.bytes()))
        return

    validate_url_safe(src_url)
    resp = httpx.get(src_url, timeout=30.0, follow_redirects=False)
    raise_if_redirect(resp)
    resp.raise_for_status()
    out_path.write_bytes(resp.content)
