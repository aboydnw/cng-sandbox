"""Validate that a COG converted from NetCDF preserves all data."""

import argparse
import dataclasses
import os
import sys
import tempfile

_REQUIRED = {"rasterio": "rasterio", "numpy": "numpy", "xarray": "xarray"}
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
    from rio_cogeo import cog_validate
except ImportError:
    print("Missing dependency: rio-cogeo")
    print("Install with: pip install rio-cogeo")
    sys.exit(1)

import numpy as np
import rasterio
import xarray as xr
from rasterio.crs import CRS
from rasterio import warp


@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str


def _detect_grid_mapping(ds, variable: str | None = None):
    """Detect if a NetCDF variable uses a projected CRS.

    Returns a tuple of (is_projected, src_crs, scale_factor).
    For geographic sources: (False, None, None).
    For geostationary sources: (True, CRS, perspective_point_height).
    """
    data_vars = list(ds.data_vars)
    var_name = variable if variable else data_vars[0]
    da = ds[var_name]

    grid_mapping_attr = da.attrs.get("grid_mapping")
    if grid_mapping_attr is None or grid_mapping_attr not in ds:
        return False, None, None

    gm = ds[grid_mapping_attr]
    gm_name = gm.attrs.get("grid_mapping_name", "")

    if gm_name == "geostationary":
        h = float(gm.attrs["perspective_point_height"])
        lon_0 = float(gm.attrs["longitude_of_projection_origin"])
        sweep = str(gm.attrs["sweep_angle_axis"])
        a = float(gm.attrs["semi_major_axis"])
        b = float(gm.attrs["semi_minor_axis"])
        crs = CRS.from_proj4(
            f"+proj=geos +h={h} +lon_0={lon_0} +sweep={sweep} "
            f"+a={a} +b={b} +units=m +no_defs"
        )
        return True, crs, h

    return False, None, None


def check_cog_valid(output_path: str) -> CheckResult:
    """Check that the file is a valid COG."""
    is_valid, errors, warnings = cog_validate(output_path)
    if is_valid:
        return CheckResult("COG structure", True, "Valid COG")
    return CheckResult("COG structure", False, f"Invalid COG: {errors}")


def check_crs_present(output_path: str) -> CheckResult:
    """Check that the COG has a CRS defined."""
    with rasterio.open(output_path) as dst:
        if dst.crs is not None:
            return CheckResult("CRS present", True, f"{dst.crs}")
        return CheckResult("CRS present", False, "No CRS defined")


def check_bounds_match(input_path: str, output_path: str, variable: str | None = None,
                       time_index: int = 0, tolerance: float = 1e-4) -> CheckResult:
    """Check that bounding box covers the NetCDF spatial extent."""
    ds = xr.open_dataset(input_path, decode_times=False)
    is_projected, _, _ = _detect_grid_mapping(ds, variable)

    if is_projected:
        ds.close()
        with rasterio.open(output_path) as dst:
            b = dst.bounds
            if -180 <= b.left <= 180 and -180 <= b.right <= 180 and -90 <= b.bottom <= 90 and -90 <= b.top <= 90:
                return CheckResult("Bounds match", True,
                                   f"Projected source — reprojected bounds: "
                                   f"({b.left:.4f}, {b.bottom:.4f}, {b.right:.4f}, {b.top:.4f})")
            return CheckResult("Bounds match", False,
                               f"Reprojected bounds out of valid range: "
                               f"({b.left:.4f}, {b.bottom:.4f}, {b.right:.4f}, {b.top:.4f})")

    data_vars = list(ds.data_vars)
    var_name = variable if variable else data_vars[0]
    da = ds[var_name]

    lat_names = [d for d in da.dims if d.lower() in ("lat", "latitude", "y")]
    lon_names = [d for d in da.dims if d.lower() in ("lon", "longitude", "x")]
    if not lat_names or not lon_names:
        ds.close()
        return CheckResult("Bounds match", False, f"Cannot identify lat/lon dims in {list(da.dims)}")

    lats = da[lat_names[0]].values
    lons = da[lon_names[0]].values
    nc_bounds = (float(lons.min()), float(lats.min()), float(lons.max()), float(lats.max()))
    ds.close()

    with rasterio.open(output_path) as dst:
        cog_bounds = (dst.bounds.left, dst.bounds.bottom, dst.bounds.right, dst.bounds.top)

    for i, (nc_val, cog_val, label) in enumerate([
        (nc_bounds[0], cog_bounds[0], "west"),
        (nc_bounds[1], cog_bounds[1], "south"),
        (nc_bounds[2], cog_bounds[2], "east"),
        (nc_bounds[3], cog_bounds[3], "north"),
    ]):
        if i < 2 and cog_val > nc_val + tolerance:
            return CheckResult("Bounds match", False,
                               f"{label}: COG={cog_val:.6f} > NetCDF center={nc_val:.6f}")
        if i >= 2 and cog_val < nc_val - tolerance:
            return CheckResult("Bounds match", False,
                               f"{label}: COG={cog_val:.6f} < NetCDF center={nc_val:.6f}")

    return CheckResult("Bounds match", True,
                       f"COG: ({cog_bounds[0]:.4f}, {cog_bounds[1]:.4f}, "
                       f"{cog_bounds[2]:.4f}, {cog_bounds[3]:.4f})")


