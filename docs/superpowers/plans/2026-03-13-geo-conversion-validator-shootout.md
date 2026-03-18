# Geo Conversion Validator Shootout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run real-world geospatial files through multiple conversion tools and grade each tool's output with our validators to prove they catch real silent failures.

**Architecture:** A `docs/shootout/` directory with thin converter wrappers (one per tool), a single runner script that loops `(file × tool)` pairs, calls our existing validators programmatically, and renders markdown result matrices. Validators are minimally refactored to expose a `run_checks()` function returning structured data.

**Tech Stack:** Python 3.12, rasterio, rio-cogeo, geopandas, pyarrow, GDAL CLI, gpq binary, DuckDB

**Spec:** `docs/superpowers/specs/2026-03-13-geo-conversion-validator-shootout-design.md`

---

## Chunk 1: Foundation — Directory, Base Module, Validator Refactoring

### Task 1: Create directory structure and base module

**Files:**
- Create: `docs/shootout/converters/__init__.py`
- Create: `docs/shootout/converters/base.py`
- Create: `docs/shootout/.gitignore`

- [ ] **Step 1: Create directories**

```bash
mkdir -p docs/shootout/converters
mkdir -p docs/shootout/data
mkdir -p docs/shootout/results/raw/outputs
```

- [ ] **Step 2: Create .gitignore**

Create `docs/shootout/.gitignore`:

```
data/
results/raw/outputs/
```

- [ ] **Step 3: Write base.py with ConverterResult dataclass**

Create `docs/shootout/converters/base.py`:

```python
"""Shared types for converter wrappers."""

import dataclasses
import shutil
import subprocess
import time
from pathlib import Path


@dataclasses.dataclass
class ConverterResult:
    tool: str
    status: str  # "success", "error", "skipped"
    error_message: str | None
    duration_seconds: float


def run_cli(tool_name: str, cmd: list[str], output_path: Path,
            timeout: int = 300) -> ConverterResult:
    """Run a CLI conversion command and return a ConverterResult."""
    start = time.monotonic()
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout
        )
        elapsed = time.monotonic() - start
        if result.returncode != 0:
            return ConverterResult(
                tool=tool_name, status="error",
                error_message=result.stderr.strip() or result.stdout.strip(),
                duration_seconds=elapsed,
            )
        if not output_path.exists():
            return ConverterResult(
                tool=tool_name, status="error",
                error_message="Command succeeded but output file not found",
                duration_seconds=elapsed,
            )
        return ConverterResult(
            tool=tool_name, status="success",
            error_message=None, duration_seconds=elapsed,
        )
    except FileNotFoundError:
        return ConverterResult(
            tool=tool_name, status="skipped",
            error_message=f"{cmd[0]!r} not found on PATH",
            duration_seconds=0.0,
        )
    except subprocess.TimeoutExpired:
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=tool_name, status="error",
            error_message=f"Timed out after {timeout}s",
            duration_seconds=elapsed,
        )


def check_tool_available(name: str) -> bool:
    """Check if a CLI tool is available on PATH."""
    return shutil.which(name) is not None
```

- [ ] **Step 4: Create empty __init__.py**

Create `docs/shootout/converters/__init__.py` (empty file).

- [ ] **Step 5: Commit**

```bash
git add docs/shootout/
git commit -m "feat(shootout): add directory structure and base converter module"
```

### Task 2: Refactor raster validator to expose run_checks()

**Files:**
- Modify: `skills/geo-conversions/geotiff-to-cog/scripts/validate.py`

The raster validator's check functions already accept file path strings, so this is straightforward.

- [ ] **Step 1: Replace namedtuple with dataclass and add run_checks()**

In `skills/geo-conversions/geotiff-to-cog/scripts/validate.py`:

Replace the `CheckResult` namedtuple (line 31):

```python
CheckResult = namedtuple("CheckResult", ["name", "passed", "detail"])
```

With a dataclass:

```python
@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str
```

