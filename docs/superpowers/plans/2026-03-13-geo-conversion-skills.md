# Geospatial File Conversion Skills Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 3 standalone, portable Python conversion skills that convert GeoTIFF, Shapefile, and GeoJSON to cloud-native formats with rigorous validation.

**Architecture:** Each skill is a self-contained folder with a SKILL.md guide and a `scripts/` directory containing `convert.py` and `validate.py`. No shared modules between skills. Each `validate.py` includes a self-test mode that generates synthetic data, converts it, and validates — no external test files needed.

**Tech Stack:** Python 3.10+, rasterio, rio-cogeo, numpy (raster), geopandas, pyarrow, shapely (vector)

**Spec:** `docs/superpowers/specs/2026-03-13-geo-conversion-skills-design.md`

---

## Chunk 1: Setup and geotiff-to-cog Skill

### Task 1: Create directory structure and group README

**Files:**
- Create: `skills/geo-conversions/README.md`
- Create: `skills/geo-conversions/geotiff-to-cog/scripts/` (directory)
- Create: `skills/geo-conversions/shapefile-to-geoparquet/scripts/` (directory)
- Create: `skills/geo-conversions/geojson-to-geoparquet/scripts/` (directory)

- [ ] **Step 1: Create all directories**

```bash
mkdir -p skills/geo-conversions/geotiff-to-cog/scripts
mkdir -p skills/geo-conversions/shapefile-to-geoparquet/scripts
mkdir -p skills/geo-conversions/geojson-to-geoparquet/scripts
```

- [ ] **Step 2: Write group README**

Create `skills/geo-conversions/README.md`:

```markdown
# Geospatial File Conversion Skills

Standalone Python utilities for converting legacy geospatial formats to cloud-native equivalents. Each skill is independently distributable — copy a single skill folder to any machine with Python 3.10+ and use it directly.

## Skills

| Skill | Input | Output |
|-------|-------|--------|
| `geotiff-to-cog` | GeoTIFF (.tif, .tiff) | Cloud-Optimized GeoTIFF |
| `shapefile-to-geoparquet` | Shapefile (.shp + companions) | GeoParquet (.parquet) |
| `geojson-to-geoparquet` | GeoJSON (.geojson, .json) | GeoParquet (.parquet) |

## Usage pattern

Each skill has the same interface:

1. Install dependencies: `pip install <packages listed in SKILL.md>`
2. Convert: `python scripts/convert.py --input <source> --output <destination>`
3. Validate: `python scripts/validate.py --input <source> --output <destination>`

Run `python scripts/validate.py` with no arguments to execute a self-test.
```

- [ ] **Step 3: Commit**

```bash
git add skills/geo-conversions/
git commit -m "feat: scaffold geo-conversions skill group with README"
```

---

### Task 2: geotiff-to-cog SKILL.md

**Files:**
- Create: `skills/geo-conversions/geotiff-to-cog/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Create `skills/geo-conversions/geotiff-to-cog/SKILL.md`:

```markdown
# Skill: GeoTIFF to Cloud-Optimized GeoTIFF

## When to use

When you have a GeoTIFF file and need to convert it to a Cloud-Optimized GeoTIFF (COG) for efficient cloud-based access, tiling, and visualization.

## Prerequisites

- Python 3.10+
- `pip install rasterio rio-cogeo numpy`

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/convert.py`](scripts/convert.py) | Convert a GeoTIFF to COG with configurable compression |
| [`scripts/validate.py`](scripts/validate.py) | Validate that a COG preserves all data from the source GeoTIFF |

## Quickstart

Install dependencies, convert a file, and validate the result:

    pip install rasterio rio-cogeo numpy
    python scripts/convert.py --input data.tif --output data_cog.tif
    python scripts/validate.py --input data.tif --output data_cog.tif

## CLI flags

### convert.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | Yes | — | Path to input GeoTIFF |
| `--output` | Yes | — | Path for output COG |
| `--compression` | No | `DEFLATE` | Compression method: DEFLATE, ZSTD, or LZW |
| `--overwrite` | No | False | Overwrite output if it exists |
| `--verbose` | No | False | Print detailed progress |

### validate.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | No | — | Path to original GeoTIFF (omit for self-test) |
| `--output` | No | — | Path to converted COG (omit for self-test) |

When both `--input` and `--output` are omitted, runs a self-test that generates synthetic data, converts it, and validates the result.

## Known failure modes

_Populated during development._

## Changelog

_Updated during development._
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/geotiff-to-cog/SKILL.md
git commit -m "feat: add geotiff-to-cog SKILL.md"
```

