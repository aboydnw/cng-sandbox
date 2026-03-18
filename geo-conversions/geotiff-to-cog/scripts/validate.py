"""Validate that a COG preserves all data from the source GeoTIFF."""

import argparse
import dataclasses
import os
import sys
import tempfile

_REQUIRED = {"rasterio": "rasterio", "numpy": "numpy"}
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
    from rio_cogeo import cog_validate
except ImportError:
    print("Missing dependency: rio-cogeo")
    print("Install with: pip install rio-cogeo")
    sys.exit(1)

import numpy as np
import rasterio

@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str


def check_cog_valid(output_path: str) -> CheckResult:
    """Check that the file is a valid COG."""
    is_valid, errors, warnings = cog_validate(output_path)
    if is_valid:
        return CheckResult("COG structure", True, "Valid COG")
    return CheckResult("COG structure", False, f"Invalid COG: {errors}")


def check_crs_match(input_path: str, output_path: str) -> CheckResult:
    """Check that CRS is preserved."""
    with rasterio.open(input_path) as src, rasterio.open(output_path) as dst:
        if src.crs == dst.crs:
            return CheckResult("CRS preserved", True, f"{src.crs}")
        return CheckResult("CRS preserved", False, f"Source: {src.crs}, Output: {dst.crs}")


def check_bounds_match(input_path: str, output_path: str, tolerance: float = 1e-6) -> CheckResult:
    """Check that bounding box is preserved."""
    with rasterio.open(input_path) as src, rasterio.open(output_path) as dst:
        for attr in ("left", "bottom", "right", "top"):
            src_val = getattr(src.bounds, attr)
            dst_val = getattr(dst.bounds, attr)
            if abs(src_val - dst_val) > tolerance:
                return CheckResult("Bounds preserved", False,
                                   f"{attr}: source={src_val}, output={dst_val}")
        return CheckResult("Bounds preserved", True,
                           f"({src.bounds.left:.6f}, {src.bounds.bottom:.6f}, "
                           f"{src.bounds.right:.6f}, {src.bounds.top:.6f})")


def check_dimensions_match(input_path: str, output_path: str) -> CheckResult:
    """Check that pixel dimensions are preserved."""
    with rasterio.open(input_path) as src, rasterio.open(output_path) as dst:
        if src.width == dst.width and src.height == dst.height:
            return CheckResult("Dimensions", True, f"{src.width}x{src.height}")
        return CheckResult("Dimensions", False,
                           f"Source: {src.width}x{src.height}, Output: {dst.width}x{dst.height}")


def check_band_count(input_path: str, output_path: str) -> CheckResult:
    """Check that band count is preserved."""
    with rasterio.open(input_path) as src, rasterio.open(output_path) as dst:
        if src.count == dst.count:
            return CheckResult("Band count", True, f"{src.count}")
        return CheckResult("Band count", False, f"Source: {src.count}, Output: {dst.count}")


def check_band_metadata(input_path: str, output_path: str) -> CheckResult:
    """Advisory: report band descriptions and color interpretation."""
    with rasterio.open(output_path) as dst:
        names = [d if d else f"Band {i+1}" for i, d in enumerate(dst.descriptions)]
        interp = [ci.name for ci in dst.colorinterp]
        detail = f"{dst.count} band(s): {', '.join(names)} | color interp: {', '.join(interp)} | dtype: {dst.dtypes[0]}"
        return CheckResult("Band metadata", True, detail)


def check_nodata_match(input_path: str, output_path: str) -> CheckResult:
    """Check that nodata value is preserved."""
    import math
    with rasterio.open(input_path) as src, rasterio.open(output_path) as dst:
        src_nd, dst_nd = src.nodata, dst.nodata
        # NaN == NaN is False per IEEE 754, so handle explicitly
        match = (src_nd == dst_nd) or (src_nd is not None and dst_nd is not None and math.isnan(src_nd) and math.isnan(dst_nd))
        if match:
            return CheckResult("NoData preserved", True, f"{src_nd}")
        return CheckResult("NoData preserved", False,
                           f"Source: {src_nd}, Output: {dst_nd}")


def check_pixel_fidelity(input_path: str, output_path: str, n: int = 1000,
                          tolerance: float = 1e-4) -> CheckResult:
    """Sample random pixels and compare values."""
    with rasterio.open(input_path) as src, rasterio.open(output_path) as dst:
        rng = np.random.default_rng(42)
        rows = rng.integers(0, src.height, size=n)
        cols = rng.integers(0, src.width, size=n)

        for band_idx in range(1, src.count + 1):
            src_data = src.read(band_idx)
            dst_data = dst.read(band_idx)

            src_vals = src_data[rows, cols]
            dst_vals = dst_data[rows, cols]

            if np.issubdtype(src_data.dtype, np.integer):
                mismatches = np.sum(src_vals != dst_vals)
                if mismatches > 0:
                    return CheckResult("Pixel fidelity", False,
                                       f"Band {band_idx}: {mismatches}/{n} integer pixels differ")
            else:
                max_diff = np.max(np.abs(src_vals.astype(float) - dst_vals.astype(float)))
                if max_diff > tolerance:
                    return CheckResult("Pixel fidelity", False,
                                       f"Band {band_idx}: max diff={max_diff:.6f} exceeds {tolerance}")

    return CheckResult("Pixel fidelity", True, f"{n} pixels sampled, all match")


