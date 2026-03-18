# CNG Sandbox Phase 0: Complete CLI Toolkit — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the geo-conversions CLI toolkit — add NetCDF → COG conversion, package all 4 skills as an installable Python library, and provide a unified CLI entry point.

**Architecture:** Each conversion skill follows an identical pattern: `scripts/convert.py` (converter function) + `scripts/validate.py` (validator with `run_checks()` returning `list[CheckResult]`). A new top-level `pyproject.toml` makes the toolkit `pip install`-able, and `cli.py` provides a single entry point that auto-detects format and delegates. Existing skills are NOT modified — only new files are added.

**Tech Stack:** Python 3.10+, xarray, netcdf4, rasterio, rio-cogeo, numpy, geopandas, pyarrow

**Spec:** `docs/CNG_SANDBOX_PRODUCT_SPEC_v0.2.md` (Phase 0 section)
**Implementation plan:** `~/Documents/obsidian-notes/Project Docs/Map App Builder/cng-sandbox-implementation-plan.md`

---

## File Structure

```
skills/geo-conversions/
├── pyproject.toml                          # NEW — package definition
├── cli.py                                  # NEW — unified CLI entry point
├── __init__.py                             # NEW — package root
├── README.md                               # MODIFY — add NetCDF row + CLI + install sections
├── .gitignore
├── geotiff-to-cog/
│   ├── __init__.py                         # NEW — re-exports convert, run_checks
│   ├── SKILL.md
│   └── scripts/
│       ├── convert.py                      # EXISTING — unchanged
│       └── validate.py                     # EXISTING — unchanged
├── shapefile-to-geoparquet/
│   ├── __init__.py                         # NEW — re-exports convert, run_checks
│   ├── SKILL.md
│   └── scripts/
│       ├── convert.py                      # EXISTING — unchanged
│       └── validate.py                     # EXISTING — unchanged
├── geojson-to-geoparquet/
│   ├── __init__.py                         # NEW — re-exports convert, run_checks
│   ├── SKILL.md
│   └── scripts/
│       ├── convert.py                      # EXISTING — unchanged
│       └── validate.py                     # EXISTING — unchanged
└── netcdf-to-cog/                          # NEW — entire folder
    ├── __init__.py                         # NEW — re-exports convert, run_checks
    ├── SKILL.md
    └── scripts/
        ├── convert.py                      # NEW — xarray + rio-cogeo
        └── validate.py                     # NEW — same 8 checks as geotiff-to-cog
```

---

## Chunk 1: NetCDF → COG Skill

### Task 1: Create NetCDF → COG converter

**Files:**
- Create: `skills/geo-conversions/netcdf-to-cog/scripts/convert.py`

**Context:** Follow the exact same pattern as `skills/geo-conversions/geotiff-to-cog/scripts/convert.py` — dependency check block at top, a `convert()` function, and a `main()` CLI entry point. The key difference: xarray opens the NetCDF, selects one variable + one timestep, writes a temporary GeoTIFF, then rio-cogeo converts that to COG.

- [ ] **Step 1: Create directory**

```bash
mkdir -p skills/geo-conversions/netcdf-to-cog/scripts
```

- [ ] **Step 2: Write the converter**

Create `skills/geo-conversions/netcdf-to-cog/scripts/convert.py`:

```python
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
```

- [ ] **Step 3: Verify the file was created correctly**

```bash
python -c "import ast; ast.parse(open('skills/geo-conversions/netcdf-to-cog/scripts/convert.py').read()); print('Syntax OK')"
```

Expected: `Syntax OK`

- [ ] **Step 4: Commit**

```bash
git add skills/geo-conversions/netcdf-to-cog/scripts/convert.py
git commit -m "feat(geo-conversions): add NetCDF to COG converter"
```

---

### Task 2: Create NetCDF → COG validator

**Files:**
- Create: `skills/geo-conversions/netcdf-to-cog/scripts/validate.py`

**Context:** This validator uses the same 8 checks as `geotiff-to-cog/scripts/validate.py` (COG structure, CRS, bounds, dimensions, band count, pixel fidelity, nodata, overviews). The difference is only in the self-test: it generates a synthetic NetCDF instead of a synthetic GeoTIFF.