---

### Task 3: geotiff-to-cog convert.py

**Files:**
- Create: `skills/geo-conversions/geotiff-to-cog/scripts/convert.py`

- [ ] **Step 1: Write convert.py**

Create `skills/geo-conversions/geotiff-to-cog/scripts/convert.py`:

```python
"""Convert a GeoTIFF to a Cloud-Optimized GeoTIFF (COG)."""

import argparse
import os
import sys

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

import numpy as np
import rasterio


def convert(input_path: str, output_path: str, compression: str = "DEFLATE", verbose: bool = False):
    """Convert a GeoTIFF to a Cloud-Optimized GeoTIFF."""
    with rasterio.open(input_path) as src:
        profile = src.profile.copy()

        if verbose:
            print(f"Input: {src.width}x{src.height}, {src.count} band(s), dtype={src.dtypes[0]}")
            print(f"CRS: {src.crs}")
            print(f"Bounds: {src.bounds}")

        profile.update(
            driver="GTiff",
            tiled=True,
            blockxsize=512,
            blockysize=512,
            compress=compression,
            copy_src_overviews=False,
        )

        if verbose:
            print(f"Writing COG with {compression} compression...")

        with rasterio.open(output_path, "w", **profile) as dst:
            for band_idx in range(1, src.count + 1):
                data = src.read(band_idx)
                dst.write(data, band_idx)

            if verbose:
                print("Building overviews...")

            overview_levels = [2, 4, 8, 16]
            dst.build_overviews(overview_levels, rasterio.enums.Resampling.nearest)
            dst.update_tags(ns="rio_overview", resampling="nearest")

    # Re-open and write as COG using rio-cogeo's cog_translate would be ideal,
    # but writing tiled + overviews directly is simpler and produces valid COGs.
    # Validate with validate.py to confirm.

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Convert a GeoTIFF to a Cloud-Optimized GeoTIFF")
    parser.add_argument("--input", required=True, help="Path to input GeoTIFF")
    parser.add_argument("--output", required=True, help="Path for output COG")
    parser.add_argument("--compression", default="DEFLATE", choices=["DEFLATE", "ZSTD", "LZW"],
                        help="Compression method (default: DEFLATE)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output if it exists")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext not in (".tif", ".tiff"):
        print(f"Error: expected a .tif or .tiff file, got '{ext}'")
        sys.exit(1)

    if os.path.exists(args.output) and not args.overwrite:
        print(f"Error: output file already exists: {args.output}")
        print("Use --overwrite to replace it.")
        sys.exit(1)

    convert(args.input, args.output, compression=args.compression, verbose=args.verbose)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/geotiff-to-cog/scripts/convert.py
git commit -m "feat: add geotiff-to-cog convert.py"
```

---

### Task 4: geotiff-to-cog validate.py

**Files:**
- Create: `skills/geo-conversions/geotiff-to-cog/scripts/validate.py`

- [ ] **Step 1: Write validate.py**

Create `skills/geo-conversions/geotiff-to-cog/scripts/validate.py`:

```python
"""Validate that a COG preserves all data from the source GeoTIFF."""

import argparse
import os
import sys
import tempfile
from collections import namedtuple

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

CheckResult = namedtuple("CheckResult", ["name", "passed", "detail"])


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


def check_nodata_match(input_path: str, output_path: str) -> CheckResult:
    """Check that nodata value is preserved."""
    with rasterio.open(input_path) as src, rasterio.open(output_path) as dst:
        if src.nodata == dst.nodata:
            return CheckResult("NoData preserved", True, f"{src.nodata}")
        return CheckResult("NoData preserved", False,
                           f"Source: {src.nodata}, Output: {dst.nodata}")


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
            data[0:10, 0:10] = -9999.0  # nodata region
            dst.write(data, band)


def run_self_test() -> bool:
    """Generate synthetic data, convert, and validate."""
    print("Running self-test...")

    # Import convert from sibling file
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


def run_validation(input_path: str, output_path: str) -> bool:
    """Run all validation checks and print report."""
    results = [
        check_cog_valid(output_path),
        check_crs_match(input_path, output_path),
        check_bounds_match(input_path, output_path),
        check_dimensions_match(input_path, output_path),
        check_band_count(input_path, output_path),
        check_pixel_fidelity(input_path, output_path),
        check_nodata_match(input_path, output_path),
        check_overviews(output_path),
    ]
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/geotiff-to-cog/scripts/validate.py
git commit -m "feat: add geotiff-to-cog validate.py with self-test"
```

