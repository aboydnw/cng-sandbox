from __future__ import annotations

import numpy as np
import rasterio
import rasterio.enums
import rasterio.transform

from src.services.cog_checker import check_is_cog


class TestCheckIsCog:
    def test_detects_cog_with_tiling_and_overviews(self, tmp_path):
        path = str(tmp_path / "tiled.tif")
        data = np.random.randint(0, 255, (1, 256, 256), dtype=np.uint8)
        transform = rasterio.transform.from_bounds(-180, -90, 180, 90, 256, 256)

        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            height=256,
            width=256,
            count=1,
            dtype=np.uint8,
            crs="EPSG:4326",
            transform=transform,
            tiled=True,
            blockxsize=256,
            blockysize=256,
        ) as dst:
            dst.write(data)
            dst.build_overviews([2], rasterio.enums.Resampling.nearest)
            dst.update_tags(ns="rio_overview", resampling="nearest")

        result = check_is_cog(path)
        assert result.is_cog is True
        assert result.has_tiling is True
        assert result.has_overviews is True

    def test_detects_non_cog_without_tiling(self, tmp_path):
        path = str(tmp_path / "strip.tif")
        data = np.random.randint(0, 255, (1, 256, 256), dtype=np.uint8)
        transform = rasterio.transform.from_bounds(-180, -90, 180, 90, 256, 256)

        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            height=256,
            width=256,
            count=1,
            dtype=np.uint8,
            crs="EPSG:4326",
            transform=transform,
        ) as dst:
            dst.write(data)

        result = check_is_cog(path)
        assert result.is_cog is False
        assert result.has_tiling is False
        assert result.has_overviews is False