**Signature note:** `run_checks()` takes extra `variable` and `time_index` keyword arguments (both with defaults). This is by design — the shootout runner calls `run_checks(input_path, output_path)` with exactly 2 positional args, which works because the extra params default to first variable / timestep 0. The generic two-argument call pattern is preserved.

- [ ] **Step 1: Write the validator**

Create `skills/geo-conversions/netcdf-to-cog/scripts/validate.py`:

```python
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


def check_crs_present(output_path: str) -> CheckResult:
    """Check that the COG has a CRS defined."""
    with rasterio.open(output_path) as dst:
        if dst.crs is not None:
            return CheckResult("CRS present", True, f"{dst.crs}")
        return CheckResult("CRS present", False, "No CRS defined")


def check_bounds_match(input_path: str, output_path: str, variable: str | None = None,
                       time_index: int = 0, tolerance: float = 1e-4) -> CheckResult:
    """Check that bounding box covers the NetCDF spatial extent."""
    ds = xr.open_dataset(input_path)
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

    # COG bounds should contain NetCDF cell centers (with half-pixel margin)
    for i, (nc_val, cog_val, label) in enumerate([
        (nc_bounds[0], cog_bounds[0], "west"),
        (nc_bounds[1], cog_bounds[1], "south"),
        (nc_bounds[2], cog_bounds[2], "east"),
        (nc_bounds[3], cog_bounds[3], "north"),
    ]):
        # For west/south, COG should be <= NetCDF center; for east/north, COG should be >=
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
    ds = xr.open_dataset(input_path)
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
                          time_index: int = 0, n: int = 1000, tolerance: float = 1e-4) -> CheckResult:
    """Sample random pixels and compare values against the NetCDF source."""
    ds = xr.open_dataset(input_path)
    data_vars = list(ds.data_vars)
    var_name = variable if variable else data_vars[0]
    da = ds[var_name]

    time_dims = [d for d in da.dims if d.lower() in ("time", "t")]
    if time_dims:
        da = da.isel({time_dims[0]: time_index})

    lat_names = [d for d in da.dims if d.lower() in ("lat", "latitude", "y")]
    lats = da[lat_names[0]].values
    if lats[0] < lats[-1]:
        da = da.isel({lat_names[0]: slice(None, None, -1)})

    nc_data = da.values.astype(np.float32)
    ds.close()

    with rasterio.open(output_path) as dst:
        cog_data = dst.read(1)
        nodata = dst.nodata

    rng = np.random.default_rng(42)
    height, width = nc_data.shape
    rows = rng.integers(0, height, size=n)
    cols = rng.integers(0, width, size=n)

    nc_vals = nc_data[rows, cols]
    cog_vals = cog_data[rows, cols]

    # Skip nodata pixels
    mask = ~np.isnan(nc_vals)
    if nodata is not None:
        mask &= (cog_vals != nodata)

    if mask.sum() == 0:
        return CheckResult("Pixel fidelity", True, "All sampled pixels are nodata")

    max_diff = np.max(np.abs(nc_vals[mask] - cog_vals[mask]))
    if max_diff > tolerance:
        return CheckResult("Pixel fidelity", False, f"max diff={max_diff:.6f} exceeds {tolerance}")

    return CheckResult("Pixel fidelity", True, f"{mask.sum()}/{n} data pixels sampled, max diff={max_diff:.8f}")


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
```

- [ ] **Step 2: Verify syntax**

```bash
python -c "import ast; ast.parse(open('skills/geo-conversions/netcdf-to-cog/scripts/validate.py').read()); print('Syntax OK')"
```

Expected: `Syntax OK`

- [ ] **Step 3: Run the self-test**

```bash
cd skills/geo-conversions/netcdf-to-cog
pip install xarray netcdf4 rasterio rio-cogeo numpy
python scripts/validate.py
```

Expected: All 8 checks PASS, exits 0.

- [ ] **Step 4: Commit**

```bash
git add skills/geo-conversions/netcdf-to-cog/scripts/validate.py
git commit -m "feat(geo-conversions): add NetCDF to COG validator with self-test"
```

---

### Task 3: Create NetCDF → COG SKILL.md