---

### Task 5: geotiff-to-cog ralph-loop validation

- [ ] **Step 1: Install dependencies**

```bash
pip install rasterio rio-cogeo numpy
```

- [ ] **Step 2: Run self-test**

```bash
cd skills/geo-conversions/geotiff-to-cog
python scripts/validate.py
```

Expected: All 8 checks pass, exit code 0.

- [ ] **Step 3: If any checks fail, fix and re-run**

Fix the failing script(s), update SKILL.md changelog with what was learned, and re-run `python scripts/validate.py` until all checks pass.

- [ ] **Step 4: Test with diverse synthetic data**

Add two more synthetic test cases to validate edge cases. Modify `generate_synthetic_geotiff` or create additional generator calls:

Test case A — Integer dtype with different CRS:
```python
# EPSG:32618 (UTM zone 18N), uint8, 1 band, nodata=0
rasterio.open(path, "w", driver="GTiff", width=512, height=512, count=1,
              dtype="uint8", crs="EPSG:32618",
              transform=rasterio.transform.from_bounds(580000, 4500000, 590000, 4510000, 512, 512),
              nodata=0)
```

Test case B — Multi-band float64:
```python
# EPSG:3857 (Web Mercator), float64, 3 bands, nodata=nan
rasterio.open(path, "w", driver="GTiff", width=128, height=128, count=3,
              dtype="float64", crs="EPSG:3857",
              transform=rasterio.transform.from_bounds(-8800000, 4800000, -8700000, 4900000, 128, 128),
              nodata=float("nan"))
```

For each test case: generate the synthetic input, run `convert.py`, run `validate.py`, confirm all checks pass.

- [ ] **Step 5: Commit any fixes**

```bash
git add skills/geo-conversions/geotiff-to-cog/
git commit -m "fix: geotiff-to-cog validation fixes from ralph-loop"
```

---

## Chunk 2: Vector Skills and README Update

### Task 6: shapefile-to-geoparquet SKILL.md

**Files:**
- Create: `skills/geo-conversions/shapefile-to-geoparquet/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Create `skills/geo-conversions/shapefile-to-geoparquet/SKILL.md`:

```markdown
# Skill: Shapefile to GeoParquet

## When to use

When you have a Shapefile and need to convert it to GeoParquet for efficient columnar storage, cloud access, and modern geospatial workflows.

## Prerequisites

- Python 3.10+
- `pip install geopandas pyarrow shapely`

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/convert.py`](scripts/convert.py) | Convert a Shapefile to GeoParquet |
| [`scripts/validate.py`](scripts/validate.py) | Validate that GeoParquet preserves all data from the source Shapefile |

## Quickstart

    pip install geopandas pyarrow shapely
    python scripts/convert.py --input data.shp --output data.parquet
    python scripts/validate.py --input data.shp --output data.parquet

## CLI flags

### convert.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | Yes | — | Path to input .shp file (companion .dbf, .shx, .prj resolved automatically) |
| `--output` | Yes | — | Path for output .parquet file |
| `--overwrite` | No | False | Overwrite output if it exists |
| `--verbose` | No | False | Print detailed progress |

### validate.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | No | — | Path to original Shapefile (omit for self-test) |
| `--output` | No | — | Path to converted GeoParquet (omit for self-test) |

When both `--input` and `--output` are omitted, runs a self-test that generates synthetic data, converts it, and validates the result.

## Known failure modes

_Populated during development._

## Changelog

_Updated during development._
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/shapefile-to-geoparquet/SKILL.md
git commit -m "feat: add shapefile-to-geoparquet SKILL.md"
```

---

### Task 7: shapefile-to-geoparquet convert.py

**Files:**
- Create: `skills/geo-conversions/shapefile-to-geoparquet/scripts/convert.py`

- [ ] **Step 1: Write convert.py**

