"""Validate that a COG converted from HDF5 preserves all data."""

import argparse
import dataclasses
import os
import sys

_REQUIRED = {"rasterio": "rasterio", "numpy": "numpy", "h5py": "h5py"}
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

import h5py
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio import warp


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


def check_crs_4326(output_path: str) -> CheckResult:
    """Check that the COG is in EPSG:4326."""
    with rasterio.open(output_path) as dst:
        epsg = dst.crs.to_epsg() if dst.crs else None
        if epsg == 4326:
            return CheckResult("CRS EPSG:4326", True, "EPSG:4326")
        return CheckResult("CRS EPSG:4326", False, f"Expected EPSG:4326, got {dst.crs}")


def check_bounds_valid(output_path: str) -> CheckResult:
    """Check that bounds are within valid WGS84 range."""
    with rasterio.open(output_path) as dst:
        b = dst.bounds
        if -180 <= b.left <= 180 and -180 <= b.right <= 180 and -90 <= b.bottom <= 90 and -90 <= b.top <= 90:
            return CheckResult("Bounds valid", True,
                               f"({b.left:.4f}, {b.bottom:.4f}, {b.right:.4f}, {b.top:.4f})")
        return CheckResult("Bounds valid", False,
                           f"Out of range: ({b.left:.4f}, {b.bottom:.4f}, {b.right:.4f}, {b.top:.4f})")


def check_band_count(output_path: str) -> CheckResult:
    """Check that the COG has exactly 1 band."""
    with rasterio.open(output_path) as dst:
        if dst.count == 1:
            return CheckResult("Band count", True, "1")
        return CheckResult("Band count", False, f"Expected 1, got {dst.count}")


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


def check_pixel_fidelity(input_path: str, output_path: str, variable: str = "",
                          group: str = "", n: int = 1000, tolerance: float = 0.5) -> CheckResult:
    """Sample random pixels from HDF5, reproject coords, compare against COG values."""
    _X_NAMES = ["xcoordinates", "x", "longitude", "lon"]
    _Y_NAMES = ["ycoordinates", "y", "latitude", "lat"]

    with h5py.File(input_path, "r") as f:
        grp = f[group] if group else f

        ds = grp[variable]
        raw = ds[:]
        if np.iscomplexobj(raw):
            src_data = np.abs(raw).astype(np.float32)
        else:
            src_data = raw.astype(np.float32)
        nodata_val = float(ds.attrs.get("_FillValue", -9999.0))

        def _search_ancestors(grp, candidates):
            """Search group and its ancestors for a dataset matching candidates."""
            current = grp
            while True:
                keys_lower = {k.lower(): k for k in current.keys()}
                for name in candidates:
                    if name in keys_lower:
                        return current[keys_lower[name]][:]
                if current.parent is None or current.parent == current:
                    break
                current = current.parent
            return None

        x_coords = _search_ancestors(grp, _X_NAMES)
        y_coords = _search_ancestors(grp, _Y_NAMES)

        if x_coords is None or y_coords is None:
            return CheckResult("Pixel fidelity", False, "Cannot find coordinate arrays")

        # Detect native CRS — search current group and ancestors
        src_crs = None
        current = grp
        while True:
            if "projection" in current:
                src_crs = CRS.from_epsg(int(np.asarray(current["projection"])))
                break
            if current.parent is None or current.parent == current:
                break
            current = current.parent
        if src_crs is None:
            src_crs = CRS.from_epsg(4326)

    # Ensure north-to-south
    if y_coords[0] < y_coords[-1]:
        y_coords = y_coords[::-1]
        src_data = src_data[::-1, :]

    height, width = src_data.shape
    rng = np.random.default_rng(42)
    rows = rng.integers(0, height, size=n)
    cols = rng.integers(0, width, size=n)

    src_vals = src_data[rows, cols]

    # Skip nodata pixels
    mask = ~np.isnan(src_vals) & (src_vals != nodata_val)
    if mask.sum() == 0:
        return CheckResult("Pixel fidelity", True, "All sampled pixels are nodata")

    rows = rows[mask]
    cols = cols[mask]
    src_vals = src_vals[mask]

    # Get native CRS coordinates for sampled pixels
    xs = x_coords[cols]
    ys = y_coords[rows]

    # Reproject to lon/lat
    dst_crs = CRS.from_epsg(4326)
    lons, lats = warp.transform(src_crs, dst_crs, xs, ys)
    lons = np.array(lons)
    lats = np.array(lats)

    # Sample from COG
    with rasterio.open(output_path) as cog:
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

    # Compare only where both have valid data
    cog_nodata = None
    with rasterio.open(output_path) as cog:
        cog_nodata = cog.nodata

    valid = ~np.isnan(cog_vals)
    if cog_nodata is not None:
        valid &= (cog_vals != cog_nodata)

    if valid.sum() == 0:
        return CheckResult("Pixel fidelity", False, "No valid COG pixels found at sampled locations")

    diffs = np.abs(src_vals[valid] - cog_vals[valid])
    max_diff = float(np.max(diffs))

    if max_diff > tolerance:
        return CheckResult("Pixel fidelity", False,
                           f"max diff={max_diff:.6f} exceeds tolerance={tolerance}")

    return CheckResult("Pixel fidelity", True,
                       f"{valid.sum()}/{n} data pixels, max diff={max_diff:.6f}")


def run_checks(input_path: str, output_path: str, variable: str = "",
               group: str = "") -> list[CheckResult]:
    """Run all validation checks and return structured results."""
    return [
        check_cog_valid(output_path),
        check_crs_4326(output_path),
        check_bounds_valid(output_path),
        check_band_count(output_path),
        check_nodata_present(output_path),
        check_overviews(output_path),
        check_pixel_fidelity(input_path, output_path, variable=variable, group=group),
    ]


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


def run_validation(input_path: str, output_path: str, variable: str = "",
                   group: str = "") -> bool:
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path, variable=variable, group=group)
    return print_report(results)


def main():
    parser = argparse.ArgumentParser(description="Validate a COG against its source HDF5")
    parser.add_argument("--input", required=True, help="Path to original HDF5 file")
    parser.add_argument("--output", required=True, help="Path to converted COG")
    parser.add_argument("--variable", required=True, help="HDF5 dataset name to validate against")
    parser.add_argument("--group", default="", help="HDF5 group path (default: root)")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)
    if not os.path.isfile(args.output):
        print(f"Error: output file not found: {args.output}")
        sys.exit(1)

    passed = run_validation(args.input, args.output, variable=args.variable, group=args.group)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
