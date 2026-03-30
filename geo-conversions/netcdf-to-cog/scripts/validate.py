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
    For other projected sources: (True, CRS, None).
    """
    from pyproj import CRS as ProjCRS

    data_vars = list(ds.data_vars)
    var_name = variable if variable else data_vars[0]
    da = ds[var_name]

    grid_mapping_attr = da.attrs.get("grid_mapping")
    if grid_mapping_attr is None or grid_mapping_attr not in ds:
        return False, None, None

    gm = ds[grid_mapping_attr]
    gm_name = gm.attrs.get("grid_mapping_name", "")

    if gm_name == "latitude_longitude":
        return False, None, None

    if gm_name == "geostationary":
        required = ["perspective_point_height", "longitude_of_projection_origin",
                     "sweep_angle_axis", "semi_major_axis", "semi_minor_axis"]
        missing = [attr for attr in required if attr not in gm.attrs]
        if missing:
            raise ValueError(f"Geostationary grid_mapping missing attributes: {missing}")
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

    # Generic projected CRS
    cf_params = {k: v for k, v in gm.attrs.items()}
    try:
        proj_crs = ProjCRS.from_cf(cf_params)
        return True, CRS.from_user_input(proj_crs), None
    except Exception:
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
        y_coords = da[y_names[0]].values.astype(np.float64)
        x_coords = da[x_names[0]].values.astype(np.float64)
        if scale_factor is not None:
            y_coords = y_coords * scale_factor
            x_coords = x_coords * scale_factor

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

        # Reprojection resampling introduces interpolation differences
        tolerance = 0.5
        with rasterio.open(output_path) as cog:
            cog_nodata = cog.nodata
            cog_data = cog.read(1)
            cog_rows = np.empty(len(lons), dtype=np.int64)
            cog_cols = np.empty(len(lons), dtype=np.int64)
            for i, (lon, lat) in enumerate(zip(lons, lats)):
                try:
                    r, c = cog.index(lon, lat)
                    cog_rows[i] = r
                    cog_cols[i] = c
                except Exception:
                    cog_rows[i] = -1
                    cog_cols[i] = -1

            in_bounds = ((cog_rows >= 0) & (cog_rows < cog.height) &
                         (cog_cols >= 0) & (cog_cols < cog.width))

        cog_vals = np.full(len(lons), np.nan, dtype=np.float32)
        cog_vals[in_bounds] = cog_data[cog_rows[in_bounds], cog_cols[in_bounds]]

        valid = ~np.isnan(cog_vals) & in_bounds
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


def check_rendering_metadata(output_path: str) -> CheckResult:
    """Advisory: flag COGs that need special tile-server parameters for rendering.

    NetCDF→COG always produces single-band float32 output. Tile servers like
    titiler need `rescale=min,max` when using `colormap_name`, otherwise they
    return 500 ("arrays used as indices must be of integer type"). This check
    computes p2/p98 percentiles as the recommended rescale range.
    """
    with rasterio.open(output_path) as dst:
        dtype = dst.dtypes[0]
        if dtype == "uint8":
            return CheckResult(
                "Rendering metadata", True,
                "Single-band uint8. Tile server can apply colormap_name without rescale."
            )

        data = dst.read(1)
        valid = data[data != dst.nodata] if dst.nodata is not None else data
        valid = valid[~np.isnan(valid)]
        if valid.size == 0:
            return CheckResult(
                "Rendering metadata", False,
                "All pixels are nodata — cannot compute rescale range."
            )
        p2 = float(np.percentile(valid, 2))
        p98 = float(np.percentile(valid, 98))
        return CheckResult(
            "Rendering metadata", True,
            f"Single-band {dtype}. Tile server needs rescale={p2:.4f},{p98:.4f} "
            f"(p2/p98) when applying colormap_name."
        )


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


def generate_geostationary_netcdf(path: str):
    """Generate a small synthetic geostationary NetCDF for self-testing.

    Creates a 64x64 grid of scanning angles in radians with a
    goes_imager_projection variable, mimicking GOES-R ABI structure.
    """
    sat_height = 35786023.0
    # Small scanning angle range (~±0.02 radians ≈ ±1.15 degrees from nadir)
    x_rad = np.linspace(-0.02, 0.02, 64).astype(np.float64)
    y_rad = np.linspace(0.02, -0.02, 64).astype(np.float64)  # north-to-south

    rng = np.random.default_rng(456)
    data = rng.uniform(0.1, 1.0, (64, 64)).astype(np.float32)

    ds = xr.Dataset(
        {"CMI": (["y", "x"], data, {"grid_mapping": "goes_imager_projection",
                                     "_FillValue": np.float32(-1.0)})},
        coords={"x": x_rad, "y": y_rad},
    )
    ds["goes_imager_projection"] = xr.DataArray(
        np.int32(0),
        attrs={
            "grid_mapping_name": "geostationary",
            "perspective_point_height": sat_height,
            "longitude_of_projection_origin": -137.0,
            "sweep_angle_axis": "x",
            "semi_major_axis": 6378137.0,
            "semi_minor_axis": 6356752.31414,
            "latitude_of_projection_origin": 0.0,
        },
    )
    ds.to_netcdf(path)
    ds.close()


def generate_projected_netcdf(path: str):
    """Generate a small synthetic NetCDF with Albers Equal Area (EPSG:5070) projection.

    Creates a 64x64 grid with CF-convention grid_mapping attributes for
    albers_conical_equal_area, mimicking USGS CONUS datasets.
    """
    x_coords = np.linspace(1000000, 1100000, 64).astype(np.float64)
    y_coords = np.linspace(1600000, 1500000, 64).astype(np.float64)  # north-to-south

    rng = np.random.default_rng(789)
    data = rng.uniform(0.5, 1.0, (64, 64)).astype(np.float32)

    ds = xr.Dataset(
        {"temperature": (["y", "x"], data, {"grid_mapping": "crs",
                                             "_FillValue": np.float32(-9999.0)})},
        coords={"x": x_coords, "y": y_coords},
    )
    ds["crs"] = xr.DataArray(
        np.int32(0),
        attrs={
            "grid_mapping_name": "albers_conical_equal_area",
            "standard_parallel": [29.5, 45.5],
            "latitude_of_projection_origin": 23.0,
            "longitude_of_central_meridian": -96.0,
            "false_easting": 0.0,
            "false_northing": 0.0,
            "semi_major_axis": 6378137.0,
            "inverse_flattening": 298.257222101,
        },
    )
    ds.to_netcdf(path)
    ds.close()


def run_self_test() -> bool:
    """Generate synthetic NetCDFs, convert, and validate."""
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

    all_passed = True

    with tempfile.TemporaryDirectory() as tmpdir:
        # Test 1: Geographic NetCDF (existing test)
        print("\n--- Test 1: Geographic NetCDF ---")
        input_path = os.path.join(tmpdir, "test_geographic.nc")
        output_path = os.path.join(tmpdir, "test_geographic.tif")

        print("Generating synthetic geographic NetCDF (2 variables, 3 timesteps)...")
        generate_synthetic_netcdf(input_path)

        print("Converting 'temperature' variable, timestep 0 to COG...")
        convert_mod.convert(input_path, output_path, variable="temperature",
                            time_index=0, verbose=True)

        print("Validating...")
        if not run_validation(input_path, output_path, variable="temperature", time_index=0):
            all_passed = False

        # Test 2: Geostationary NetCDF
        print("\n--- Test 2: Geostationary NetCDF ---")
        geo_input = os.path.join(tmpdir, "test_geostationary.nc")
        geo_output = os.path.join(tmpdir, "test_geostationary.tif")

        print("Generating synthetic geostationary NetCDF (64x64, GOES-like)...")
        generate_geostationary_netcdf(geo_input)

        print("Converting 'CMI' variable to COG (should detect + reproject)...")
        convert_mod.convert(geo_input, geo_output, variable="CMI", verbose=True)

        print("Validating reprojected COG...")
        if not run_validation(geo_input, geo_output, variable="CMI"):
            all_passed = False

        # Verify the reprojected COG has sensible geographic bounds (not near 0,0)
        with rasterio.open(geo_output) as dst:
            b = dst.bounds
            # With lon_0=-137 and ±0.02 rad, expect bounds roughly around -138 to -136 lon
            if abs(b.left) < 1 and abs(b.right) < 1:
                print("FAIL: Reprojected bounds are near (0,0) — coordinate scaling likely broken")
                all_passed = False
            else:
                print(f"Reprojected bounds look correct: ({b.left:.2f}, {b.bottom:.2f}, "
                      f"{b.right:.2f}, {b.top:.2f})")

        # Test 3: Projected CRS NetCDF (Albers Equal Area)
        print("\n--- Test 3: Projected CRS NetCDF (Albers / EPSG:5070) ---")
        proj_input = os.path.join(tmpdir, "test_projected.nc")
        proj_output = os.path.join(tmpdir, "test_projected.tif")

        print("Generating synthetic Albers Equal Area NetCDF (64x64)...")
        generate_projected_netcdf(proj_input)

        print("Converting 'temperature' variable to COG (should detect + reproject)...")
        convert_mod.convert(proj_input, proj_output, variable="temperature", verbose=True)

        print("Validating reprojected COG...")
        if not run_validation(proj_input, proj_output, variable="temperature"):
            all_passed = False

        with rasterio.open(proj_output) as dst:
            epsg = dst.crs.to_epsg() if dst.crs else None
            if epsg != 4326:
                print(f"FAIL: Expected EPSG:4326, got {dst.crs}")
                all_passed = False
            else:
                b = dst.bounds
                print(f"Reprojected to EPSG:4326: ({b.left:.2f}, {b.bottom:.2f}, "
                      f"{b.right:.2f}, {b.top:.2f})")

    return all_passed


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


def run_advisory_checks(output_path: str) -> list[CheckResult]:
    """Run advisory downstream-compatibility checks.

    These checks do NOT indicate data corruption — the COG is valid. They flag
    characteristics that require special handling by downstream consumers
    (e.g. tile servers, web map viewers).
    """
    return [
        check_rendering_metadata(output_path),
    ]


def run_validation(input_path: str, output_path: str, variable: str | None = None,
                   time_index: int = 0) -> bool:
    """Run all validation checks and print report."""
    results = (
        run_checks(input_path, output_path, variable=variable, time_index=time_index)
        + run_advisory_checks(output_path)
    )
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