Create `skills/geo-conversions/shapefile-to-geoparquet/scripts/convert.py`:

```python
"""Convert a Shapefile to GeoParquet."""

import argparse
import os
import sys

_REQUIRED = {"geopandas": "geopandas", "pyarrow": "pyarrow", "shapely": "shapely"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)}")
    sys.exit(1)

import geopandas as gpd


def convert(input_path: str, output_path: str, verbose: bool = False):
    """Convert a Shapefile to GeoParquet."""
    if verbose:
        print(f"Reading Shapefile: {input_path}")

    gdf = gpd.read_file(input_path)

    if verbose:
        print(f"  {len(gdf)} features, {len(gdf.columns)} columns")
        print(f"  CRS: {gdf.crs}")
        print(f"  Geometry type(s): {gdf.geometry.geom_type.unique().tolist()}")
        print(f"Writing GeoParquet: {output_path}")

    gdf.to_parquet(output_path)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path} ({size_mb:.2f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Convert a Shapefile to GeoParquet")
    parser.add_argument("--input", required=True, help="Path to input .shp file")
    parser.add_argument("--output", required=True, help="Path for output .parquet file")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output if it exists")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext != ".shp":
        print(f"Error: expected a .shp file, got '{ext}'")
        sys.exit(1)

    if os.path.exists(args.output) and not args.overwrite:
        print(f"Error: output file already exists: {args.output}")
        print("Use --overwrite to replace it.")
        sys.exit(1)

    convert(args.input, args.output, verbose=args.verbose)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/shapefile-to-geoparquet/scripts/convert.py
git commit -m "feat: add shapefile-to-geoparquet convert.py"
```

---

### Task 8: shapefile-to-geoparquet validate.py

**Files:**
- Create: `skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py`

- [ ] **Step 1: Write validate.py**

Create `skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py`:

```python
"""Validate that GeoParquet preserves all data from a source Shapefile."""

import argparse
import json
import os
import sys
import tempfile
from collections import namedtuple

_REQUIRED = {"geopandas": "geopandas", "pyarrow": "pyarrow", "shapely": "shapely", "numpy": "numpy"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)}")
    sys.exit(1)

import geopandas as gpd
import numpy as np
import pyarrow.parquet as pq
from shapely.geometry import Point

CheckResult = namedtuple("CheckResult", ["name", "passed", "detail"])


def check_row_count(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    if len(src) == len(dst):
        return CheckResult("Row count", True, f"{len(src)} rows")
    return CheckResult("Row count", False, f"Source: {len(src)}, Output: {len(dst)}")


def check_crs_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    if str(src.crs) == str(dst.crs):
        return CheckResult("CRS preserved", True, f"{src.crs}")
    return CheckResult("CRS preserved", False, f"Source: {src.crs}, Output: {dst.crs}")


def check_columns_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    src_cols = set(src.columns)
    dst_cols = set(dst.columns)
    if src_cols == dst_cols:
        return CheckResult("Columns preserved", True, f"{len(src_cols)} columns")
    missing = src_cols - dst_cols
    extra = dst_cols - src_cols
    detail = ""
    if missing:
        detail += f"Missing: {missing}. "
    if extra:
        detail += f"Extra: {extra}."
    return CheckResult("Columns preserved", False, detail)


def check_geometry_type(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    src_types = set(src.geometry.geom_type)
    dst_types = set(dst.geometry.geom_type)
    if src_types == dst_types:
        return CheckResult("Geometry type", True, f"{src_types}")
    return CheckResult("Geometry type", False, f"Source: {src_types}, Output: {dst_types}")


def check_geometry_validity(gdf: gpd.GeoDataFrame) -> CheckResult:
    invalid = ~gdf.geometry.is_valid
    if not invalid.any():
        return CheckResult("Geometry validity", True, "All valid")
    n_invalid = invalid.sum()
    return CheckResult("Geometry validity", False, f"{n_invalid} invalid geometries")


def check_geometry_fidelity(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame,
                             n: int = 100) -> CheckResult:
    rng = np.random.default_rng(42)
    sample_size = min(n, len(src))
    indices = rng.choice(len(src), size=sample_size, replace=False)

    for idx in indices:
        src_wkt = src.geometry.iloc[idx].wkt
        dst_wkt = dst.geometry.iloc[idx].wkt
        if src_wkt != dst_wkt:
            return CheckResult("Geometry fidelity", False,
                               f"Row {idx}: geometries differ")
    return CheckResult("Geometry fidelity", True, f"{sample_size} geometries compared, all match")


def check_attribute_fidelity(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame,
                              n: int = 100) -> CheckResult:
    rng = np.random.default_rng(42)
    sample_size = min(n, len(src))
    indices = rng.choice(len(src), size=sample_size, replace=False)
    non_geom_cols = [c for c in src.columns if c != src.geometry.name]

    for idx in indices:
        for col in non_geom_cols:
            src_val = src[col].iloc[idx]
            dst_val = dst[col].iloc[idx]
            # Handle NaN comparison
            if isinstance(src_val, float) and isinstance(dst_val, float):
                if np.isnan(src_val) and np.isnan(dst_val):
                    continue
            if src_val != dst_val:
                return CheckResult("Attribute fidelity", False,
                                   f"Row {idx}, col '{col}': source={src_val}, output={dst_val}")
    return CheckResult("Attribute fidelity", True,
                       f"{sample_size} rows compared, all match")


def check_bounds_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame,
                        tolerance: float = 1e-8) -> CheckResult:
    src_bounds = src.total_bounds
    dst_bounds = dst.total_bounds
    max_diff = np.max(np.abs(src_bounds - dst_bounds))
    if max_diff <= tolerance:
        return CheckResult("Bounds preserved", True,
                           f"Max diff: {max_diff:.2e}")
    return CheckResult("Bounds preserved", False,
                       f"Max diff: {max_diff:.2e} exceeds {tolerance}")


def check_geoparquet_metadata(output_path: str) -> CheckResult:
    pf = pq.read_metadata(output_path)
    metadata = pf.schema.to_arrow_schema().metadata
    if metadata and b"geo" in metadata:
        geo_meta = json.loads(metadata[b"geo"])
        if "primary_column" in geo_meta and "columns" in geo_meta:
            return CheckResult("GeoParquet metadata", True, "Valid geo metadata")
        return CheckResult("GeoParquet metadata", False,
                           "geo key present but missing required fields")
    return CheckResult("GeoParquet metadata", False, "No 'geo' key in parquet metadata")


def print_report(results: list[CheckResult]) -> bool:
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


def generate_synthetic_shapefile(directory: str) -> str:
    """Generate a synthetic Shapefile for self-testing. Returns path to .shp."""
    gdf = gpd.GeoDataFrame({
        "name": [f"feature_{i}" for i in range(50)],
        "value": np.random.default_rng(42).standard_normal(50),
        "category": [f"cat_{i % 5}" for i in range(50)],
        "geometry": [Point(i * 0.1, i * 0.05) for i in range(50)],
    }, crs="EPSG:4326")

    shp_path = os.path.join(directory, "test_input.shp")
    gdf.to_file(shp_path)
    return shp_path


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
        print("Generating synthetic Shapefile...")
        input_path = generate_synthetic_shapefile(tmpdir)
        output_path = os.path.join(tmpdir, "test_output.parquet")

        print("Converting to GeoParquet...")
        convert_mod.convert(input_path, output_path, verbose=True)

        print("Validating...")
        return run_validation(input_path, output_path)


def run_validation(input_path: str, output_path: str) -> bool:
    """Run all validation checks and print report."""
    src = gpd.read_file(input_path)
    dst = gpd.read_parquet(output_path)

    results = [
        check_row_count(src, dst),
        check_crs_match(src, dst),
        check_columns_match(src, dst),
        check_geometry_type(src, dst),
        check_geometry_validity(dst),
        check_geometry_fidelity(src, dst),
        check_attribute_fidelity(src, dst),
        check_bounds_match(src, dst),
        check_geoparquet_metadata(output_path),
    ]
    return print_report(results)


def main():
    parser = argparse.ArgumentParser(description="Validate GeoParquet against source Shapefile")
    parser.add_argument("--input", help="Path to original Shapefile (omit for self-test)")
    parser.add_argument("--output", help="Path to converted GeoParquet (omit for self-test)")
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py
git commit -m "feat: add shapefile-to-geoparquet validate.py with self-test"
```

---

### Task 9: shapefile-to-geoparquet ralph-loop validation

- [ ] **Step 1: Install dependencies**

```bash
pip install geopandas pyarrow shapely
```

