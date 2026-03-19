"""Convert an HDF5 variable to a Cloud-Optimized GeoTIFF (COG)."""

import argparse
import os
import sys
import tempfile

_REQUIRED = {"h5py": "h5py", "rasterio": "rasterio", "numpy": "numpy"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)} rio-cogeo")
    sys.exit(1)

try:
    from rio_cogeo import cog_translate
    from rio_cogeo.profiles import cog_profiles
except ImportError:
    print("Missing dependency: rio-cogeo")
    print("Install with: pip install rio-cogeo")
    sys.exit(1)

import h5py
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.warp import calculate_default_transform, reproject, Resampling

_X_NAMES = ["xcoordinates", "x", "longitude", "lon"]
_Y_NAMES = ["ycoordinates", "y", "latitude", "lat"]


def _find_dataset(group, candidates):
    """Find a dataset in the group matching one of the candidate names (case-insensitive)."""
    keys_lower = {k.lower(): k for k in group.keys()}
    for name in candidates:
        if name in keys_lower:
            return group[keys_lower[name]][:]
    return None


def _detect_crs(group, root, x_coords, y_coords):
    """Detect CRS from group metadata, falling back to coordinate heuristics."""
    if "projection" in group:
        epsg = int(np.asarray(group["projection"]))
        return CRS.from_epsg(epsg)

    for obj in (group, root):
        for attr_name in ("crs", "spatial_ref"):
            if attr_name in obj.attrs:
                return CRS.from_user_input(obj.attrs[attr_name])

    if (np.all(x_coords >= -180) and np.all(x_coords <= 180)
            and np.all(y_coords >= -90) and np.all(y_coords <= 90)):
        return CRS.from_epsg(4326)

    raise ValueError(
        "Cannot determine CRS. Provide a 'projection' dataset (EPSG code) "
        "or 'crs'/'spatial_ref' attribute in the HDF5 group."
    )