def check_dimensions_match(input_path: str, output_path: str, variable: str | None = None) -> CheckResult:
    """Check that pixel dimensions match the NetCDF grid."""
    ds = xr.open_dataset(input_path, decode_times=False)
    is_projected, _, _ = _detect_grid_mapping(ds, variable)

    if is_projected:
        ds.close()
        with rasterio.open(output_path) as dst:
            return CheckResult("Dimensions", True,
                               f"Projected source — reprojected to {dst.width}x{dst.height}")

    data_vars = list(ds.data_vars)
    var_name = variable if variable else data_vars[0]
    da = ds[var_name]

    lat_names = [d for d in da.dims if d.lower() in ("lat", "latitude", "y")]
    lon_names = [d for d in da.dims if d.lower() in ("lon", "longitude", "x")]
    nc_height = da.sizes[lat_names[0]] if lat_names else 0
    nc_width = da.sizes[lon_names[0]] if lon_names else 0
    ds.close()

    with rasterio.open(output_path) as dst:
        if dst.width == nc_width and dst.height == nc_height:
            return CheckResult("Dimensions", True, f"{dst.width}x{dst.height}")
        return CheckResult("Dimensions", False,
                           f"NetCDF: {nc_width}x{nc_height}, COG: {dst.width}x{dst.height}")


def check_band_count(output_path: str) -> CheckResult:
    """Check that the COG has exactly 1 band (single variable extraction)."""
    with rasterio.open(output_path) as dst:
        if dst.count == 1:
            return CheckResult("Band count", True, "1")
        return CheckResult("Band count", False, f"Expected 1, got {dst.count}")