**Files:**
- Create: `skills/geo-conversions/netcdf-to-cog/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Create `skills/geo-conversions/netcdf-to-cog/SKILL.md` following the same structure as `skills/geo-conversions/geotiff-to-cog/SKILL.md`. Key differences:

- Title: "NetCDF → COG Conversion Skill"
- Prerequisites: `pip install xarray netcdf4 rasterio rio-cogeo numpy`
- Extra CLI flags: `--variable <name>`, `--time-index <int>`
- Known complexity notes: multi-variable NetCDFs, temporal dimensions, CRS assumed EPSG:4326 (most climate/weather NetCDFs use geographic coordinates)
- Validation: same 8 raster checks as geotiff-to-cog

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/netcdf-to-cog/SKILL.md
git commit -m "docs(geo-conversions): add NetCDF to COG skill documentation"
```

---

## Chunk 2: Package the Toolkit

### Task 4: Create `__init__.py` files for all skills

**Files:**
- Create: `skills/geo-conversions/__init__.py`
- Create: `skills/geo-conversions/geotiff-to-cog/__init__.py`
- Create: `skills/geo-conversions/shapefile-to-geoparquet/__init__.py`
- Create: `skills/geo-conversions/geojson-to-geoparquet/__init__.py`
- Create: `skills/geo-conversions/netcdf-to-cog/__init__.py`

**Context:** These `__init__.py` files make the skills importable as Python modules. Each skill's `__init__.py` re-exports `convert` and `run_checks` using `importlib` to defer the dependency-check `sys.exit(1)` until the function is actually called (not at `import` time). This means `import geotiff_to_cog` succeeds even without rasterio installed — the error only fires when you call `convert()` or `run_checks()`. The top-level `__init__.py` provides a registry mapping format extensions to skill modules.

- [ ] **Step 1: Write per-skill `__init__.py` files**

Each skill gets an identical pattern. Create `skills/geo-conversions/geotiff-to-cog/__init__.py`:

```python
"""GeoTIFF to COG conversion skill."""

import importlib.util
import os

_SCRIPTS = os.path.join(os.path.dirname(__file__), "scripts")
_cache = {}


def _load(name):
    if name not in _cache:
        spec = importlib.util.spec_from_file_location(name, os.path.join(_SCRIPTS, f"{name}.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _cache[name] = mod
    return _cache[name]


def convert(input_path: str, output_path: str, **kwargs):
    """Convert a GeoTIFF to a Cloud-Optimized GeoTIFF."""
    return _load("convert").convert(input_path, output_path, **kwargs)


def run_checks(input_path: str, output_path: str, **kwargs):
    """Run all validation checks and return list[CheckResult]."""
    return _load("validate").run_checks(input_path, output_path, **kwargs)
```

Create the same pattern for each of the other three skills:
- `skills/geo-conversions/shapefile-to-geoparquet/__init__.py` (docstring: "Shapefile to GeoParquet conversion skill.")
- `skills/geo-conversions/geojson-to-geoparquet/__init__.py` (docstring: "GeoJSON to GeoParquet conversion skill.")
- `skills/geo-conversions/netcdf-to-cog/__init__.py` (docstring: "NetCDF to COG conversion skill.")

All four files use the exact same `_load` + `convert` + `run_checks` pattern.

- [ ] **Step 2: Write top-level `__init__.py`**

Create `skills/geo-conversions/__init__.py`:

```python
"""CNG Toolkit — geospatial file conversion and validation."""

SKILLS = {
    ".tif": "geotiff_to_cog",
    ".tiff": "geotiff_to_cog",
    ".shp": "shapefile_to_geoparquet",
    ".geojson": "geojson_to_geoparquet",
    ".json": "geojson_to_geoparquet",
    ".nc": "netcdf_to_cog",
    ".nc4": "netcdf_to_cog",
}
```

- [ ] **Step 3: Verify imports work**

```bash
cd skills/geo-conversions
python -c "
from geotiff_to_cog import convert, run_checks
print('geotiff-to-cog: OK')
from netcdf_to_cog import convert, run_checks
print('netcdf-to-cog: OK')
from shapefile_to_geoparquet import convert, run_checks
print('shapefile-to-geoparquet: OK')
from geojson_to_geoparquet import convert, run_checks
print('geojson-to-geoparquet: OK')
"
```

Expected: All 4 print "OK". (Requires dependencies installed.)

- [ ] **Step 4: Commit**

