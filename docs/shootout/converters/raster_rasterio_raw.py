"""Convert GeoTIFF to tiled TIFF using raw rasterio (known to fail COG validation)."""

import time
from pathlib import Path

from .base import ConverterResult

TOOL_NAME = "rasterio-raw"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    try:
        import rasterio
        from rasterio.enums import Resampling
    except ImportError:
        return ConverterResult(
            tool=TOOL_NAME, status="skipped",
            error_message="rasterio not installed",
            duration_seconds=0.0,
        )

    start = time.monotonic()
    try:
        with rasterio.open(input_path) as src:
            profile = src.profile.copy()
            profile.update(
                driver="GTiff",
                tiled=True,
                blockxsize=512,
                blockysize=512,
                compress="deflate",
            )
            with rasterio.open(output_path, "w", **profile) as dst:
                for band_idx in range(1, src.count + 1):
                    data = src.read(band_idx)
                    dst.write(data, band_idx)

                dst.build_overviews(
                    [2, 4, 8, 16, 32, 64],
                    Resampling.nearest,
                )
                dst.update_tags(ns="rio_overview", resampling="nearest")

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