Add `import dataclasses` to the imports at the top (after `from collections import namedtuple` — also remove the namedtuple import since it's no longer used).

Then add `run_checks()` right before the existing `run_validation()` function (before line 205):

```python
def run_checks(input_path: str, output_path: str) -> list[CheckResult]:
    """Run all validation checks and return structured results."""
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
```

Then simplify `run_validation()` to use it:

```python
def run_validation(input_path: str, output_path: str) -> bool:
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path)
    return print_report(results)
```

- [ ] **Step 2: Verify the self-test still works**

```bash
cd skills/geo-conversions/geotiff-to-cog && python scripts/validate.py
```

Expected: Self-test runs, all 8 checks PASS.

- [ ] **Step 3: Commit**

```bash
git add skills/geo-conversions/geotiff-to-cog/scripts/validate.py
git commit -m "refactor(validate): expose run_checks() in raster validator"
```

### Task 3: Refactor shapefile validator to expose run_checks()

**Files:**
- Modify: `skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py`

The vector validator's check functions accept GeoDataFrames, so `run_checks()` must load the data internally.

- [ ] **Step 1: Replace namedtuple with dataclass and add run_checks()**

In `skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py`:

Replace the `CheckResult` namedtuple (line 26):

```python
CheckResult = namedtuple("CheckResult", ["name", "passed", "detail"])
```

With:

```python
@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str
```

Add `import dataclasses` to the imports, remove `from collections import namedtuple`.

Add `run_checks()` right before `run_validation()` (before line 206):

```python
def run_checks(input_path: str, output_path: str) -> list[CheckResult]:
    """Run all validation checks and return structured results."""
    src = gpd.read_file(input_path)
    dst = gpd.read_parquet(output_path)
    return [
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
```

Simplify `run_validation()`:

```python
def run_validation(input_path, output_path):
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path)
    return print_report(results)
```

- [ ] **Step 2: Verify self-test still works**

```bash
cd skills/geo-conversions/shapefile-to-geoparquet && python scripts/validate.py
```

Expected: Self-test runs, all 9 checks PASS.

- [ ] **Step 3: Commit**

```bash
git add skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py
git commit -m "refactor(validate): expose run_checks() in shapefile validator"
```

### Task 4: Refactor GeoJSON validator to expose run_checks()

**Files:**
- Modify: `skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py`

- [ ] **Step 1: Replace namedtuple with dataclass and add run_checks()**

In `skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py`:

Replace the `CheckResult` namedtuple (line 26):

```python
CheckResult = namedtuple("CheckResult", ["name", "passed", "detail"])
```

With:

```python
@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str
```

Add `import dataclasses` to the imports, remove `from collections import namedtuple`.

Add `run_checks()` right before `run_validation()` (before line 225):

```python
def run_checks(input_path: str, output_path: str) -> list[CheckResult]:
    """Run all validation checks and return structured results."""
    src = gpd.read_file(input_path)
    dst = gpd.read_parquet(output_path)
    return [
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
```

Simplify `run_validation()`:

```python
def run_validation(input_path, output_path):
    """Run all validation checks and print report."""
    results = run_checks(input_path, output_path)
    return print_report(results)
```

- [ ] **Step 2: Verify self-test still works**

```bash
cd skills/geo-conversions/geojson-to-geoparquet && python scripts/validate.py
```

Expected: Self-test runs, all 9 checks PASS.

- [ ] **Step 3: Commit**

```bash
git add skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py
git commit -m "refactor(validate): expose run_checks() in geojson validator"
```

---

## Chunk 2: Raster Converter Wrappers

### Task 5: rio-cogeo converter (our baseline)

**Files:**
- Create: `docs/shootout/converters/raster_rio_cogeo.py`

- [ ] **Step 1: Write the converter**

```python
"""Convert GeoTIFF to COG using rio-cogeo (our baseline)."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "rio-cogeo"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "rio", "cogeo", "create",
        str(input_path), str(output_path),
        "--overview-level", "6",
        "--blocksize", "512",
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/raster_rio_cogeo.py
git commit -m "feat(shootout): add rio-cogeo converter wrapper"
```

### Task 6: GDAL converter

**Files:**
- Create: `docs/shootout/converters/raster_gdal.py`

- [ ] **Step 1: Write the converter**

```python
"""Convert GeoTIFF to COG using gdal_translate."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "gdal"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "gdal_translate", "-of", "COG",
        "-co", "COMPRESS=DEFLATE",
        "-co", "BLOCKSIZE=512",
        "-co", "OVERVIEW_COUNT=6",
        str(input_path), str(output_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/raster_gdal.py
git commit -m "feat(shootout): add GDAL raster converter wrapper"
```

### Task 7: Raw rasterio converter (known-bad)

**Files:**
- Create: `docs/shootout/converters/raster_rasterio_raw.py`

- [ ] **Step 1: Write the converter**

This one is Python-native (no CLI), so it uses a try/except pattern instead of `run_cli`.

```python
"""Convert GeoTIFF to tiled TIFF using raw rasterio (known to fail COG validation)."""

import time
from pathlib import Path

from .base import ConverterResult

TOOL_NAME = "rasterio-raw"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    try:
        import rasterio
        from rasterio.enums import Resampling
    except ImportError:
        return ConverterResult(
            tool=TOOL_NAME, status="skipped",
            error_message="rasterio not installed",
            duration_seconds=0.0,
        )

    start = time.monotonic()
    try:
        with rasterio.open(input_path) as src:
            profile = src.profile.copy()
            profile.update(
                driver="GTiff",
                tiled=True,
                blockxsize=512,
                blockysize=512,
                compress="deflate",
            )
            with rasterio.open(output_path, "w", **profile) as dst:
                for band_idx in range(1, src.count + 1):
                    data = src.read(band_idx)
                    dst.write(data, band_idx)

                dst.build_overviews(
                    [2, 4, 8, 16, 32, 64],
                    Resampling.nearest,
                )
                dst.update_tags(ns="rio_overview", resampling="nearest")

        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="success",
            error_message=None, duration_seconds=elapsed,
        )
    except Exception as e:
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="error",
            error_message=str(e), duration_seconds=elapsed,
        )
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/raster_rasterio_raw.py
git commit -m "feat(shootout): add raw rasterio converter wrapper (known-bad)"
```

### Task 8: cogger converter (best-effort)

**Files:**
- Create: `docs/shootout/converters/raster_cogger.py`

- [ ] **Step 1: Write the converter**

```python
"""Convert GeoTIFF to COG using cogger (Rust-based, best-effort)."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "cogger"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "cogger", "translate",
        str(input_path), str(output_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/raster_cogger.py
git commit -m "feat(shootout): add cogger converter wrapper (best-effort)"
```

---

## Chunk 3: Vector Converter Wrappers

### Task 9: geopandas converter (our baseline)

**Files:**
- Create: `docs/shootout/converters/vector_geopandas.py`

- [ ] **Step 1: Write the converter**

```python
"""Convert Shapefile/GeoJSON to GeoParquet using geopandas (our baseline)."""

import time
from pathlib import Path

from .base import ConverterResult

TOOL_NAME = "geopandas"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    try:
        import geopandas as gpd
    except ImportError:
        return ConverterResult(
            tool=TOOL_NAME, status="skipped",
            error_message="geopandas not installed",
            duration_seconds=0.0,
        )

    start = time.monotonic()
    try:
        gdf = gpd.read_file(input_path)
        gdf.to_parquet(output_path)
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="success",
            error_message=None, duration_seconds=elapsed,
        )
    except Exception as e:
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="error",
            error_message=str(e), duration_seconds=elapsed,
        )
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/vector_geopandas.py
git commit -m "feat(shootout): add geopandas vector converter wrapper"
```

### Task 10: gpq converter (GeoJSON only)

**Files:**
- Create: `docs/shootout/converters/vector_gpq.py`

- [ ] **Step 1: Write the converter**

```python
"""Convert GeoJSON to GeoParquet using gpq (GeoJSON only, not Shapefile)."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "gpq"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "gpq", "convert",
        str(input_path), str(output_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/vector_gpq.py
git commit -m "feat(shootout): add gpq vector converter wrapper (GeoJSON only)"
```

### Task 11: ogr2ogr converter

**Files:**
- Create: `docs/shootout/converters/vector_ogr2ogr.py`

- [ ] **Step 1: Write the converter**

```python
"""Convert Shapefile/GeoJSON to GeoParquet using ogr2ogr."""

from pathlib import Path

from .base import ConverterResult, run_cli

TOOL_NAME = "ogr2ogr"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    cmd = [
        "ogr2ogr", "-f", "Parquet",
        str(output_path), str(input_path),
    ]
    return run_cli(TOOL_NAME, cmd, output_path)
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/vector_ogr2ogr.py
git commit -m "feat(shootout): add ogr2ogr vector converter wrapper"
```

### Task 12: DuckDB converter

**Files:**
- Create: `docs/shootout/converters/vector_duckdb.py`

- [ ] **Step 1: Write the converter**

```python
"""Convert Shapefile/GeoJSON to GeoParquet using DuckDB spatial extension."""

import time
from pathlib import Path

from .base import ConverterResult

TOOL_NAME = "duckdb"


def convert(input_path: Path, output_path: Path) -> ConverterResult:
    try:
        import duckdb
    except ImportError:
        return ConverterResult(
            tool=TOOL_NAME, status="skipped",
            error_message="duckdb not installed",
            duration_seconds=0.0,
        )

    start = time.monotonic()
    try:
        con = duckdb.connect()
        con.execute("INSTALL spatial; LOAD spatial;")
        escaped_in = str(input_path).replace("'", "''")
        escaped_out = str(output_path).replace("'", "''")
        con.execute(f"""
            COPY (
                SELECT * FROM ST_Read('{escaped_in}')
            ) TO '{escaped_out}' (FORMAT PARQUET);
        """)
        con.close()
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="success",
            error_message=None, duration_seconds=elapsed,
        )
    except Exception as e:
        elapsed = time.monotonic() - start
        return ConverterResult(
            tool=TOOL_NAME, status="error",
            error_message=str(e), duration_seconds=elapsed,
        )
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/converters/vector_duckdb.py
git commit -m "feat(shootout): add DuckDB vector converter wrapper"
```

---

## Chunk 4: Test Data Acquisition

### Task 13: Write data download module

**Files:**
- Create: `docs/shootout/acquire_data.py`

This module downloads and caches test files. It is called by `run_shootout.py` as Phase 1.

- [ ] **Step 1: Write acquire_data.py**

```python
"""Download and cache test data for the shootout."""

import io
import urllib.request
import zipfile
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

DOWNLOADS = {
    "ne_color": {
        "url": "https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR.zip",
        "type": "zip",
        "glob": "*.tif",
    },
    "neo_sst": {
        "url": "https://neo.gsfc.nasa.gov/archive/geotiff/MWOI_SST_M/MWOI_SST_M_2024-01.TIFF",
        "type": "file",
        "filename": "MWOI_SST_M_2024-01.tif",
    },
    "ne_gray": {
        "url": "https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip",
        "type": "zip",
        "glob": "*.tif",
    },
    "ne_countries_shp": {
        "url": "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip",
        "type": "zip",
        "glob": "*.shp",
    },
    "ne_countries_geojson": {
        "url": "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson",
        "type": "file",
        "filename": "ne_50m_admin_0_countries.geojson",
    },
    "ne_rivers_geojson": {
        "url": "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_rivers_lake_centerlines.geojson",
        "type": "file",
        "filename": "ne_50m_rivers_lake_centerlines.geojson",
    },
}


_HEADERS = {"User-Agent": "geo-shootout/1.0"}


def download_file(url: str, dest: Path):
    """Download a URL to a local file."""
    print(f"  Downloading {url}...")
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
        f.write(resp.read())
    print(f"  Saved to {dest} ({dest.stat().st_size / 1024 / 1024:.1f} MB)")


def download_and_extract_zip(url: str, dest_dir: Path, glob_pattern: str) -> Path | None:
    """Download a ZIP, extract, and return path matching glob."""
    print(f"  Downloading {url}...")
    req = urllib.request.Request(url, headers=_HEADERS)
    data = urllib.request.urlopen(req).read()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        zf.extractall(dest_dir)
    matches = list(dest_dir.rglob(glob_pattern))
    return matches[0] if matches else None


def acquire_all() -> dict[str, Path | None]:
    """Download all test files, returning name -> path mapping."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    results = {}

    for name, spec in DOWNLOADS.items():
        dest_dir = DATA_DIR / name
        dest_dir.mkdir(exist_ok=True)

        if spec["type"] == "file":
            dest = dest_dir / spec["filename"]
            if dest.exists():
                print(f"  [{name}] cached: {dest}")
                results[name] = dest
            else:
                try:
                    download_file(spec["url"], dest)
                    results[name] = dest
                except Exception as e:
                    print(f"  [{name}] FAILED: {e}")
                    results[name] = None
        elif spec["type"] == "zip":
            existing = list(dest_dir.rglob(spec["glob"]))
            if existing:
                print(f"  [{name}] cached: {existing[0]}")
                results[name] = existing[0]
            else:
                try:
                    path = download_and_extract_zip(spec["url"], dest_dir, spec["glob"])
                    results[name] = path
                except Exception as e:
                    print(f"  [{name}] FAILED: {e}")
                    results[name] = None

    return results


if __name__ == "__main__":
    acquire_all()
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/acquire_data.py
git commit -m "feat(shootout): add test data download and caching module"
```

---

## Chunk 5: Runner and Report Rendering

### Task 14: Write run_shootout.py

**Files:**
- Create: `docs/shootout/run_shootout.py`

This is the single entry point. It runs all three phases: acquire data, run conversions+validation, render markdown.

- [ ] **Step 1: Write run_shootout.py**

```python
"""Geo Conversion Validator Shootout — run all conversions and validations."""

import dataclasses
import importlib.util
import json
import sys
from pathlib import Path

# Ensure imports work regardless of cwd
sys.path.insert(0, str(Path(__file__).resolve().parent))

from converters import (
    raster_rio_cogeo,
    raster_gdal,
    raster_rasterio_raw,
    raster_cogger,
    vector_geopandas,
    vector_gpq,
    vector_ogr2ogr,
    vector_duckdb,
)
import acquire_data

# --- Paths ---

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SHOOTOUT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = SHOOTOUT_DIR / "results"
RAW_DIR = RESULTS_DIR / "raw"
OUTPUTS_DIR = RAW_DIR / "outputs"

RASTER_VALIDATOR = REPO_ROOT / "skills/geo-conversions/geotiff-to-cog/scripts/validate.py"
SHAPEFILE_VALIDATOR = REPO_ROOT / "skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py"
GEOJSON_VALIDATOR = REPO_ROOT / "skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py"

# --- Local test data (already in repo) ---

FIRMS_SHP = REPO_ROOT / "docs/geo-conversion-test-results/test-2-real-data/firms_shp/SUOMI_VIIRS_C2_Global_24h.shp"
HYDRORIVERS_SHP = REPO_ROOT / "HydroRIVERS_v10_gr_shp/HydroRIVERS_v10_gr_shp/HydroRIVERS_v10_gr.shp"
EARTHQUAKES_GEOJSON = REPO_ROOT / "docs/geo-conversion-test-results/test-2-real-data/earthquakes.geojson"


def load_validator(validator_path: Path):
    """Dynamically import a validate.py module."""
    spec = importlib.util.spec_from_file_location("validator", validator_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def build_test_registry(downloaded: dict[str, Path | None]) -> tuple[list, list]:
    """Build the raster and vector test registries from available data."""
    raster_converters = [raster_rio_cogeo, raster_gdal, raster_rasterio_raw, raster_cogger]
    shapefile_converters = [vector_geopandas, vector_ogr2ogr, vector_duckdb]
    geojson_converters = [vector_geopandas, vector_gpq, vector_ogr2ogr, vector_duckdb]

    raster_tests = []
    if downloaded.get("ne_color"):
        raster_tests.append({"name": "ne_color", "path": downloaded["ne_color"],
                             "converters": raster_converters})
    if downloaded.get("neo_sst"):
        raster_tests.append({"name": "neo_sst", "path": downloaded["neo_sst"],
                             "converters": raster_converters})
    if downloaded.get("ne_gray"):
        raster_tests.append({"name": "ne_gray", "path": downloaded["ne_gray"],
                             "converters": raster_converters})

    vector_tests = []
    if FIRMS_SHP.exists():
        vector_tests.append({"name": "firms", "format": "shapefile",
                             "path": FIRMS_SHP, "converters": shapefile_converters})
    if HYDRORIVERS_SHP.exists():
        vector_tests.append({"name": "hydrorivers", "format": "shapefile",
                             "path": HYDRORIVERS_SHP, "converters": shapefile_converters})
    if downloaded.get("ne_countries_shp"):
        vector_tests.append({"name": "ne_countries_shp", "format": "shapefile",
                             "path": downloaded["ne_countries_shp"],
                             "converters": shapefile_converters})
    if EARTHQUAKES_GEOJSON.exists():
        vector_tests.append({"name": "earthquakes", "format": "geojson",
                             "path": EARTHQUAKES_GEOJSON, "converters": geojson_converters})
    if downloaded.get("ne_countries_geojson"):
        vector_tests.append({"name": "ne_countries_geojson", "format": "geojson",
                             "path": downloaded["ne_countries_geojson"],
                             "converters": geojson_converters})
    if downloaded.get("ne_rivers_geojson"):
        vector_tests.append({"name": "ne_rivers_geojson", "format": "geojson",
                             "path": downloaded["ne_rivers_geojson"],
                             "converters": geojson_converters})

    return raster_tests, vector_tests


def run_single(test_name: str, input_path: Path, converter_mod,
               validator_mod, output_suffix: str) -> dict:
    """Run one conversion + validation and return JSON-serializable result."""
    tool_name = converter_mod.TOOL_NAME
    output_path = OUTPUTS_DIR / f"{tool_name}_{test_name}{output_suffix}"

    print(f"\n  [{tool_name}] Converting {test_name}...")
    conv_result = converter_mod.convert(input_path, output_path)
    print(f"  [{tool_name}] {conv_result.status} ({conv_result.duration_seconds:.1f}s)")

    checks = []
    if conv_result.status == "success":
        print(f"  [{tool_name}] Validating...")
        try:
            check_results = validator_mod.run_checks(str(input_path), str(output_path))
            checks = [dataclasses.asdict(c) for c in check_results]
            passed = sum(1 for c in check_results if c.passed)
            failed = sum(1 for c in check_results if not c.passed)
            print(f"  [{tool_name}] {passed} passed, {failed} failed")
        except Exception as e:
            print(f"  [{tool_name}] Validation error: {e}")
            checks = [{"name": "validation_error", "passed": False, "detail": str(e)}]

    # Strip 'tool' from conversion dict — it's redundant with top-level 'converter'
    conv_dict = dataclasses.asdict(conv_result)
    conv_dict.pop("tool", None)

    return {
        "converter": tool_name,
        "test_file": test_name,
        "input_path": str(input_path),
        "output_path": str(output_path),
        "conversion": conv_dict,
        "checks": checks,
    }


def render_matrix(results: list[dict], check_names: list[str], output_path: Path):
    """Render a markdown pass/fail matrix from results."""
    # Group by test file
    by_file = {}
    for r in results:
        by_file.setdefault(r["test_file"], []).append(r)

    lines = []
    header = "| Source File | Tool | Status | " + " | ".join(check_names) + " |"
    sep = "|---|---|---|" + "|".join(["---"] * len(check_names)) + "|"
    lines.append(header)
    lines.append(sep)

    for test_name, runs in by_file.items():
        for r in runs:
            status = r["conversion"]["status"]
            if status != "success":
                cells = [status.upper()] * len(check_names)
            else:
                check_map = {c["name"]: c["passed"] for c in r["checks"]}
                cells = []
                for cn in check_names:
                    if cn in check_map:
                        cells.append("PASS" if check_map[cn] else "**FAIL**")
                    else:
                        cells.append("—")
            row = f"| {test_name} | {r['converter']} | {status} | " + " | ".join(cells) + " |"
            lines.append(row)

    output_path.write_text("\n".join(lines) + "\n")
    print(f"\nMatrix written to {output_path}")


RASTER_CHECK_NAMES = [
    "COG structure", "CRS preserved", "Bounds preserved", "Dimensions",
    "Band count", "Pixel fidelity", "NoData preserved", "Overviews",
]

VECTOR_CHECK_NAMES = [
    "Row count", "CRS preserved", "Columns preserved", "Geometry type",
    "Geometry validity", "Geometry fidelity", "Attribute fidelity",
    "Bounds preserved", "GeoParquet metadata",
]


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    # Phase 1: Acquire test data
    print("=" * 60)
    print("PHASE 1: Acquiring test data")
    print("=" * 60)
    downloaded = acquire_data.acquire_all()

    # Phase 2: Run conversions
    print("\n" + "=" * 60)
    print("PHASE 2: Running conversions and validations")
    print("=" * 60)

    raster_tests, vector_tests = build_test_registry(downloaded)

    raster_validator = load_validator(RASTER_VALIDATOR)
    shapefile_validator = load_validator(SHAPEFILE_VALIDATOR)
    geojson_validator = load_validator(GEOJSON_VALIDATOR)

    raster_results = []
    for test in raster_tests:
        for conv in test["converters"]:
            result = run_single(test["name"], test["path"], conv,
                                raster_validator, ".tif")
            raster_results.append(result)
            json_path = RAW_DIR / f"{conv.TOOL_NAME}_{test['name']}.json"
            json_path.write_text(json.dumps(result, indent=2))

    vector_results = []
    for test in vector_tests:
        validator = shapefile_validator if test["format"] == "shapefile" else geojson_validator
        for conv in test["converters"]:
            result = run_single(test["name"], test["path"], conv,
                                validator, ".parquet")
            vector_results.append(result)
            json_path = RAW_DIR / f"{conv.TOOL_NAME}_{test['name']}.json"
            json_path.write_text(json.dumps(result, indent=2))

    # Phase 3: Render reports
    print("\n" + "=" * 60)
    print("PHASE 3: Rendering reports")
    print("=" * 60)

    if raster_results:
        render_matrix(raster_results, RASTER_CHECK_NAMES, RESULTS_DIR / "raster_matrix.md")
    if vector_results:
        render_matrix(vector_results, VECTOR_CHECK_NAMES, RESULTS_DIR / "vector_matrix.md")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    all_results = raster_results + vector_results
    total = len(all_results)
    skipped = sum(1 for r in all_results if r["conversion"]["status"] == "skipped")
    errored = sum(1 for r in all_results if r["conversion"]["status"] == "error")
    succeeded = sum(1 for r in all_results if r["conversion"]["status"] == "success")

    total_checks = sum(len(r["checks"]) for r in all_results)
    failed_checks = sum(1 for r in all_results for c in r["checks"] if not c["passed"])

    print(f"Runs: {total} total, {succeeded} success, {errored} error, {skipped} skipped")
    print(f"Checks: {total_checks} total, {failed_checks} failed")
    print(f"\nRaw results: {RAW_DIR}/")
    print(f"Matrices: {RESULTS_DIR}/raster_matrix.md, {RESULTS_DIR}/vector_matrix.md")
    print(f"\nNext step: Review failures in the matrices and write findings.md")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/run_shootout.py
git commit -m "feat(shootout): add runner script with conversion, validation, and report rendering"
```

### Task 15: Write README

**Files:**
- Create: `docs/shootout/README.md`

- [ ] **Step 1: Write README**

```markdown
# Geo Conversion Validator Shootout

Compares multiple geospatial conversion tools and grades their output using
our `validate.py` scripts to prove the validators catch real silent failures.

## Quick start

```bash
# Install dependencies
pip install rasterio rio-cogeo geopandas pyarrow numpy duckdb

# Optional: install gpq from https://github.com/planetlabs/gpq/releases
# Optional: apt install gdal-bin (for gdal_translate and ogr2ogr)

# Run everything
cd docs/shootout
python run_shootout.py
```

## What it does

1. Downloads test data (cached in `data/`, gitignored)
2. Converts each test file with each tool
3. Validates each conversion with our `validate.py` scripts
4. Renders pass/fail matrices to `results/`

## After running

Review `results/raster_matrix.md` and `results/vector_matrix.md` for failures.
Write up findings in `results/findings.md`, classifying each failure as:

- **Real defect** — tool silently broke something
- **False positive** — our validator is wrong (fix it)
- **Expected limitation** — known lossy behavior

See the design spec: `docs/superpowers/specs/2026-03-13-geo-conversion-validator-shootout-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/shootout/README.md
git commit -m "docs(shootout): add README with usage instructions"
```

---

## Chunk 6: Run, Analyze, Report

### Task 16: Install missing tools

- [ ] **Step 1: Check what's already installed**

```bash
pip list | grep -iE "rasterio|rio-cogeo|geopandas|pyarrow|duckdb|numpy"
which gdal_translate
which ogr2ogr
which gpq
which cogger
```

- [ ] **Step 2: Install what's missing**

Install whatever is missing from the check above. Use `pip install` for Python packages, skip CLI tools that can't be easily installed.

- [ ] **Step 3: Commit nothing — this is environment setup**

### Task 17: Run the shootout

- [ ] **Step 1: Execute run_shootout.py**

```bash
cd docs/shootout && python run_shootout.py
```

This will take several minutes (downloading ~200MB of test data, running ~30 conversions). Watch the output for errors and skipped tools.

- [ ] **Step 2: Review the raw output**

Check that `results/raw/` has JSON files and `results/raster_matrix.md` / `results/vector_matrix.md` exist.

- [ ] **Step 3: Commit raw results**

```bash
git add docs/shootout/results/raw/*.json docs/shootout/results/*_matrix.md
git commit -m "data(shootout): add raw shootout results and matrices"
```

### Task 18: Analyze findings and write report

- [ ] **Step 1: Review each FAIL in the matrices**

For each failure, investigate:
- What did the tool produce vs what was expected?
- Is this a real defect, false positive, or expected limitation?
- What severity (critical/warning/info)?
- What downstream impact?

If a failure is a false positive in our validator, fix the validator and re-run that specific conversion.

- [ ] **Step 2: Write findings.md**

Create `docs/shootout/results/findings.md` with the narrative analysis. Structure:

```markdown
# Validator Shootout Findings

## Summary
[Did we meet the 3-failure success criteria?]

## Findings

### Finding 1: [Tool] — [What went wrong]
- **Check:** [which validator check caught it]
- **Classification:** Real defect
- **Severity:** Critical/Warning/Info
- **Details:** [what happened]
- **Downstream impact:** [what would break]

[repeat for each finding]

## Tools Skipped
[List tools that couldn't be installed and why]

## Validator Improvements Proposed
[New checks, relaxed checks, severity levels]
```

- [ ] **Step 3: Copy findings to Obsidian**

```bash
cp docs/shootout/results/findings.md ~/Documents/obsidian-notes/Project\ Docs/Map\ App\ Builder/geo-conversion-validator-shootout-findings.md
```

- [ ] **Step 4: Commit findings**

```bash
git add docs/shootout/results/findings.md
git commit -m "docs(shootout): add findings narrative analysis"
```

- [ ] **Step 5: Commit any validator fixes (if false positives were found)**

If validators were modified during analysis:

```bash
git add skills/geo-conversions/*/scripts/validate.py
git commit -m "fix(validate): address false positives found during shootout"
```