```bash
git add skills/geo-conversions/__init__.py
git add skills/geo-conversions/geotiff-to-cog/__init__.py
git add skills/geo-conversions/shapefile-to-geoparquet/__init__.py
git add skills/geo-conversions/geojson-to-geoparquet/__init__.py
git add skills/geo-conversions/netcdf-to-cog/__init__.py
git commit -m "feat(geo-conversions): add __init__.py files for programmatic imports"
```

---

### Task 5: Create `pyproject.toml`

**Files:**
- Create: `skills/geo-conversions/pyproject.toml`

**Context:** This makes the toolkit installable via `pip install -e skills/geo-conversions/`. The ingestion service (Phase 1) will add this as a path dependency. Dependencies are split into extras so each conversion path only pulls what it needs.

- [ ] **Step 1: Write pyproject.toml**

Create `skills/geo-conversions/pyproject.toml`. Note: the skill directories use hyphens (`geotiff-to-cog`) but Python packages need underscores. The `package-dir` mapping handles this without renaming anything. The `py-modules` entry makes `cli.py` importable for the `cng` console script.

```toml
[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"

[project]
name = "cng-toolkit"
version = "0.1.0"
description = "Geospatial file conversion and validation toolkit"
requires-python = ">=3.10"
dependencies = []

[project.optional-dependencies]
raster = ["rasterio", "rio-cogeo", "numpy"]
vector = ["geopandas", "pyarrow", "shapely"]
netcdf = ["xarray", "netcdf4", "rasterio", "rio-cogeo", "numpy"]
all = ["rasterio", "rio-cogeo", "numpy", "geopandas", "pyarrow", "shapely", "xarray", "netcdf4"]

[project.scripts]
cng = "cli:main"

[tool.setuptools]
py-modules = ["cli"]
packages = [
    "geotiff_to_cog",
    "shapefile_to_geoparquet",
    "geojson_to_geoparquet",
    "netcdf_to_cog",
]

[tool.setuptools.package-dir]
geotiff_to_cog = "geotiff-to-cog"
shapefile_to_geoparquet = "shapefile-to-geoparquet"
geojson_to_geoparquet = "geojson-to-geoparquet"
netcdf_to_cog = "netcdf-to-cog"
```

- [ ] **Step 2: Test the install**

```bash
cd skills/geo-conversions
pip install -e ".[all]"
```

Then verify from any directory:

```bash
cd /tmp
python -c "from geotiff_to_cog import convert, run_checks; print('Import from anywhere: OK')"
```

Expected: `Import from anywhere: OK`

- [ ] **Step 4: Commit**

```bash
git add skills/geo-conversions/pyproject.toml
git commit -m "feat(geo-conversions): add pyproject.toml for pip-installable toolkit"
```

---

### Task 6: Create unified CLI entry point

**Files:**
- Create: `skills/geo-conversions/cli.py`

**Context:** Single entry point: `python cli.py convert <input> <output>` auto-detects format from extension and delegates. Also: `python cli.py validate <input> <output>`. This is what the ingestion service calls — no format-specific routing in the backend.

- [ ] **Step 1: Write cli.py**

Create `skills/geo-conversions/cli.py`:

