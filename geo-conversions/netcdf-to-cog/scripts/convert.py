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
from rasterio.crs import CRS
from rasterio.transform import from_bounds, Affine
from rasterio.warp import calculate_default_transform, reproject, Resampling
import xarray as xr


def _detect_crs(ds, da):
    """Detect CRS from CF grid_mapping conventions.

    Returns a tuple of (crs, scale_factor). For geographic data, returns
    (EPSG:4326, None). For geostationary data, returns the geos CRS and
    the perspective_point_height needed to scale x/y from radians to meters.
    """
    grid_mapping_attr = da.attrs.get("grid_mapping")
    if grid_mapping_attr is None:
        return CRS.from_epsg(4326), None

    if grid_mapping_attr not in ds:
        return CRS.from_epsg(4326), None

    gm = ds[grid_mapping_attr]
    gm_name = gm.attrs.get("grid_mapping_name", "")

    if gm_name == "latitude_longitude":
        return CRS.from_epsg(4326), None

    if gm_name == "geostationary":
        required = ["perspective_point_height", "longitude_of_projection_origin",
                    "sweep_angle_axis", "semi_major_axis", "semi_minor_axis"]
        missing = [a for a in required if a not in gm.attrs]
        if missing:
            raise ValueError(
                f"Geostationary grid mapping '{grid_mapping_attr}' is missing "
                f"required attributes: {missing}"
            )
        h = float(gm.attrs["perspective_point_height"])
        lon_0 = float(gm.attrs["longitude_of_projection_origin"])
        sweep = str(gm.attrs["sweep_angle_axis"])
        a = float(gm.attrs["semi_major_axis"])
        b = float(gm.attrs["semi_minor_axis"])
        crs = CRS.from_proj4(
            f"+proj=geos +h={h} +lon_0={lon_0} +sweep={sweep} "
            f"+a={a} +b={b} +units=m +no_defs"
        )
        return crs, h

    raise ValueError(
        f"Unsupported grid_mapping_name '{gm_name}' in '{grid_mapping_attr}'. "
        f"Supported: 'latitude_longitude', 'geostationary'."
    )


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

    # Detect CRS from CF grid_mapping conventions
    src_crs, scale_factor = _detect_crs(ds, da)
    is_geographic = scale_factor is None

    if verbose:
        print(f"Detected CRS: {src_crs}" + (" (geographic)" if is_geographic else " (projected)"))

    nodata = float(da.encoding.get("_FillValue", da.attrs.get("_FillValue", -9999.0)))

    if is_geographic:
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

        # Rewrap 0–360 longitudes to -180–180
        if float(lons.max()) > 180:
            da = da.assign_coords({lon_dim: (da[lon_dim].values + 180) % 360 - 180})
            da = da.sortby(lon_dim)
            lons = da[lon_dim].values
            if verbose:
                print("Rewrapped longitudes from 0–360 to -180–180")

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

    else:
        # Geostationary (projected) branch
        y_names = [d for d in da.dims if d.lower() in ("y", "lat", "latitude")]
        x_names = [d for d in da.dims if d.lower() in ("x", "lon", "longitude")]
        if not y_names or not x_names:
            print(f"Error: cannot identify spatial dimensions in {list(da.dims)}")
            sys.exit(1)

        y_dim, x_dim = y_names[0], x_names[0]
        y_coords = da[y_dim].values.astype(np.float64)
        x_coords = da[x_dim].values.astype(np.float64)

        # Scale from radians to meters
        y_coords = y_coords * scale_factor
        x_coords = x_coords * scale_factor

        # Ensure y is descending (top-to-bottom)
        if y_coords[0] < y_coords[-1]:
            da = da.isel({y_dim: slice(None, None, -1)})
            y_coords = y_coords[::-1]

        data = da.values.astype(np.float32)
        height, width = data.shape

        # Build native-CRS Affine transform (half-pixel origin adjustment)
        x_res = abs(float(x_coords[1] - x_coords[0])) if len(x_coords) > 1 else 1.0
        y_res = abs(float(y_coords[0] - y_coords[1])) if len(y_coords) > 1 else 1.0
        x_origin = float(x_coords[0]) - x_res / 2
        y_origin = float(y_coords[0]) + y_res / 2
        native_transform = Affine(x_res, 0, x_origin, 0, -y_res, y_origin)

        data = np.where(np.isnan(data), nodata, data)

        if verbose:
            print(f"Variable: {variable}, shape: {data.shape}, dtype: {data.dtype}")
            print(f"NoData: {nodata}")

        dst_crs = CRS.from_epsg(4326)

        with tempfile.TemporaryDirectory() as tmpdir:
            native_path = os.path.join(tmpdir, "native.tif")
            with rasterio.open(
                native_path, "w", driver="GTiff",
                width=width, height=height, count=1, dtype="float32",
                crs=src_crs, transform=native_transform, nodata=nodata,
            ) as dst:
                dst.write(data, 1)

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

            if verbose:
                print(f"Reprojected to EPSG:4326 ({dst_width}x{dst_height})")

            try:
                output_profile = cog_profiles.get(compression.lower())
            except KeyError:
                output_profile = cog_profiles.get("deflate")
            output_profile["blockxsize"] = 512
            output_profile["blockysize"] = 512

            if verbose:
                print(f"Writing COG with {compression} compression...")

            cog_translate(
                reprojected_path, output_path, output_profile,
                overview_level=6, overview_resampling="nearest",
                quiet=not verbose,
            )

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