- [ ] **Step 2: Run self-test**

```bash
cd skills/geo-conversions/shapefile-to-geoparquet
python scripts/validate.py
```

Expected: All 9 checks pass, exit code 0.

- [ ] **Step 3: If any checks fail, fix and re-run**

Use the ralph-loop plugin to iterate: fix scripts, update SKILL.md changelog, re-run until all checks pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add skills/geo-conversions/shapefile-to-geoparquet/
git commit -m "fix: shapefile-to-geoparquet validation fixes from ralph-loop"
```

---

### Task 10: geojson-to-geoparquet SKILL.md

**Files:**
- Create: `skills/geo-conversions/geojson-to-geoparquet/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Create `skills/geo-conversions/geojson-to-geoparquet/SKILL.md`:

```markdown
# Skill: GeoJSON to GeoParquet

## When to use

When you have a GeoJSON file and need to convert it to GeoParquet for efficient columnar storage, smaller file sizes, and cloud-native access.

## Prerequisites

- Python 3.10+
- `pip install geopandas pyarrow shapely`

## Scripts

| File | Purpose |
|------|---------|
| [`scripts/convert.py`](scripts/convert.py) | Convert a GeoJSON file to GeoParquet |
| [`scripts/validate.py`](scripts/validate.py) | Validate that GeoParquet preserves all data from the source GeoJSON |

## Quickstart

    pip install geopandas pyarrow shapely
    python scripts/convert.py --input data.geojson --output data.parquet
    python scripts/validate.py --input data.geojson --output data.parquet

## CLI flags

### convert.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | Yes | — | Path to input .geojson or .json file |
| `--output` | Yes | — | Path for output .parquet file |
| `--overwrite` | No | False | Overwrite output if it exists |
| `--verbose` | No | False | Print detailed progress |

### validate.py

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | No | — | Path to original GeoJSON (omit for self-test) |
| `--output` | No | — | Path to converted GeoParquet (omit for self-test) |

When both `--input` and `--output` are omitted, runs a self-test that generates synthetic data, converts it, and validates the result.

## Known failure modes

_Populated during development._

## Changelog

_Updated during development._
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/geojson-to-geoparquet/SKILL.md
git commit -m "feat: add geojson-to-geoparquet SKILL.md"
```

---

### Task 11: geojson-to-geoparquet convert.py

**Files:**
- Create: `skills/geo-conversions/geojson-to-geoparquet/scripts/convert.py`

- [ ] **Step 1: Write convert.py**

Create `skills/geo-conversions/geojson-to-geoparquet/scripts/convert.py`:

```python
"""Convert a GeoJSON file to GeoParquet."""

import argparse
import os
import sys

_REQUIRED = {"geopandas": "geopandas", "pyarrow": "pyarrow", "shapely": "shapely"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)}")
    sys.exit(1)

import geopandas as gpd


def convert(input_path: str, output_path: str, verbose: bool = False):
    """Convert a GeoJSON file to GeoParquet."""
    if verbose:
        print(f"Reading GeoJSON: {input_path}")

    gdf = gpd.read_file(input_path)

    if verbose:
        print(f"  {len(gdf)} features, {len(gdf.columns)} columns")
        print(f"  CRS: {gdf.crs}")
        print(f"  Geometry type(s): {gdf.geometry.geom_type.unique().tolist()}")
        print(f"Writing GeoParquet: {output_path}")

    gdf.to_parquet(output_path)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path} ({size_mb:.2f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Convert a GeoJSON file to GeoParquet")
    parser.add_argument("--input", required=True, help="Path to input .geojson or .json file")
    parser.add_argument("--output", required=True, help="Path for output .parquet file")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output if it exists")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext not in (".geojson", ".json"):
        print(f"Error: expected a .geojson or .json file, got '{ext}'")
        sys.exit(1)

    if os.path.exists(args.output) and not args.overwrite:
        print(f"Error: output file already exists: {args.output}")
        print("Use --overwrite to replace it.")
        sys.exit(1)

    convert(args.input, args.output, verbose=args.verbose)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/geojson-to-geoparquet/scripts/convert.py
git commit -m "feat: add geojson-to-geoparquet convert.py"
```

---

### Task 12: geojson-to-geoparquet validate.py

**Files:**
- Create: `skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py`