```python
"""Unified CLI for CNG Toolkit — auto-detects format and delegates."""

import argparse
import os
import sys

EXTENSION_MAP = {
    ".tif": "geotiff-to-cog",
    ".tiff": "geotiff-to-cog",
    ".shp": "shapefile-to-geoparquet",
    ".geojson": "geojson-to-geoparquet",
    ".json": "geojson-to-geoparquet",
    ".nc": "netcdf-to-cog",
    ".nc4": "netcdf-to-cog",
}

SUPPORTED_EXTENSIONS = ", ".join(sorted(set(EXTENSION_MAP.keys())))


def _load_skill(skill_name: str, script_name: str):
    """Dynamically load a script from a skill folder."""
    import importlib.util
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(script_dir, skill_name, "scripts", f"{script_name}.py")
    if not os.path.isfile(script_path):
        print(f"Error: {script_path} not found")
        sys.exit(1)
    spec = importlib.util.spec_from_file_location(script_name, script_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def detect_format(input_path: str) -> str:
    """Detect the skill name from the input file extension."""
    ext = os.path.splitext(input_path)[1].lower()
    skill = EXTENSION_MAP.get(ext)
    if skill is None:
        print(f"Error: unsupported format '{ext}'")
        print(f"Supported: {SUPPORTED_EXTENSIONS}")
        sys.exit(1)
    return skill


def cmd_convert(args):
    """Run the appropriate converter."""
    skill = detect_format(args.input)
    mod = _load_skill(skill, "convert")

    kwargs = {"verbose": args.verbose}
    # NetCDF-specific params — only pass to netcdf-to-cog (other converters don't accept them)
    if skill == "netcdf-to-cog":
        if args.variable is not None:
            kwargs["variable"] = args.variable
        kwargs["time_index"] = args.time_index

    mod.convert(args.input, args.output, **kwargs)


def cmd_validate(args):
    """Run the appropriate validator."""
    # Detect from input extension for rasters, output extension for vectors
    ext = os.path.splitext(args.input)[1].lower()
    skill = EXTENSION_MAP.get(ext)
    if skill is None:
        print(f"Error: unsupported format '{ext}'")
        sys.exit(1)

    mod = _load_skill(skill, "validate")

    kwargs = {}
    # NetCDF-specific params — only pass to netcdf-to-cog (other validators don't accept them)
    if skill == "netcdf-to-cog":
        if args.variable is not None:
            kwargs["variable"] = args.variable
        kwargs["time_index"] = args.time_index

    results = mod.run_checks(args.input, args.output, **kwargs)
    passed = mod.print_report(results)
    sys.exit(0 if passed else 1)


def main():
    parser = argparse.ArgumentParser(description="CNG Toolkit — convert and validate geospatial files")
    sub = parser.add_subparsers(dest="command", required=True)

    p_convert = sub.add_parser("convert", help="Convert a geospatial file to cloud-native format")
    p_convert.add_argument("input", help="Path to input file")
    p_convert.add_argument("output", help="Path for output file")
    p_convert.add_argument("--variable", default=None, help="NetCDF variable name")
    p_convert.add_argument("--time-index", type=int, default=0, help="NetCDF timestep index")
    p_convert.add_argument("--verbose", action="store_true")
    p_convert.set_defaults(func=cmd_convert)

    p_validate = sub.add_parser("validate", help="Validate a converted file against its source")
    p_validate.add_argument("input", help="Path to original file")
    p_validate.add_argument("output", help="Path to converted file")
    p_validate.add_argument("--variable", default=None, help="NetCDF variable name")
    p_validate.add_argument("--time-index", type=int, default=0, help="NetCDF timestep index")
    p_validate.set_defaults(func=cmd_validate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test the CLI with the geotiff-to-cog self-test data**

```bash
cd skills/geo-conversions
python -c "
from geotiff_to_cog.scripts.validate import generate_synthetic_geotiff
generate_synthetic_geotiff('/tmp/test_cli.tif')
print('Generated test GeoTIFF')
"
python cli.py convert /tmp/test_cli.tif /tmp/test_cli_out.tif --verbose
python cli.py validate /tmp/test_cli.tif /tmp/test_cli_out.tif
```

Expected: Convert succeeds, all 8 validation checks PASS.

- [ ] **Step 3: Test the CLI with NetCDF**

```bash
cd skills/geo-conversions
python -c "
from netcdf_to_cog.scripts.validate import generate_synthetic_netcdf
generate_synthetic_netcdf('/tmp/test_cli.nc')
print('Generated test NetCDF')
"
python cli.py convert /tmp/test_cli.nc /tmp/test_cli_nc_out.tif --variable temperature --verbose
python cli.py validate /tmp/test_cli.nc /tmp/test_cli_nc_out.tif --variable temperature
```

Expected: Convert succeeds, all 8 validation checks PASS.

- [ ] **Step 4: Commit**

```bash
git add skills/geo-conversions/cli.py
git commit -m "feat(geo-conversions): add unified CLI entry point with format auto-detection"
```

---

### Task 7: Update README

**Files:**
- Modify: `skills/geo-conversions/README.md`

- [ ] **Step 1: Update the README**

Add the NetCDF row to the skills table, add CLI section, add install section. The updated README should contain:

1. **Skills table** — add row: `netcdf-to-cog | NetCDF (.nc, .nc4) | Cloud-Optimized GeoTIFF`
2. **Installation section** (new, after "Usage pattern"):
   ```
   ## Installation (for programmatic use)

   pip install -e "skills/geo-conversions[all]"

   Then import from anywhere:

       from geotiff_to_cog import convert, run_checks
       from netcdf_to_cog import convert, run_checks
   ```
3. **Unified CLI section** (new, after "Usage pattern"):
   ```
   ## Unified CLI

   python skills/geo-conversions/cli.py convert <input> <output>
   python skills/geo-conversions/cli.py validate <input> <output>

   Format is auto-detected from the input file extension.
   ```
4. **Programmatic use section** — update the import example to show the package import style:
   ```python
   from geotiff_to_cog import run_checks

   results = run_checks("input.tif", "output.tif")
   ```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/README.md
git commit -m "docs(geo-conversions): add NetCDF skill, CLI, and install instructions to README"
```

