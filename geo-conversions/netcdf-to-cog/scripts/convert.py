"""Convert a NetCDF file to a Cloud-Optimized GeoTIFF (COG)."""

import argparse
import os
import sys
import tempfile

_REQUIRED = {"xarray": "xarray", "rasterio": "rasterio", "numpy": "numpy"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)} netcdf4 rio-cogeo")
    sys.exit(1)

try:
    from rio_cogeo import cog_translate
    from rio_cogeo.profiles import cog_profiles
except ImportError:
    print("Missing dependency: rio-cogeo")
    print("Install with: pip install rio-cogeo")
    sys.exit(1)

import numpy as np
import rasterio
from rasterio.transform import from_bounds
import xarray as xr


def convert(input_path: str, output_path: str, variable: str | None = None,
            time_index: int = 0, compression: str = "DEFLATE", verbose: bool = False):
    """Convert a NetCDF variable to a Cloud-Optimized GeoTIFF.

    Opens the NetCDF with xarray, selects one variable and one timestep,
    writes a temporary GeoTIFF, then converts to COG with rio-cogeo.
    """
    ds = xr.open_dataset(input_path)

    data_vars = list(ds.data_vars)
    if not data_vars:
        print("Error: NetCDF has no data variables")
        sys.exit(1)

    if variable is None:
        variable = data_vars[0]
        if verbose:
            print(f"No variable specified, using first: '{variable}'")
            print(f"Available variables: {data_vars}")
    elif variable not in data_vars:
        print(f"Error: variable '{variable}' not found. Available: {data_vars}")
        sys.exit(1)

    da = ds[variable]

    # Select timestep if time dimension exists
    time_dims = [d for d in da.dims if d.lower() in ("time", "t")]
    if time_dims:
        time_dim = time_dims[0]
        n_times = da.sizes[time_dim]
        if time_index >= n_times:
            print(f"Error: time_index {time_index} out of range (0-{n_times - 1})")
            sys.exit(1)
        da = da.isel({time_dim: time_index})
        if verbose:
            print(f"Selected timestep {time_index}/{n_times - 1} from '{time_dim}'")

    # Resolve spatial dimensions
    lat_names = [d for d in da.dims if d.lower() in ("lat", "latitude", "y")]
    lon_names = [d for d in da.dims if d.lower() in ("lon", "longitude", "x")]
    if not lat_names or not lon_names:
        print(f"Error: cannot identify lat/lon dimensions in {list(da.dims)}")
        print("Expected dimension names like 'lat'/'latitude'/'y' and 'lon'/'longitude'/'x'")
        sys.exit(1)

    lat_dim, lon_dim = lat_names[0], lon_names[0]
    lats = da[lat_dim].values
    lons = da[lon_dim].values

    # Ensure lat is north-to-south (top-to-bottom for raster)
    if lats[0] < lats[-1]:
        da = da.isel({lat_dim: slice(None, None, -1)})
        lats = lats[::-1]

    data = da.values.astype(np.float32)
    height, width = data.shape

    # Build geotransform from coordinate arrays
    lat_min, lat_max = float(lats.min()), float(lats.max())
    lon_min, lon_max = float(lons.min()), float(lons.max())

    # Half-pixel adjustment (coordinates are cell centers)
    lat_res = abs(lats[1] - lats[0]) if len(lats) > 1 else 1.0
    lon_res = abs(lons[1] - lons[0]) if len(lons) > 1 else 1.0
    transform = from_bounds(
        lon_min - lon_res / 2, lat_min - lat_res / 2,
        lon_max + lon_res / 2, lat_max + lat_res / 2,
        width, height,
    )

    nodata = float(da.encoding.get("_FillValue", da.attrs.get("_FillValue", -9999.0)))

    if verbose:
        print(f"Variable: {variable}, shape: {data.shape}, dtype: {data.dtype}")
        print(f"Bounds: ({lon_min:.4f}, {lat_min:.4f}, {lon_max:.4f}, {lat_max:.4f})")
        print(f"NoData: {nodata}")

    # Write temporary GeoTIFF, then convert to COG
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        with rasterio.open(
            tmp_path, "w", driver="GTiff",
            width=width, height=height, count=1, dtype="float32",
            crs="EPSG:4326", transform=transform, nodata=nodata,
        ) as dst:
            # Replace NaN with nodata
            data = np.where(np.isnan(data), nodata, data)
            dst.write(data, 1)

        try:
            output_profile = cog_profiles.get(compression.lower())
        except KeyError:
            output_profile = cog_profiles.get("deflate")
        output_profile["blockxsize"] = 512
        output_profile["blockysize"] = 512

        if verbose:
            print(f"Writing COG with {compression} compression...")

        cog_translate(
            tmp_path, output_path, output_profile,
            overview_level=6, overview_resampling="nearest",
            quiet=not verbose,
        )
    finally:
        os.unlink(tmp_path)

    ds.close()
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Convert a NetCDF variable to a Cloud-Optimized GeoTIFF")
    parser.add_argument("--input", required=True, help="Path to input .nc file")
    parser.add_argument("--output", required=True, help="Path for output COG")
    parser.add_argument("--variable", default=None, help="NetCDF variable name (default: first data variable)")
    parser.add_argument("--time-index", type=int, default=0, help="Timestep index (default: 0)")
    parser.add_argument("--compression", default="DEFLATE", choices=["DEFLATE", "ZSTD", "LZW"],
                        help="Compression method (default: DEFLATE)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output if it exists")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext not in (".nc", ".nc4", ".netcdf"):
        print(f"Error: expected a .nc file, got '{ext}'")
        sys.exit(1)

    if os.path.exists(args.output) and not args.overwrite:
        print(f"Error: output file already exists: {args.output}")
        print("Use --overwrite to replace it.")
        sys.exit(1)

    convert(args.input, args.output, variable=args.variable, time_index=args.time_index,
            compression=args.compression, verbose=args.verbose)


if __name__ == "__main__":
    main()
