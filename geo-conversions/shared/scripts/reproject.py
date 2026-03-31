"""Reproject any GeoTIFF to EPSG:4326 and write as a Cloud-Optimized GeoTIFF."""

import os
import shutil
import subprocess
import tempfile

import rasterio
from rasterio.crs import CRS
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
    produces a COG. Otherwise reprojects via gdalwarp, which handles
    large files with disk-based chunking instead of loading the entire
    raster into memory.
    """
    with rasterio.open(input_tif) as src:
        src_crs = src.crs
        if src_crs is None:
            raise ValueError(f"Input GeoTIFF has no CRS defined: {input_tif}")
        needs_reproject = src_crs.to_epsg() != 4326

    if verbose:
        label = "already EPSG:4326" if not needs_reproject else f"reprojecting from {src_crs}"
        print(f"reproject_to_cog: {label}")

    output_profile = cog_profiles.get(compression.lower())
    if output_profile is None:
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

    # Use gdalwarp for reprojection — handles large files without loading
    # the entire raster into memory. Falls back to rasterio if gdalwarp
    # is not available.
    if shutil.which("gdalwarp"):
        _reproject_gdalwarp(input_tif, output_path, compression, resampling, verbose)
    else:
        _reproject_rasterio(input_tif, output_path, compression, resampling, verbose,
                            output_profile)


def _reproject_gdalwarp(
    input_tif: str,
    output_path: str,
    compression: str,
    resampling: str,
    verbose: bool,
) -> None:
    """Reproject using gdalwarp with COG output driver."""
    # gdalwarp uses different resampling names than rasterio for some methods
    resample_map = {
        "nearest": "near",
        "bilinear": "bilinear",
        "cubic": "cubic",
        "average": "average",
        "lanczos": "lanczos",
    }
    gdal_resampling = resample_map.get(resampling, "near")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_output = os.path.join(tmpdir, "reprojected.tif")

        cmd = [
            "gdalwarp",
            "-t_srs", "EPSG:4326",
            "-r", gdal_resampling,
            "-of", "COG",
            "-co", f"COMPRESS={compression.upper()}",
            "-co", "BLOCKSIZE=512",
            "-co", "OVERVIEW_RESAMPLING=NEAREST",
            "-co", "NUM_THREADS=ALL_CPUS",
            "-wm", "256",  # 256MB working memory limit
            "-multi",
            input_tif,
            tmp_output,
        ]

        if verbose:
            print(f"Running: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"gdalwarp failed (exit {result.returncode}):\n{result.stderr}"
            )

        if verbose and result.stderr:
            print(result.stderr.strip())

        # gdalwarp -of COG produces a valid COG directly
        os.rename(tmp_output, output_path)

    if verbose:
        with rasterio.open(output_path) as dst:
            print(f"Reprojected to EPSG:4326 ({dst.width}x{dst.height})")


def _reproject_rasterio(
    input_tif: str,
    output_path: str,
    compression: str,
    resampling: str,
    verbose: bool,
    output_profile: dict,
) -> None:
    """Reproject using rasterio (in-memory, for environments without gdalwarp)."""
    from rasterio.warp import calculate_default_transform, reproject, Resampling

    dst_crs = CRS.from_epsg(4326)
    resampling_method = getattr(Resampling, resampling, Resampling.nearest)

    with tempfile.TemporaryDirectory() as tmpdir:
        reprojected_path = os.path.join(tmpdir, "reprojected.tif")

        with rasterio.open(input_tif) as src:
            src_crs = src.crs
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