---

## Chunk 3: Real-World Data Validation

### Task 8: Validate against real datasets

**Files:**
- No new files. May modify validators if issues are found.

**Context:** Run all 4 conversion skills against real-world data to catch edge cases the synthetic self-tests miss. The shootout already validated geotiff-to-cog, shapefile-to-geoparquet, and geojson-to-geoparquet against real data, so focus effort on NetCDF → COG (completely untested on real data) and do a quick smoke test of the other three.

- [ ] **Step 1: Download a real NetCDF file**

Download NOAA ERSST data (small, single-variable, widely available):

```bash
curl -o /tmp/sst_test.nc https://psl.noaa.gov/thredds/fileServer/Datasets/noaa.ersst.v5/sst.mnmean.nc
```

Verify the download:

```bash
python -c "import xarray as xr; ds = xr.open_dataset('/tmp/sst_test.nc'); print(list(ds.data_vars)); print(ds.dims)"
```

Expected: shows `sst` as a variable with `time`, `lat`, `lon` dimensions.

- [ ] **Step 2: Run NetCDF → COG conversion + validation on real data**

```bash
cd skills/geo-conversions
python cli.py convert /tmp/sst_test.nc /tmp/sst_test_cog.tif --variable sst --verbose
python cli.py validate /tmp/sst_test.nc /tmp/sst_test_cog.tif --variable sst
```

Expected: All 8 checks PASS. If any fail, investigate and fix the converter or validator before proceeding.

- [ ] **Step 3: Smoke-test the other 3 skills on real data**

Use data from the shootout (if still available) or download fresh:

```bash
# GeoJSON — USGS earthquakes
curl -o /tmp/quakes.geojson "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson"
python cli.py convert /tmp/quakes.geojson /tmp/quakes.parquet --verbose
python cli.py validate /tmp/quakes.geojson /tmp/quakes.parquet

# Shapefile — use any .shp from the shootout data or HydroRIVERS
# (assumes shootout data is at docs/shootout/data/)
ls docs/shootout/data/*.shp 2>/dev/null && \
  python cli.py convert docs/shootout/data/*.shp /tmp/test_shp.parquet --verbose && \
  python cli.py validate docs/shootout/data/*.shp /tmp/test_shp.parquet

# GeoTIFF — use any .tif from the shootout data
ls docs/shootout/data/*.tif 2>/dev/null && \
  python cli.py convert docs/shootout/data/*.tif /tmp/test_geotiff.tif --verbose && \
  python cli.py validate docs/shootout/data/*.tif /tmp/test_geotiff.tif
```

Expected: All pass. If issues are found, fix and commit each fix separately with a descriptive message.

- [ ] **Step 4: Commit any fixes**

If any validators or converters needed fixes:

```bash
git add -u skills/geo-conversions/
git commit -m "fix(geo-conversions): address issues found during real-world data validation"
```

If no fixes were needed, skip this step.

---

## Verification

After all tasks are complete, run this final verification:

```bash
cd skills/geo-conversions

# 1. All self-tests pass
python geotiff-to-cog/scripts/validate.py
python shapefile-to-geoparquet/scripts/validate.py
python geojson-to-geoparquet/scripts/validate.py
python netcdf-to-cog/scripts/validate.py

# 2. Package installs cleanly
pip install -e ".[all]"

# 3. Imports work from outside the directory
cd /tmp
python -c "
from geotiff_to_cog import convert, run_checks
from shapefile_to_geoparquet import convert, run_checks
from geojson_to_geoparquet import convert, run_checks
from netcdf_to_cog import convert, run_checks
print('All 4 skills importable')
"

# 4. Unified CLI works
cd skills/geo-conversions
python cli.py convert --help
python cli.py validate --help
```

All commands should exit 0.