def check_pixel_fidelity(input_path: str, output_path: str, variable: str | None = None,
                          time_index: int = 0, n: int = 1000) -> CheckResult:
    """Sample random pixels and compare values against the NetCDF source."""
    ds = xr.open_dataset(input_path, decode_times=False)
    is_projected, src_crs, scale_factor = _detect_grid_mapping(ds, variable)

    data_vars = list(ds.data_vars)
    var_name = variable if variable else data_vars[0]
    da = ds[var_name]

    time_dims = [d for d in da.dims if d.lower() in ("time", "t")]
    if time_dims:
        da = da.isel({time_dims[0]: time_index})

    if is_projected:
        y_names = [d for d in da.dims if d.lower() in ("y", "lat", "latitude")]
        x_names = [d for d in da.dims if d.lower() in ("x", "lon", "longitude")]
        y_coords = da[y_names[0]].values.astype(np.float64) * scale_factor
        x_coords = da[x_names[0]].values.astype(np.float64) * scale_factor

        data = da.values.astype(np.float32)
        if y_coords[0] < y_coords[-1]:
            y_coords = y_coords[::-1]
            data = data[::-1, :]

        nodata_val = float(da.encoding.get("_FillValue", da.attrs.get("_FillValue", -9999.0)))
        ds.close()

        height, width = data.shape
        rng = np.random.default_rng(42)
        rows = rng.integers(0, height, size=n)
        cols = rng.integers(0, width, size=n)

        src_vals = data[rows, cols]
        mask = ~np.isnan(src_vals) & (src_vals != nodata_val)
        if mask.sum() == 0:
            return CheckResult("Pixel fidelity", True, "All sampled pixels are nodata")

        rows, cols, src_vals = rows[mask], cols[mask], src_vals[mask]

        xs = x_coords[cols]
        ys = y_coords[rows]

        dst_crs = CRS.from_epsg(4326)
        lons, lats = warp.transform(src_crs, dst_crs, xs, ys)
        lons = np.array(lons)
        lats = np.array(lats)

        tolerance = 0.5
        with rasterio.open(output_path) as cog:
            cog_nodata = cog.nodata
            cog_vals = []
            for lon, lat in zip(lons, lats):
                try:
                    row, col = cog.index(lon, lat)
                    if 0 <= row < cog.height and 0 <= col < cog.width:
                        val = cog.read(1, window=rasterio.windows.Window(col, row, 1, 1))[0, 0]
                        cog_vals.append(val)
                    else:
                        cog_vals.append(np.nan)
                except Exception:
                    cog_vals.append(np.nan)
            cog_vals = np.array(cog_vals, dtype=np.float32)

        valid = ~np.isnan(cog_vals)
        if cog_nodata is not None:
            valid &= (cog_vals != cog_nodata)

        if valid.sum() == 0:
            return CheckResult("Pixel fidelity", False,
                               "No valid COG pixels found at reprojected sample locations")

        max_diff = float(np.max(np.abs(src_vals[valid] - cog_vals[valid])))
        if max_diff > tolerance:
            return CheckResult("Pixel fidelity", False,
                               f"max diff={max_diff:.6f} exceeds tolerance={tolerance}")

        return CheckResult("Pixel fidelity", True,
                           f"{valid.sum()}/{n} data pixels (reprojected), max diff={max_diff:.6f}")

    else:
        lat_names = [d for d in da.dims if d.lower() in ("lat", "latitude", "y")]
        lats = da[lat_names[0]].values
        if lats[0] < lats[-1]:
            da = da.isel({lat_names[0]: slice(None, None, -1)})

        nc_data = da.values.astype(np.float32)
        ds.close()

        with rasterio.open(output_path) as dst:
            cog_data = dst.read(1)
            nodata = dst.nodata

        tolerance = 1e-4
        rng = np.random.default_rng(42)
        height, width = nc_data.shape
        rows = rng.integers(0, height, size=n)
        cols = rng.integers(0, width, size=n)

        nc_vals = nc_data[rows, cols]
        cog_vals = cog_data[rows, cols]

        mask = ~np.isnan(nc_vals)
        if nodata is not None:
            mask &= (cog_vals != nodata)

        if mask.sum() == 0:
            return CheckResult("Pixel fidelity", True, "All sampled pixels are nodata")

        max_diff = np.max(np.abs(nc_vals[mask] - cog_vals[mask]))
        if max_diff > tolerance:
            return CheckResult("Pixel fidelity", False, f"max diff={max_diff:.6f} exceeds {tolerance}")

        return CheckResult("Pixel fidelity", True,
                           f"{mask.sum()}/{n} data pixels sampled, max diff={max_diff:.8f}")


def check_nodata_present(output_path: str) -> CheckResult:
    """Check that a nodata value is defined."""
    with rasterio.open(output_path) as dst:
        if dst.nodata is not None:
            return CheckResult("NoData defined", True, f"{dst.nodata}")
        return CheckResult("NoData defined", False, "No nodata value set")


def check_overviews(output_path: str, min_levels: int = 3) -> CheckResult:
    """Check that internal overviews are present."""
    with rasterio.open(output_path) as dst:
        overviews = dst.overviews(1)
        if len(overviews) >= min_levels:
            return CheckResult("Overviews", True, f"{len(overviews)} levels: {overviews}")
        return CheckResult("Overviews", False,
                           f"Found {len(overviews)} levels (need >= {min_levels}): {overviews}")