- [ ] **Step 1: Write validate.py**

Create `skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py`:

```python
"""Validate that GeoParquet preserves all data from a source GeoJSON file."""

import argparse
import json
import os
import sys
import tempfile
from collections import namedtuple

_REQUIRED = {"geopandas": "geopandas", "pyarrow": "pyarrow", "shapely": "shapely", "numpy": "numpy"}
_missing = []
for _mod, _pkg in _REQUIRED.items():
    try:
        __import__(_mod)
    except ImportError:
        _missing.append(_pkg)
if _missing:
    print(f"Missing dependencies: {', '.join(_missing)}")
    print(f"Install with: pip install {' '.join(_missing)}")
    sys.exit(1)

import geopandas as gpd
import numpy as np
import pyarrow.parquet as pq

CheckResult = namedtuple("CheckResult", ["name", "passed", "detail"])


def check_row_count(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    if len(src) == len(dst):
        return CheckResult("Row count", True, f"{len(src)} rows")
    return CheckResult("Row count", False, f"Source: {len(src)}, Output: {len(dst)}")


def check_crs_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    if str(src.crs) == str(dst.crs):
        return CheckResult("CRS preserved", True, f"{src.crs}")
    return CheckResult("CRS preserved", False, f"Source: {src.crs}, Output: {dst.crs}")


def check_columns_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    src_cols = set(src.columns)
    dst_cols = set(dst.columns)
    if src_cols == dst_cols:
        return CheckResult("Columns preserved", True, f"{len(src_cols)} columns")
    missing = src_cols - dst_cols
    extra = dst_cols - src_cols
    detail = ""
    if missing:
        detail += f"Missing: {missing}. "
    if extra:
        detail += f"Extra: {extra}."
    return CheckResult("Columns preserved", False, detail)


def check_geometry_type(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame) -> CheckResult:
    src_types = set(src.geometry.geom_type)
    dst_types = set(dst.geometry.geom_type)
    if src_types == dst_types:
        return CheckResult("Geometry type", True, f"{src_types}")
    return CheckResult("Geometry type", False, f"Source: {src_types}, Output: {dst_types}")


def check_geometry_validity(gdf: gpd.GeoDataFrame) -> CheckResult:
    invalid = ~gdf.geometry.is_valid
    if not invalid.any():
        return CheckResult("Geometry validity", True, "All valid")
    n_invalid = invalid.sum()
    return CheckResult("Geometry validity", False, f"{n_invalid} invalid geometries")


def check_geometry_fidelity(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame,
                             n: int = 100) -> CheckResult:
    rng = np.random.default_rng(42)
    sample_size = min(n, len(src))
    indices = rng.choice(len(src), size=sample_size, replace=False)

    for idx in indices:
        src_wkt = src.geometry.iloc[idx].wkt
        dst_wkt = dst.geometry.iloc[idx].wkt
        if src_wkt != dst_wkt:
            return CheckResult("Geometry fidelity", False,
                               f"Row {idx}: geometries differ")
    return CheckResult("Geometry fidelity", True, f"{sample_size} geometries compared, all match")


def check_attribute_fidelity(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame,
                              n: int = 100) -> CheckResult:
    rng = np.random.default_rng(42)
    sample_size = min(n, len(src))
    indices = rng.choice(len(src), size=sample_size, replace=False)
    non_geom_cols = [c for c in src.columns if c != src.geometry.name]

    for idx in indices:
        for col in non_geom_cols:
            src_val = src[col].iloc[idx]
            dst_val = dst[col].iloc[idx]
            if isinstance(src_val, float) and isinstance(dst_val, float):
                if np.isnan(src_val) and np.isnan(dst_val):
                    continue
            if src_val != dst_val:
                return CheckResult("Attribute fidelity", False,
                                   f"Row {idx}, col '{col}': source={src_val}, output={dst_val}")
    return CheckResult("Attribute fidelity", True,
                       f"{sample_size} rows compared, all match")


def check_bounds_match(src: gpd.GeoDataFrame, dst: gpd.GeoDataFrame,
                        tolerance: float = 1e-8) -> CheckResult:
    src_bounds = src.total_bounds
    dst_bounds = dst.total_bounds
    max_diff = np.max(np.abs(src_bounds - dst_bounds))
    if max_diff <= tolerance:
        return CheckResult("Bounds preserved", True,
                           f"Max diff: {max_diff:.2e}")
    return CheckResult("Bounds preserved", False,
                       f"Max diff: {max_diff:.2e} exceeds {tolerance}")


def check_geoparquet_metadata(output_path: str) -> CheckResult:
    pf = pq.read_metadata(output_path)
    metadata = pf.schema.to_arrow_schema().metadata
    if metadata and b"geo" in metadata:
        geo_meta = json.loads(metadata[b"geo"])
        if "primary_column" in geo_meta and "columns" in geo_meta:
            return CheckResult("GeoParquet metadata", True, "Valid geo metadata")
        return CheckResult("GeoParquet metadata", False,
                           "geo key present but missing required fields")
    return CheckResult("GeoParquet metadata", False, "No 'geo' key in parquet metadata")


def print_report(results: list[CheckResult]) -> bool:
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


def generate_synthetic_geojson(path: str):
    """Generate a synthetic GeoJSON file with polygons for self-testing."""
    rng = np.random.default_rng(42)
    features = []
    for i in range(50):
        x, y = rng.uniform(-180, 180), rng.uniform(-90, 90)
        size = 0.1
        coords = [
            [x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]
        ]
        features.append({
            "type": "Feature",
            "properties": {
                "id": i,
                "name": f"polygon_{i}",
                "area_km2": float(rng.uniform(1, 1000)),
                "category": f"type_{i % 4}",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords],
            },
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    with open(path, "w") as f:
        json.dump(geojson, f)


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
        input_path = os.path.join(tmpdir, "test_input.geojson")
        output_path = os.path.join(tmpdir, "test_output.parquet")

        print("Generating synthetic GeoJSON...")
        generate_synthetic_geojson(input_path)

        print("Converting to GeoParquet...")
        convert_mod.convert(input_path, output_path, verbose=True)

        print("Validating...")
        return run_validation(input_path, output_path)


def run_validation(input_path: str, output_path: str) -> bool:
    """Run all validation checks and print report."""
    src = gpd.read_file(input_path)
    dst = gpd.read_parquet(output_path)

    results = [
        check_row_count(src, dst),
        check_crs_match(src, dst),
        check_columns_match(src, dst),
        check_geometry_type(src, dst),
        check_geometry_validity(dst),
        check_geometry_fidelity(src, dst),
        check_attribute_fidelity(src, dst),
        check_bounds_match(src, dst),
        check_geoparquet_metadata(output_path),
    ]
    return print_report(results)


def main():
    parser = argparse.ArgumentParser(description="Validate GeoParquet against source GeoJSON")
    parser.add_argument("--input", help="Path to original GeoJSON (omit for self-test)")
    parser.add_argument("--output", help="Path to converted GeoParquet (omit for self-test)")
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py
git commit -m "feat: add geojson-to-geoparquet validate.py with self-test"
```