def convert(input_path: str, output_path: str, variable: str = "",
            group: str = "", compression: str = "DEFLATE", verbose: bool = False):
    """Convert an HDF5 variable to a Cloud-Optimized GeoTIFF.

    Opens the HDF5 file, navigates to the specified group, reads the variable
    as a 2D array, reprojects to EPSG:4326 if needed, and writes a COG.
    """
    with h5py.File(input_path, "r") as f:
        grp = f[group] if group else f
        root = f

        if variable not in grp:
            available = [k for k in grp.keys() if isinstance(grp[k], h5py.Dataset)]
            raise ValueError(
                f"Variable '{variable}' not found in group '{group}'. "
                f"Available datasets: {available}"
            )

        ds = grp[variable]
        data = ds[:].astype(np.float32)
        if data.ndim != 2:
            raise ValueError(f"Expected 2D variable, got shape {data.shape}")

        nodata = float(ds.attrs.get("_FillValue", -9999.0))

        x_coords = _find_dataset(grp, _X_NAMES)
        y_coords = _find_dataset(grp, _Y_NAMES)
        if x_coords is None or y_coords is None:
            raise ValueError(
                f"Cannot find coordinate arrays in group '{group}'. "
                f"Looking for x: {_X_NAMES}, y: {_Y_NAMES}"
            )

        src_crs = _detect_crs(grp, root, x_coords, y_coords)

    # Ensure north-to-south orientation (y decreasing)
    if y_coords[0] < y_coords[-1]:
        y_coords = y_coords[::-1]
        data = data[::-1, :]

    height, width = data.shape

    # Build affine transform from coordinate arrays (half-pixel origin adjustment)
    x_res = abs(float(x_coords[1] - x_coords[0])) if len(x_coords) > 1 else 1.0
    y_res = abs(float(y_coords[0] - y_coords[1])) if len(y_coords) > 1 else 1.0

    x_origin = float(x_coords[0]) - x_res / 2
    y_origin = float(y_coords[0]) + y_res / 2
    native_transform = Affine(x_res, 0, x_origin, 0, -y_res, y_origin)

    # Replace nodata and NaN
    data = np.where(np.isnan(data), nodata, data)
    data = np.where(data == nodata, nodata, data)

    if verbose:
        print(f"Variable: {variable}, shape: {data.shape}, dtype: {data.dtype}")
        print(f"Native CRS: {src_crs}")
        print(f"NoData: {nodata}")

    dst_crs = CRS.from_epsg(4326)
    needs_reproject = src_crs != dst_crs

    with tempfile.TemporaryDirectory() as tmpdir:
        if needs_reproject:
            # Write native CRS raster, then reproject
            native_path = os.path.join(tmpdir, "native.tif")
            with rasterio.open(
                native_path, "w", driver="GTiff",
                width=width, height=height, count=1, dtype="float32",
                crs=src_crs, transform=native_transform, nodata=nodata,
            ) as dst:
                dst.write(data, 1)

            # Calculate reprojected dimensions
            src_bounds = rasterio.transform.array_bounds(height, width, native_transform)
            dst_transform, dst_width, dst_height = calculate_default_transform(
                src_crs, dst_crs, width, height, *src_bounds)

            reprojected_path = os.path.join(tmpdir, "reprojected.tif")
            with rasterio.open(
                reprojected_path, "w", driver="GTiff",
                width=dst_width, height=dst_height, count=1, dtype="float32",
                crs=dst_crs, transform=dst_transform, nodata=nodata,
            ) as dst:
                with rasterio.open(native_path) as src:
                    reproject(
                        source=rasterio.band(src, 1),
                        destination=rasterio.band(dst, 1),
                        src_transform=native_transform,
                        src_crs=src_crs,
                        dst_transform=dst_transform,
                        dst_crs=dst_crs,
                        resampling=Resampling.nearest,
                    )

            cog_input = reprojected_path
            if verbose:
                print(f"Reprojected to EPSG:4326 ({dst_width}x{dst_height})")
        else:
            # Already in 4326, write directly
            cog_input = os.path.join(tmpdir, "tmp.tif")
            with rasterio.open(
                cog_input, "w", driver="GTiff",
                width=width, height=height, count=1, dtype="float32",
                crs=dst_crs, transform=native_transform, nodata=nodata,
            ) as dst:
                dst.write(data, 1)

        # Convert to COG
        try:
            output_profile = cog_profiles.get(compression.lower())
        except KeyError:
            output_profile = cog_profiles.get("deflate")
        output_profile["blockxsize"] = 512
        output_profile["blockysize"] = 512

        if verbose:
            print(f"Writing COG with {compression} compression...")

        cog_translate(
            cog_input, output_path, output_profile,
            overview_level=6, overview_resampling="nearest",
            quiet=not verbose,
        )

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Convert an HDF5 variable to a Cloud-Optimized GeoTIFF")
    parser.add_argument("--input", required=True, help="Path to input .h5/.hdf5 file")
    parser.add_argument("--output", required=True, help="Path for output COG")
    parser.add_argument("--variable", required=True, help="HDF5 dataset name to extract")
    parser.add_argument("--group", default="", help="HDF5 group path (default: root)")
    parser.add_argument("--compression", default="DEFLATE", choices=["DEFLATE", "ZSTD", "LZW"],
                        help="Compression method (default: DEFLATE)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output if it exists")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext not in (".h5", ".hdf5", ".hdf", ".he5"):
        print(f"Error: expected an HDF5 file, got '{ext}'")
        sys.exit(1)

    if os.path.exists(args.output) and not args.overwrite:
        print(f"Error: output file already exists: {args.output}")
        print("Use --overwrite to replace it.")
        sys.exit(1)

    convert(args.input, args.output, variable=args.variable, group=args.group,
            compression=args.compression, verbose=args.verbose)


if __name__ == "__main__":
    main()
