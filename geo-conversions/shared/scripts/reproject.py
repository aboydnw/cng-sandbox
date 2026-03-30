"""Reproject any GeoTIFF to EPSG:4326 and write as a Cloud-Optimized GeoTIFF."""

import os
import tempfile

import rasterio
from rasterio.crs import CRS
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rio_cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles


def reproject_to_cog(
    input_tif: str,
    output_path: str,
    compression: str = "DEFLATE",
    resampling: str = "nearest",
    verbose: bool = False,
) -> None:
    """Reproject a GeoTIFF to EPSG:4326 and package as a COG.

    If the input is already EPSG:4326, skips reprojection and just
    produces a COG. Otherwise reprojects via rasterio.warp.
    """
    dst_crs = CRS.from_epsg(4326)

    with rasterio.open(input_tif) as src:
        src_crs = src.crs
        needs_reproject = src_crs != dst_crs

    if verbose:
        label = "already EPSG:4326" if not needs_reproject else f"reprojecting from {src_crs}"
        print(f"reproject_to_cog: {label}")

    try:
        output_profile = cog_profiles.get(compression.lower())
    except KeyError:
        output_profile = cog_profiles.get("deflate")
    output_profile["blockxsize"] = 512
    output_profile["blockysize"] = 512

    if not needs_reproject:
        cog_translate(
            input_tif, output_path, output_profile,
            overview_level=6, overview_resampling="nearest",
            quiet=not verbose,
        )
        return

    resampling_method = getattr(Resampling, resampling, Resampling.nearest)

    with tempfile.TemporaryDirectory() as tmpdir:
        reprojected_path = os.path.join(tmpdir, "reprojected.tif")

        with rasterio.open(input_tif) as src:
            dst_transform, dst_width, dst_height = calculate_default_transform(
                src_crs, dst_crs, src.width, src.height, *src.bounds
            )

            dst_meta = src.meta.copy()
            dst_meta.update({
                "crs": dst_crs,
                "transform": dst_transform,
                "width": dst_width,
                "height": dst_height,
            })

            with rasterio.open(reprojected_path, "w", **dst_meta) as dst:
                for band in range(1, src.count + 1):
                    reproject(
                        source=rasterio.band(src, band),
                        destination=rasterio.band(dst, band),
                        src_transform=src.transform,
                        src_crs=src_crs,
                        dst_transform=dst_transform,
                        dst_crs=dst_crs,
                        resampling=resampling_method,
                    )

        if verbose:
            print(f"Reprojected to EPSG:4326 ({dst_width}x{dst_height})")

        cog_translate(
            reprojected_path, output_path, output_profile,
            overview_level=6, overview_resampling="nearest",
            quiet=not verbose,
        )
