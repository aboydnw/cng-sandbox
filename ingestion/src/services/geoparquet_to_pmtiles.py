"""Convert a (remote or local) GeoParquet to PMTiles via tippecanoe."""

from __future__ import annotations

import logging
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

import httpx

from src.services.pmtiles_ingest import (
    _read_pmtiles_zoom_range,
    parquet_to_pmtiles_file,
)
from src.services.storage import StorageService

logger = logging.getLogger(__name__)


@dataclass
class ConversionResult:
    output_path: str
    feature_count: int
    min_zoom: int | None
    max_zoom: int | None
    file_size: int


def _download_if_remote(source_url: str, tmp_dir: str) -> str:
    """If source_url is an HTTP(S) URL, download to a local temp file and return its path."""
    if source_url.startswith(("http://", "https://")):
        local_path = os.path.join(tmp_dir, "source.parquet")
        logger.info("Downloading %s", source_url)
        with httpx.stream("GET", source_url, follow_redirects=True, timeout=300) as r:
            r.raise_for_status()
            with open(local_path, "wb") as f:
                for chunk in r.iter_bytes(chunk_size=8192):
                    f.write(chunk)
        return local_path
    return source_url


def convert_to_pmtiles(source_url: str, output_path: str) -> ConversionResult:
    """Download (if remote) and convert a GeoParquet to PMTiles.

    Sync — call via asyncio.to_thread() from async code.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as dl_tmp:
        local_parquet = _download_if_remote(source_url, dl_tmp)
        feature_count = parquet_to_pmtiles_file(local_parquet, str(out))

    min_zoom, max_zoom = _read_pmtiles_zoom_range(str(out))

    return ConversionResult(
        output_path=str(out),
        feature_count=feature_count,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        file_size=out.stat().st_size,
    )


def get_connection_pmtiles_tile_url(connection_id: str) -> str:
    """Return the frontend-relative tile URL for a converted connection PMTiles."""
    return f"/pmtiles/connections/{connection_id}/data.pmtiles"


def upload_pmtiles(
    path: str,
    connection_id: str,
    storage: StorageService | None = None,
) -> str:
    """Upload a PMTiles file to object storage under the connection key.

    Returns the frontend-relative tile URL (served via the /pmtiles Vite proxy).
    """
    store = storage or StorageService()
    key = f"connections/{connection_id}/data.pmtiles"
    store.upload_file(path, key)
    return get_connection_pmtiles_tile_url(connection_id)


def run_conversion(connection_id: str, session) -> None:
    """Run the full conversion pipeline for a connection row.

    Downloads the remote GeoParquet, converts to PMTiles, uploads to storage,
    and updates the row with tile_url/feature_count/zoom range. Swallows
    exceptions — records them on the row as status='failed'.
    """
    from src.models.connection import ConnectionRow

    row = session.get(ConnectionRow, connection_id)
    if row is None:
        logger.error("Connection %s not found", connection_id)
        return

    row.conversion_status = "running"
    session.commit()

    try:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / f"{connection_id}.pmtiles"
            result = convert_to_pmtiles(row.url, str(out))
            tile_url = upload_pmtiles(str(out), connection_id)

        row.tile_url = tile_url
        row.feature_count = result.feature_count
        row.min_zoom = result.min_zoom
        row.max_zoom = result.max_zoom
        row.file_size = result.file_size
        row.tile_type = "vector"
        row.conversion_status = "ready"
        row.conversion_error = None
        session.commit()
    except Exception as e:
        logger.exception("Conversion failed for %s", connection_id)
        row.conversion_status = "failed"
        row.conversion_error = str(e)[:2000]
        session.commit()
