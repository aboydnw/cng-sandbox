"""Convert Shapefile/GeoJSON to GeoParquet using geopandas (our baseline)."""

import time
from pathlib import Path

from .base import ConverterResult

TOOL_NAME = "geopandas"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    try:
        import geopandas as gpd
    except ImportError:
        return ConverterResult(
            tool=TOOL_NAME, status="skipped",
            error_message="geopandas not installed",
            duration_seconds=0.0,
        )

    start = time.monotonic()
    try:
        gdf = gpd.read_file(input_path)
        gdf.to_parquet(output_path)
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="success",
            error_message=None, duration_seconds=elapsed,
        )
    except Exception as e:
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="error",
            error_message=str(e), duration_seconds=elapsed,
        )
