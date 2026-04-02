"""COG (Cloud Optimized GeoTIFF) detection for local and remote rasters."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import rasterio


@dataclass
class CogCheckResult:
    is_cog: bool
    has_tiling: bool
    has_overviews: bool


def check_is_cog(path: str) -> CogCheckResult:
    """Check whether a raster file meets COG requirements."""
    with rasterio.open(path) as ds:
        block_shapes = ds.block_shapes
        has_tiling = bool(block_shapes) and all(h == w for h, w in block_shapes)
        has_overviews = any(len(ds.overviews(i + 1)) > 0 for i in range(ds.count))

    is_cog = has_tiling and has_overviews
    return CogCheckResult(
        is_cog=is_cog, has_tiling=has_tiling, has_overviews=has_overviews
    )


async def check_remote_is_cog(url: str) -> CogCheckResult:
    """Check whether a remote raster URL is a COG via GDAL's vsicurl."""
    return await asyncio.to_thread(check_is_cog, f"/vsicurl/{url}")