_MERCATOR_LAT_LIMIT = 85.051129


def check_wgs84_bounds(output_path: str) -> CheckResult:
    """Warn if COG has a projected CRS (bounds must be reprojected to WGS84 for STAC)."""
    with rasterio.open(output_path) as dst:
        if dst.crs is None:
            return CheckResult("WGS84 compatibility", False, "No CRS defined")
        if dst.crs.is_geographic:
            return CheckResult("WGS84 compatibility", True,
                               f"Geographic CRS ({dst.crs}), bounds are already in degrees")
        return CheckResult("WGS84 compatibility", False,
                           f"Projected CRS ({dst.crs}). STAC requires WGS84 bounds — "
                           f"downstream ingest must reproject via rasterio.warp.transform_bounds()")


def check_mercator_bounds(output_path: str) -> CheckResult:
    """Check that WGS84 bounds are within the valid Web Mercator latitude range.

    Polar or near-polar datasets can produce south=-90 or north=90 after WGS84
    reprojection. Passing these directly to WebMercatorViewport.fitBounds (deck.gl)
    produces NaN viewport values, causing the entire map layer to fail silently.
    Downstream consumers must clamp to ±85.051129° before fitting bounds.
    """
    from rasterio.warp import transform_bounds

    with rasterio.open(output_path) as dst:
        if dst.crs is None:
            return CheckResult("Mercator bounds", False, "No CRS defined")
        if dst.crs.is_geographic:
            wgs84 = dst.bounds
            south, north = wgs84.bottom, wgs84.top
        else:
            west, south, east, north = transform_bounds(dst.crs, "EPSG:4326", *dst.bounds)

    if south < -_MERCATOR_LAT_LIMIT or north > _MERCATOR_LAT_LIMIT:
        return CheckResult(
            "Mercator bounds",
            False,
            f"Bounds extend beyond Web Mercator range (south={south:.4f}, north={north:.4f}). "
            f"Web Mercator is undefined at ±90°. Downstream map viewers must clamp to "
            f"±{_MERCATOR_LAT_LIMIT}° before fitting the viewport.",
        )
    return CheckResult(
        "Mercator bounds",
        True,
        f"Bounds within Web Mercator range (south={south:.4f}, north={north:.4f})",
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


def generate_synthetic_geotiff(path: str):
    """Generate a small synthetic GeoTIFF for self-testing."""
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=256,
        height=256,
        count=2,
        dtype="float32",
        crs="EPSG:4326",
        transform=rasterio.transform.from_bounds(-10, -10, 10, 10, 256, 256),
        nodata=-9999.0,
    ) as dst:
        rng = np.random.default_rng(123)
        for band in range(1, 3):
            data = rng.standard_normal((256, 256)).astype(np.float32)
            data[0:10, 0:10] = -9999.0
            dst.write(data, band)


def run_self_test() -> bool:
    """Generate synthetic data, convert, and validate."""
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
        input_path = os.path.join(tmpdir, "test_input.tif")
        output_path = os.path.join(tmpdir, "test_output.tif")

        print("Generating synthetic GeoTIFF...")
        generate_synthetic_geotiff(input_path)

        print("Converting to COG...")
        convert_mod.convert(input_path, output_path, verbose=True)

        print("Validating...")
        return run_validation(input_path, output_path)


def run_checks(input_path: str, output_path: str) -> list[CheckResult]:
    """Run core data-integrity checks and return structured results.

    These checks verify that the COG faithfully preserves the source data.
    A failed check here means the conversion produced incorrect output.

    Advisory checks (downstream compatibility notes that don't indicate data
    corruption) are in run_advisory_checks and are NOT included here so that
    pipeline callers can treat failures as hard errors without false positives.
    """
    return [
        check_cog_valid(output_path),
        check_crs_match(input_path, output_path),
        check_bounds_match(input_path, output_path),
        check_dimensions_match(input_path, output_path),
        check_band_count(input_path, output_path),
        check_pixel_fidelity(input_path, output_path),
        check_nodata_match(input_path, output_path),
        check_overviews(output_path),
    ]


def run_advisory_checks(input_path: str, output_path: str) -> list[CheckResult]:
    """Run advisory downstream-compatibility checks.

    These checks do NOT indicate data corruption — the COG is valid. They flag
    characteristics that require special handling by downstream consumers
    (e.g. STAC ingest, web map viewers). Failed advisory checks are shown to
    users as informational warnings, not as pipeline errors.
    """
    return [
        check_wgs84_bounds(output_path),
        check_mercator_bounds(output_path),
        check_band_metadata(input_path, output_path),
    ]


def run_validation(input_path: str, output_path: str) -> bool:
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path) + run_advisory_checks(input_path, output_path)
    return print_report(results)


def main():
    parser = argparse.ArgumentParser(description="Validate a COG against its source GeoTIFF")
    parser.add_argument("--input", help="Path to original GeoTIFF (omit for self-test)")
    parser.add_argument("--output", help="Path to converted COG (omit for self-test)")
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
        passed = run_validation(args.input, args.output)
    else:
        print("Error: provide both --input and --output, or neither for self-test")
        sys.exit(1)

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
