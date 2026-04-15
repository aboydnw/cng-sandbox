"""Convert GeoParquet to PMTiles and upload for vector tile serving."""

import logging
import os
import subprocess
import tempfile

import geopandas as gpd

from src.services.storage import StorageService

logger = logging.getLogger(__name__)


def get_pmtiles_tile_url(dataset_id: str) -> str:
    """Return the frontend-relative tile URL for a PMTiles dataset."""
    return f"/pmtiles/datasets/{dataset_id}/converted/data.pmtiles"


def _read_pmtiles_zoom_range(pmtiles_path: str) -> tuple[int, int]:
    """Read min_zoom and max_zoom from a PMTiles v3 file header.

    PMTiles v3 spec: min_zoom at byte 100, max_zoom at byte 101.
    """
    with open(pmtiles_path, "rb") as f:
        header = f.read(102)
    if len(header) < 102 or header[:7] != b"PMTiles":
        raise ValueError(f"Not a valid PMTiles v3 file: {pmtiles_path}")
    return header[100], header[101]


def parquet_to_pmtiles_file(parquet_path: str, pmtiles_path: str) -> int:
    """Convert a GeoParquet file (local path or URL) to a PMTiles file on disk.

    Returns the feature count. Raises ValueError on empty input, RuntimeError
    on tippecanoe failure. Sync — call via asyncio.to_thread() from async code.
    """
    gdf = gpd.read_parquet(parquet_path)
    gdf.columns = [c.lower() for c in gdf.columns]
    feature_count = len(gdf)
    if feature_count == 0:
        raise ValueError(f"GeoParquet at {parquet_path} has no features")

    with tempfile.TemporaryDirectory() as tmpdir:
        geojson_path = os.path.join(tmpdir, "data.geojson")
        gdf.to_file(geojson_path, driver="GeoJSON")

        cmd = [
            "tippecanoe",
            f"--output={pmtiles_path}",
            "--no-feature-limit",
            "--no-tile-size-limit",
            "--force",
            "--maximum-zoom=g",
            "--layer=default",
            geojson_path,
        ]
        logger.info("Running tippecanoe: %s", " ".join(cmd))
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"tippecanoe failed:\n{result.stderr}")

    return feature_count


def ingest_pmtiles(
    dataset_id: str,
    parquet_path: str,
    _storage: StorageService | None = None,
) -> tuple[str, int, int, int]:
    """Convert GeoParquet to PMTiles and upload to S3.

    Returns (tile_url, min_zoom, max_zoom, file_size_bytes).

    Runs tippecanoe as a subprocess. tippecanoe generates zoom-appropriate
    tiles at each zoom level — no features are dropped and no simplification
    is applied to the stored data.

    This is a sync function — call via asyncio.to_thread() from async code.
    """
    storage = _storage or StorageService()

    with tempfile.TemporaryDirectory() as tmpdir:
        pmtiles_path = os.path.join(tmpdir, "data.pmtiles")
        parquet_to_pmtiles_file(parquet_path, pmtiles_path)
        storage.upload_pmtiles(pmtiles_path, dataset_id)
        min_zoom, max_zoom = _read_pmtiles_zoom_range(pmtiles_path)
        file_size = os.path.getsize(pmtiles_path)

    return get_pmtiles_tile_url(dataset_id), min_zoom, max_zoom, file_size