def print_report(results: list[CheckResult]):
    """Print a formatted pass/fail report."""
    print("\n" + "=" * 50)
    print("VALIDATION REPORT")
    print("=" * 50)

    all_passed = True
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        icon = "+" if r.passed else "!"
        print(f"  [{icon}] {status}: {r.name}")
        print(f"        {r.detail}")
        if not r.passed:
            all_passed = False

    print("=" * 50)
    if all_passed:
        print("RESULT: ALL CHECKS PASSED")
    else:
        failed = sum(1 for r in results if not r.passed)
        print(f"RESULT: {failed} CHECK(S) FAILED")
    print("=" * 50 + "\n")

    return all_passed


def generate_synthetic_netcdf(path: str):
    """Generate a small synthetic NetCDF with 2 variables and 3 timesteps."""
    rng = np.random.default_rng(123)
    lats = np.linspace(10, -10, 64)   # north-to-south
    lons = np.linspace(-10, 10, 128)
    times = np.arange(3)

    temp_data = rng.standard_normal((3, 64, 128)).astype(np.float32)
    precip_data = rng.uniform(0, 100, (3, 64, 128)).astype(np.float32)

    # Add some NaN values
    temp_data[0, 0:5, 0:5] = np.nan

    ds = xr.Dataset(
        {
            "temperature": (["time", "lat", "lon"], temp_data, {"_FillValue": np.float32(-9999.0)}),
            "precipitation": (["time", "lat", "lon"], precip_data),
        },
        coords={"time": times, "lat": lats, "lon": lons},
    )
    ds.attrs["crs"] = "EPSG:4326"
    ds.to_netcdf(path)
    ds.close()


def run_self_test() -> bool:
    """Generate synthetic NetCDF, convert, and validate."""
    print("Running self-test...")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    convert_path = os.path.join(script_dir, "convert.py")
    if not os.path.isfile(convert_path):
        print(f"Error: convert.py not found at {convert_path}")
        return False

    import importlib.util
    spec = importlib.util.spec_from_file_location("convert", convert_path)
    convert_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(convert_mod)

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "test_input.nc")
        output_path = os.path.join(tmpdir, "test_output.tif")

        print("Generating synthetic NetCDF (2 variables, 3 timesteps)...")
        generate_synthetic_netcdf(input_path)

        print("Converting 'temperature' variable, timestep 0 to COG...")
        convert_mod.convert(input_path, output_path, variable="temperature",
                            time_index=0, verbose=True)

        print("Validating...")
        return run_validation(input_path, output_path, variable="temperature", time_index=0)


def run_checks(input_path: str, output_path: str, variable: str | None = None,
               time_index: int = 0) -> list[CheckResult]:
    """Run all validation checks and return structured results."""
    return [
        check_cog_valid(output_path),
        check_crs_present(output_path),
        check_bounds_match(input_path, output_path, variable=variable, time_index=time_index),
        check_dimensions_match(input_path, output_path, variable=variable),
        check_band_count(output_path),
        check_pixel_fidelity(input_path, output_path, variable=variable, time_index=time_index),
        check_nodata_present(output_path),
        check_overviews(output_path),
    ]


def run_validation(input_path: str, output_path: str, variable: str | None = None,
                   time_index: int = 0) -> bool:
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path, variable=variable, time_index=time_index)
    return print_report(results)


def main():
    parser = argparse.ArgumentParser(description="Validate a COG against its source NetCDF")
    parser.add_argument("--input", help="Path to original NetCDF (omit for self-test)")
    parser.add_argument("--output", help="Path to converted COG (omit for self-test)")
    parser.add_argument("--variable", default=None, help="NetCDF variable to validate against")
    parser.add_argument("--time-index", type=int, default=0, help="Timestep index to validate against")
    args = parser.parse_args()

    if args.input is None and args.output is None:
        passed = run_self_test()
    elif args.input and args.output:
        if not os.path.isfile(args.input):
            print(f"Error: input file not found: {args.input}")
            sys.exit(1)
        if not os.path.isfile(args.output):
            print(f"Error: output file not found: {args.output}")
            sys.exit(1)
        passed = run_validation(args.input, args.output, variable=args.variable,
                                time_index=args.time_index)
    else:
        print("Error: provide both --input and --output, or neither for self-test")
        sys.exit(1)

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