---

### Task 13: geojson-to-geoparquet ralph-loop validation

- [ ] **Step 1: Install dependencies (if not already installed from Task 9)**

```bash
pip install geopandas pyarrow shapely numpy
```

- [ ] **Step 2: Run self-test**

```bash
cd skills/geo-conversions/geojson-to-geoparquet
python scripts/validate.py
```

Expected: All 9 checks pass, exit code 0.

- [ ] **Step 3: If any checks fail, fix and re-run**

Fix the failing script(s), update SKILL.md changelog with what was learned, and re-run `python scripts/validate.py` until all checks pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add skills/geo-conversions/geojson-to-geoparquet/
git commit -m "fix: geojson-to-geoparquet validation fixes from ralph-loop"
```

---

### Task 14: Update skills/README.md

**Files:**
- Modify: `skills/README.md`

- [ ] **Step 1: Add Data conversion section**

Add the following section to `skills/README.md` after the "Testing" section:

```markdown

---

## Data conversion

| Skill | Description |
|-------|-------------|
| `geotiff-to-cog` | Convert a GeoTIFF to a Cloud-Optimized GeoTIFF with validation |
| `shapefile-to-geoparquet` | Convert a Shapefile to GeoParquet with validation |
| `geojson-to-geoparquet` | Convert a GeoJSON file to GeoParquet with validation |
```

- [ ] **Step 2: Commit**

```bash
git add skills/README.md
git commit -m "docs: add data conversion skills to skills README"
```
