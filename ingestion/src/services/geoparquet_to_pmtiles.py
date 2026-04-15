"""Convert a (remote or local) GeoParquet to PMTiles via tippecanoe."""
from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd

from src.services.pmtiles_ingest import _read_pmtiles_zoom_range

logger = logging.getLogger(__name__)


@dataclass
class ConversionResult:
    output_path: str
    feature_count: int
    min_zoom: int | None
    max_zoom: int | None
    file_size: int


def convert_to_pmtiles(source_url: str, output_path: str) -> ConversionResult:
    """Download (if remote) and convert a GeoParquet to PMTiles.

    Sync — call via asyncio.to_thread() from async code.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    # geopandas reads both local paths and https:// URLs via fsspec/pyarrow.
    gdf = gpd.read_parquet(source_url)
    gdf.columns = [c.lower() for c in gdf.columns]
    feature_count = len(gdf)
    if feature_count == 0:
        raise ValueError(f"GeoParquet at {source_url} has no features")

    with tempfile.TemporaryDirectory() as tmp:
        geojson_path = os.path.join(tmp, "data.geojson")
        gdf.to_file(geojson_path, driver="GeoJSON")

        cmd = [
            "tippecanoe",
            f"--output={out}",
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

    min_zoom, max_zoom = _read_pmtiles_zoom_range(str(out))
    return ConversionResult(
        output_path=str(out),
        feature_count=feature_count,
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        file_size=out.stat().st_size,
    )
