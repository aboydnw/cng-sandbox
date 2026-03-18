# HDF5 Support & Variable Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HDF5 → COG conversion with a variable picker UI, and retrofit NetCDF with the same variable selection flow.

**Architecture:** Two-phase upload: pipeline scans HDF5/NetCDF files for variables, pauses via `asyncio.Event`, emits a `scan_result` SSE event, then resumes after the user picks a variable via `POST /api/scan/{scan_id}/convert`. A new `hdf5-to-cog` geo-conversion module handles HDF5 → native CRS GeoTIFF → reproject to EPSG:4326 → COG.

**Tech Stack:** h5py, rasterio, rio-cogeo, xarray (existing), asyncio, FastAPI, React + Chakra UI

**Spec:** `docs/superpowers/specs/2026-03-18-hdf5-variable-selection-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `geo-conversions/hdf5-to-cog/__init__.py` | Lazy-load wrapper (same pattern as netcdf-to-cog) |
| `geo-conversions/hdf5-to-cog/scripts/convert.py` | HDF5 → COG conversion with CRS reprojection |
| `geo-conversions/hdf5-to-cog/scripts/validate.py` | Validation checks for HDF5-derived COGs |
| `ingestion/src/services/scanner.py` | Variable discovery for HDF5 (h5py) and NetCDF (xarray) |
| `ingestion/tests/test_scanner.py` | Scanner unit tests |
| `ingestion/tests/test_scan_endpoint.py` | Scan API endpoint tests |
| `frontend/src/components/VariablePicker.tsx` | Variable selection UI component |

### Modified files

| File | What changes |
|------|-------------|
| `ingestion/src/models.py` | Add `HDF5_TO_COG` format pair, `variable`/`group`/`scan_event`/`scan_result` on Job |
| `ingestion/src/services/detector.py` | Add HDF5 MIME whitelist, update error message |
| `ingestion/src/services/pipeline.py` | Add HDF5 converter branch, scan-pause-resume flow, forward kwargs |
| `ingestion/src/routes/upload.py` | Add `POST /api/scan/{scan_id}/convert` endpoint |
| `ingestion/src/routes/jobs.py` | Emit `scan_result` SSE event |
| `ingestion/src/state.py` | Add `scan_store`, `scan_store_lock` |
| `ingestion/pyproject.toml` | Add `h5py` dependency |
| `frontend/src/components/FileUploader.tsx` | Add `.h5`/`.hdf5` to allowed extensions |
| `frontend/src/hooks/useConversionJob.ts` | Handle `scan_result` SSE event, add `confirmVariable` |
| `frontend/src/pages/UploadPage.tsx` (or equivalent) | Show `VariablePicker` when scan result is present |

---

### Task 1: Add HDF5 format pair to models

**Files:**
- Modify: `ingestion/src/models.py:25-52`

- [ ] **Step 1: Write the test**

Create `ingestion/tests/test_hdf5_format.py`:

```python
import pytest
from src.models import FormatPair, DatasetType


def test_h5_extension_maps_to_hdf5():
    assert FormatPair.from_extension(".h5") == FormatPair.HDF5_TO_COG


def test_hdf5_extension_maps_to_hdf5():
    assert FormatPair.from_extension(".hdf5") == FormatPair.HDF5_TO_COG


def test_hdf5_dataset_type_is_raster():
    assert FormatPair.HDF5_TO_COG.dataset_type == DatasetType.RASTER
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ingestion && uv run pytest tests/test_hdf5_format.py -v`
Expected: FAIL — `FormatPair` has no `HDF5_TO_COG` member

- [ ] **Step 3: Add `HDF5_TO_COG` to `FormatPair`**

In `ingestion/src/models.py`:

Add `HDF5_TO_COG = "hdf5-to-cog"` after `NETCDF_TO_COG` in the enum.

Add to the `mapping` dict in `from_extension`:
```python
".h5": FormatPair.HDF5_TO_COG,
".hdf5": FormatPair.HDF5_TO_COG,
```

Update `dataset_type` property:
```python
if self in (FormatPair.GEOTIFF_TO_COG, FormatPair.NETCDF_TO_COG, FormatPair.HDF5_TO_COG):
    return DatasetType.RASTER
```

- [ ] **Step 4: Add `variable`, `group`, `scan_event`, `scan_result` to Job model**

In `ingestion/src/models.py`, add `import asyncio` at the top and update the `Job` class:

```python
class Job(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dataset_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    status: JobStatus = JobStatus.PENDING
    format_pair: FormatPair | None = None
    error: str | None = None
    validation_results: list[ValidationCheck] = []
    progress_current: int | None = None
    progress_total: int | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Variable selection (HDF5/NetCDF scan flow)
    variable: str | None = None
    group: str | None = None
    scan_event: asyncio.Event | None = Field(default=None, exclude=True)
    scan_result: dict | None = Field(default=None, exclude=True)
```

- [ ] **Step 5: Run tests**

Run: `cd ingestion && uv run pytest tests/test_hdf5_format.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add ingestion/src/models.py ingestion/tests/test_hdf5_format.py
git commit -m "feat: add HDF5_TO_COG format pair and scan fields on Job model"
```

---

### Task 2: Add HDF5 to format detector

**Files:**
- Modify: `ingestion/src/services/detector.py:15-32`

- [ ] **Step 1: Write the test**

Add to `ingestion/tests/test_hdf5_format.py`:

```python
from src.services.detector import detect_format


def test_detect_format_h5():
    assert detect_format("data.h5") == FormatPair.HDF5_TO_COG


def test_detect_format_hdf5():
    assert detect_format("data.hdf5") == FormatPair.HDF5_TO_COG
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ingestion && uv run pytest tests/test_hdf5_format.py::test_detect_format_h5 -v`
Expected: FAIL — `UnsupportedFormatError`

- [ ] **Step 3: Update detector**

In `ingestion/src/services/detector.py`:

Add to `_MIME_WHITELIST`:
```python
FormatPair.HDF5_TO_COG: {"application/x-hdf5", "application/x-hdf", "application/octet-stream"},
```

Update the error message in `detect_format`:
```python
f"Accepted: .tif, .tiff, .shp, .zip, .geojson, .json, .nc, .h5, .hdf5"
```

- [ ] **Step 4: Run tests**

Run: `cd ingestion && uv run pytest tests/test_hdf5_format.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/services/detector.py ingestion/tests/test_hdf5_format.py
git commit -m "feat: add HDF5 to format detector MIME whitelist"
```

---

### Task 3: Build the variable scanner service

**Files:**
- Create: `ingestion/src/services/scanner.py`
- Create: `ingestion/tests/test_scanner.py`

- [ ] **Step 1: Write scanner tests**

Create `ingestion/tests/test_scanner.py`:

```python
import numpy as np
import pytest


@pytest.fixture
def sample_hdf5(tmp_path):
    import h5py
    path = tmp_path / "test.h5"
    with h5py.File(path, "w") as f:
        grp = f.create_group("science/data/grids")
        grp.create_dataset("soilMoisture", data=np.zeros((100, 80), dtype=np.float32))
        grp.create_dataset("temperature", data=np.ones((100, 80), dtype=np.float32))
        grp.create_dataset("xCoordinates", data=np.linspace(0, 100, 80))
        grp.create_dataset("yCoordinates", data=np.linspace(0, 100, 100))
        grp.create_dataset("projection", data=np.uint32(6933))
        grp.create_dataset("metadata_string", data="hello")
        grp.create_dataset("scalar_value", data=np.float32(1.0))
    return str(path)


@pytest.fixture
def sample_netcdf(tmp_path):
    import xarray as xr
    path = tmp_path / "test.nc"
    ds = xr.Dataset({
        "temperature": (["lat", "lon"], np.zeros((10, 20), dtype=np.float32)),
        "precipitation": (["lat", "lon"], np.ones((10, 20), dtype=np.float32)),
    }, coords={"lat": np.linspace(-10, 10, 10), "lon": np.linspace(-20, 20, 20)})
    ds.to_netcdf(str(path))
    return str(path)


@pytest.fixture
def single_var_netcdf(tmp_path):
    import xarray as xr
    path = tmp_path / "single.nc"
    ds = xr.Dataset({
        "temperature": (["lat", "lon"], np.zeros((10, 20), dtype=np.float32)),
    }, coords={"lat": np.linspace(-10, 10, 10), "lon": np.linspace(-20, 20, 20)})
    ds.to_netcdf(str(path))
    return str(path)


def test_scan_hdf5_finds_2d_variables(sample_hdf5):
    from src.services.scanner import scan_hdf5
    variables = scan_hdf5(sample_hdf5)
    names = [v["name"] for v in variables]
    assert "soilMoisture" in names
    assert "temperature" in names
    assert "xCoordinates" not in names
    assert "yCoordinates" not in names
    assert "projection" not in names
    assert "metadata_string" not in names
    assert "scalar_value" not in names


def test_scan_hdf5_includes_group_path(sample_hdf5):
    from src.services.scanner import scan_hdf5
    variables = scan_hdf5(sample_hdf5)
    sm = next(v for v in variables if v["name"] == "soilMoisture")
    assert sm["group"] == "science/data/grids"
    assert sm["shape"] == [100, 80]
    assert sm["dtype"] == "float32"


def test_scan_netcdf_finds_data_vars(sample_netcdf):
    from src.services.scanner import scan_netcdf
    variables = scan_netcdf(sample_netcdf)
    names = [v["name"] for v in variables]
    assert "temperature" in names
    assert "precipitation" in names
    assert len(variables) == 2


def test_scan_netcdf_group_is_empty(sample_netcdf):
    from src.services.scanner import scan_netcdf
    variables = scan_netcdf(sample_netcdf)
    for v in variables:
        assert v["group"] == ""


def test_scan_single_var_netcdf(single_var_netcdf):
    from src.services.scanner import scan_netcdf
    variables = scan_netcdf(single_var_netcdf)
    assert len(variables) == 1
    assert variables[0]["name"] == "temperature"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ingestion && uv run pytest tests/test_scanner.py -v`
Expected: FAIL — `scanner` module does not exist

- [ ] **Step 3: Implement the scanner**

Create `ingestion/src/services/scanner.py`:

```python
"""Variable discovery for HDF5 and NetCDF files."""

import h5py
import xarray as xr

_COORD_NAMES = {
    "xcoordinates", "ycoordinates", "x", "y",
    "latitude", "longitude", "lat", "lon",
    "xcoordinatespacing", "ycoordinatespacing",
    "easegridcolumnindex", "easegridrowindex",
}


def scan_hdf5(path: str) -> list[dict]:
    """Walk an HDF5 file and return eligible 2D raster variables."""
    variables = []
    with h5py.File(path, "r") as f:
        def _visit(name, obj):
            if not isinstance(obj, h5py.Dataset):
                return
            if obj.ndim < 2:
                return
            if obj.dtype.kind in ("S", "U", "O"):
                return
            basename = name.rsplit("/", 1)[-1]
            if basename.lower() in _COORD_NAMES:
                return
            group = name.rsplit("/", 1)[0] if "/" in name else ""
            variables.append({
                "name": basename,
                "group": group,
                "shape": list(obj.shape),
                "dtype": str(obj.dtype),
            })
        f.visititems(_visit)
    return variables


def scan_netcdf(path: str) -> list[dict]:
    """List eligible data variables from a NetCDF file."""
    variables = []
    ds = xr.open_dataset(path)
    for name in ds.data_vars:
        da = ds[name]
        spatial_dims = [d for d in da.dims if d.lower() not in ("time", "t")]
        if len(spatial_dims) < 2:
            continue
        variables.append({
            "name": str(name),
            "group": "",
            "shape": list(da.shape),
            "dtype": str(da.dtype),
        })
    ds.close()
    return variables
```

- [ ] **Step 4: Run tests**

Run: `cd ingestion && uv run pytest tests/test_scanner.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/services/scanner.py ingestion/tests/test_scanner.py
git commit -m "feat: add variable scanner for HDF5 and NetCDF files"
```

---

### Task 4: Build the HDF5 → COG converter

**Files:**
- Create: `geo-conversions/hdf5-to-cog/__init__.py`
- Create: `geo-conversions/hdf5-to-cog/scripts/convert.py`
- Create: `geo-conversions/hdf5-to-cog/scripts/test_convert.py`

- [ ] **Step 1: Write the test**

Create `geo-conversions/hdf5-to-cog/scripts/test_convert.py`:

```python
import os
import numpy as np
import pytest
import h5py
import rasterio


@pytest.fixture
def nisar_like_h5(tmp_path):
    """Create a minimal NISAR-like HDF5 file with projected coordinates.

    Uses 600x800 pixels to be large enough for overview generation (needs > 512x512).
    """
    path = tmp_path / "test.h5"
    with h5py.File(path, "w") as f:
        grp = f.create_group("science/LSAR/SME2/grids")
        y_coords = np.linspace(-1000000.0, -1200000.0, 600)
        x_coords = np.linspace(-7200000.0, -7000000.0, 800)
        data = np.random.default_rng(42).random((600, 800)).astype(np.float32)
        data[0, 0] = -9999.0

        grp.create_dataset("soilMoisture", data=data)
        grp["soilMoisture"].attrs["_FillValue"] = np.float32(-9999.0)
        grp.create_dataset("xCoordinates", data=x_coords)
        grp.create_dataset("yCoordinates", data=y_coords)
        grp.create_dataset("xCoordinateSpacing", data=abs(x_coords[1] - x_coords[0]))
        grp.create_dataset("yCoordinateSpacing", data=abs(y_coords[1] - y_coords[0]))
        grp.create_dataset("projection", data=np.uint32(6933))
    return str(path)


def test_convert_produces_valid_cog(nisar_like_h5, tmp_path):
    from convert import convert
    output = str(tmp_path / "output.tif")
    convert(nisar_like_h5, output, variable="soilMoisture",
            group="science/LSAR/SME2/grids", verbose=True)

    assert os.path.exists(output)
    with rasterio.open(output) as src:
        assert str(src.crs) == "EPSG:4326"
        assert src.count == 1
        assert src.nodata is not None
        b = src.bounds
        assert -180 <= b.left <= 180
        assert -90 <= b.bottom <= 90
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd geo-conversions/hdf5-to-cog/scripts && python -m pytest test_convert.py -v`
Expected: FAIL — `convert` module does not exist

- [ ] **Step 3: Implement the converter**

Create `geo-conversions/hdf5-to-cog/scripts/convert.py`. Key logic:

1. Open with h5py, navigate to `group`, read the 2D variable
2. Detect nodata from `_FillValue` attribute
3. Find `xCoordinates`/`yCoordinates` (or `x`/`y`, `longitude`/`latitude`) in the group or parent
4. Detect CRS from `projection` scalar (→ EPSG code), `crs`/`spatial_ref` attribute, or lat/lon range heuristic
5. Build affine transform from coordinate arrays (half-pixel origin adjustment, north-to-south orientation)
6. Write temporary GeoTIFF in native CRS
7. If CRS ≠ EPSG:4326: reproject with `rasterio.warp.reproject` + `calculate_default_transform`
8. Convert to COG with `rio_cogeo.cog_translate` (512×512 blocks, DEFLATE, 6 overview levels)

The coordinate name candidates (case-insensitive):
- X: `xCoordinates`, `x`, `longitude`, `lon`
- Y: `yCoordinates`, `y`, `latitude`, `lat`

CRS detection order:
1. `projection` scalar → `CRS.from_epsg(int(value))`
2. `crs` or `spatial_ref` attribute on group or root → `CRS.from_user_input()`
3. If x values are all in [-180, 180] → EPSG:4326
4. Else: raise `ValueError("Cannot determine CRS")`

Reference implementation: see the NetCDF converter at `geo-conversions/netcdf-to-cog/scripts/convert.py` for the `cog_translate` pattern and temp-file handling.

Reference data: the NISAR file at `/home/anthony/sample-data/Raster/tif/NISAR/` has:
- Projection EPSG:6933 (EASE Grid 2.0)
- xCoordinates in meters (range -7.2M to -7.0M)
- yCoordinates in meters (range -1.0M to -1.6M, north-to-south)
- soilMoisture: 1890×1530 float32 with `_FillValue=-9999.0`

- [ ] **Step 4: Create the `__init__.py` wrapper**

Create `geo-conversions/hdf5-to-cog/__init__.py` — same lazy-load pattern as `netcdf-to-cog/__init__.py`:

```python
"""HDF5 to COG conversion skill."""

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
    """Convert an HDF5 variable to a Cloud-Optimized GeoTIFF."""
    return _load("convert").convert(input_path, output_path, **kwargs)


def run_checks(input_path: str, output_path: str, **kwargs):
    """Run all validation checks and return list[CheckResult]."""
    return _load("validate").run_checks(input_path, output_path, **kwargs)
```

- [ ] **Step 5: Run the converter test**

Run: `cd geo-conversions/hdf5-to-cog/scripts && python -m pytest test_convert.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add geo-conversions/hdf5-to-cog/
git commit -m "feat: add HDF5 to COG converter with CRS reprojection"
```

---

### Task 5: Build the HDF5 validator

**Files:**
- Create: `geo-conversions/hdf5-to-cog/scripts/validate.py`

- [ ] **Step 1: Write the test**

Add to `geo-conversions/hdf5-to-cog/scripts/test_convert.py`:

```python
def test_validation_passes(nisar_like_h5, tmp_path):
    from convert import convert
    from validate import run_checks
    output = str(tmp_path / "output.tif")
    convert(nisar_like_h5, output, variable="soilMoisture",
            group="science/LSAR/SME2/grids", verbose=True)

    results = run_checks(nisar_like_h5, output, variable="soilMoisture",
                         group="science/LSAR/SME2/grids")
    failed = [r for r in results if not r.passed]
    assert not failed, f"Validation failures: {[(r.name, r.detail) for r in failed]}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd geo-conversions/hdf5-to-cog/scripts && python -m pytest test_convert.py::test_validation_passes -v`
Expected: FAIL — `validate` module does not exist

- [ ] **Step 3: Implement the validator**

Create `geo-conversions/hdf5-to-cog/scripts/validate.py` with these checks:

```python
"""Validate that a COG converted from HDF5 preserves data correctly."""

import dataclasses
import rasterio
from rio_cogeo import cog_validate


@dataclasses.dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str
```

Implement these check functions (same pattern as `netcdf-to-cog/scripts/validate.py`):
- `check_cog_valid(output_path)` — uses `cog_validate`
- `check_crs_4326(output_path)` — confirms `dst.crs.to_epsg() == 4326`
- `check_bounds_valid(output_path)` — bounds within [-180,180] × [-90,90]
- `check_band_count(output_path)` — exactly 1 band
- `check_nodata_present(output_path)` — nodata value defined
- `check_overviews(output_path, min_levels=3)` — at least 3 overview levels
- `check_pixel_fidelity(input_path, output_path, variable, group, n=1000, tolerance=0.5)` — sample random pixels from the h5py source, reproject their native CRS coordinates to EPSG:4326, then compare values against the COG. Uses a wider tolerance (0.5) than NetCDF because reprojection introduces interpolation differences. See the NetCDF validator's `check_pixel_fidelity` for the sampling pattern, but adapt it: read source data from h5py (not xarray), and use `rasterio.warp.transform` to convert native CRS pixel coordinates to EPSG:4326 before sampling from the COG.

`run_checks(input_path, output_path, variable="", group="")` returns all results as a list.

- [ ] **Step 4: Run tests**

Run: `cd geo-conversions/hdf5-to-cog/scripts && python -m pytest test_convert.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add geo-conversions/hdf5-to-cog/scripts/validate.py
git commit -m "feat: add HDF5 COG validator"
```

---

### Task 6: Add h5py dependency and wire HDF5 into the pipeline

**Files:**
- Modify: `ingestion/pyproject.toml`
- Modify: `ingestion/src/services/pipeline.py:37-59,327-356`

- [ ] **Step 1: Add h5py to pyproject.toml**

Add `"h5py>=3.10.0"` to the `dependencies` list in `ingestion/pyproject.toml`.

- [ ] **Step 2: Add HDF5 credits**

In `ingestion/src/services/pipeline.py`, add to `get_credits` after the NetCDF branch:

```python
elif format_pair == FormatPair.HDF5_TO_COG:
    credits.append({"tool": "h5py", "url": "https://www.h5py.org", "role": "Read by"})
    credits.append({"tool": "rasterio", "url": "https://rasterio.readthedocs.io", "role": "Reprojected by"})
    credits.append({"tool": "rio-cogeo", "url": "https://github.com/cogeotiff/rio-cogeo", "role": "Converted by"})
```

- [ ] **Step 3: Update `_import_and_convert` signature and add HDF5 branch**

Change `_import_and_convert` to accept `variable` and `group` kwargs:

```python
def _import_and_convert(format_pair: FormatPair, input_path: str, output_path: str,
                        variable: str | None = None, group: str | None = None) -> None:
    if format_pair == FormatPair.GEOTIFF_TO_COG:
        from geotiff_to_cog import convert
        convert(input_path, output_path, verbose=True)
    elif format_pair == FormatPair.SHAPEFILE_TO_GEOPARQUET:
        from shapefile_to_geoparquet import convert
        convert(input_path, output_path, verbose=True)
    elif format_pair == FormatPair.GEOJSON_TO_GEOPARQUET:
        from geojson_to_geoparquet import convert
        convert(input_path, output_path, verbose=True)
    elif format_pair == FormatPair.NETCDF_TO_COG:
        from netcdf_to_cog import convert
        kwargs = {"verbose": True}
        if variable:
            kwargs["variable"] = variable
        convert(input_path, output_path, **kwargs)
    elif format_pair == FormatPair.HDF5_TO_COG:
        from hdf5_to_cog import convert
        convert(input_path, output_path, variable=variable or "",
                group=group or "", verbose=True)
    else:
        raise ValueError(f"Unknown format pair: {format_pair}")
```

- [ ] **Step 4: Update `_import_and_validate` similarly**

```python
def _import_and_validate(format_pair: FormatPair, input_path: str, output_path: str,
                         variable: str | None = None, group: str | None = None) -> list:
    if format_pair == FormatPair.GEOTIFF_TO_COG:
        from geotiff_to_cog import run_checks
    elif format_pair == FormatPair.SHAPEFILE_TO_GEOPARQUET:
        from shapefile_to_geoparquet import run_checks
    elif format_pair == FormatPair.GEOJSON_TO_GEOPARQUET:
        from geojson_to_geoparquet import run_checks
    elif format_pair == FormatPair.NETCDF_TO_COG:
        from netcdf_to_cog import run_checks
        return run_checks(input_path, output_path, variable=variable)
    elif format_pair == FormatPair.HDF5_TO_COG:
        from hdf5_to_cog import run_checks
        return run_checks(input_path, output_path, variable=variable or "",
                          group=group or "")
    else:
        raise ValueError(f"Unknown format pair: {format_pair}")
    return run_checks(input_path, output_path)
```

- [ ] **Step 5: Update call sites in `run_pipeline`**

In `run_pipeline`, update the two `asyncio.to_thread` calls at lines ~179 and ~183:

```python
await asyncio.to_thread(
    _import_and_convert, format_pair, input_path, output_path,
    variable=job.variable, group=job.group,
)

check_results = await asyncio.to_thread(
    _import_and_validate, format_pair, input_path, output_path,
    variable=job.variable, group=job.group,
)
```

- [ ] **Step 6: Run existing tests**

Run: `cd ingestion && uv run pytest -v`
Expected: PASS (all existing tests still pass)

- [ ] **Step 7: Commit**

```bash
git add ingestion/pyproject.toml ingestion/src/services/pipeline.py
git commit -m "feat: wire HDF5 converter into pipeline with variable/group forwarding"
```

---

### Task 7: Implement scan-pause-resume in the pipeline

**Files:**
- Modify: `ingestion/src/state.py`
- Modify: `ingestion/src/services/pipeline.py:148-170`

- [ ] **Step 1: Update state.py**

```python
"""Shared mutable state — imported by both app.py and route modules."""

import asyncio

jobs: dict = {}
datasets: dict = {}
scan_store: dict = {}
scan_store_lock = asyncio.Lock()
```

- [ ] **Step 2: Add scan-pause logic to `run_pipeline`**

In `ingestion/src/services/pipeline.py`, add `import uuid` at the top and insert after `original_file_size = os.path.getsize(input_path)` (after line 163), before Stage 2:

```python
# Variable selection for HDF5/NetCDF
if format_pair in (FormatPair.HDF5_TO_COG, FormatPair.NETCDF_TO_COG):
    from src.services import scanner
    from src.state import scan_store, scan_store_lock
    from datetime import datetime as dt, timezone as tz

    if format_pair == FormatPair.HDF5_TO_COG:
        variables = await asyncio.to_thread(scanner.scan_hdf5, input_path)
    else:
        variables = await asyncio.to_thread(scanner.scan_netcdf, input_path)

    if len(variables) > 1:
        scan_id = str(uuid.uuid4())
        job.scan_result = {"scan_id": scan_id, "variables": variables}
        job.scan_event = asyncio.Event()

        async with scan_store_lock:
            scan_store[scan_id] = {
                "path": input_path,
                "job": job,
                "created_at": dt.now(tz.utc),
                "variables": variables,
                "state": "waiting",
            }

        await job.scan_event.wait()

        async with scan_store_lock:
            if scan_id in scan_store:
                scan_store[scan_id]["state"] = "converting"
    elif len(variables) == 1:
        job.variable = variables[0]["name"]
        job.group = variables[0].get("group", "")
```

- [ ] **Step 3: Run existing tests**

Run: `cd ingestion && uv run pytest -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add ingestion/src/state.py ingestion/src/services/pipeline.py
git commit -m "feat: add scan-pause-resume flow for variable selection in pipeline"
```

---

### Task 8: Add `scan_result` SSE event emission

**Files:**
- Modify: `ingestion/src/routes/jobs.py`

- [ ] **Step 1: Update SSE generator to emit `scan_result`**

In `ingestion/src/routes/jobs.py`, add `scan_result` handling inside the event generator. Add a `scan_result_emitted = False` flag, and before the status snapshot check, add:

```python
if job.scan_result is not None and not scan_result_emitted:
    scan_result_emitted = True
    yield {"event": "scan_result", "data": json.dumps(job.scan_result)}
```

Extract the generator as a named function (e.g., `_event_generator(job)`) so it can be tested.

- [ ] **Step 2: Run existing tests**

Run: `cd ingestion && uv run pytest -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/routes/jobs.py
git commit -m "feat: emit scan_result SSE event for variable selection"
```

---

### Task 9: Add `POST /api/scan/{scan_id}/convert` endpoint

**Files:**
- Modify: `ingestion/src/routes/upload.py`
- Create: `ingestion/tests/test_scan_endpoint.py`

- [ ] **Step 1: Write endpoint tests**

Create `ingestion/tests/test_scan_endpoint.py`:

```python
import asyncio
import pytest
from src.models import Job, JobStatus
from src.state import scan_store, scan_store_lock


@pytest.fixture(autouse=True)
def clear_scan_store():
    scan_store.clear()
    yield
    scan_store.clear()


@pytest.mark.asyncio
async def test_scan_convert_sets_variable_and_resumes():
    job = Job(filename="test.h5")
    job.status = JobStatus.SCANNING
    job.scan_event = asyncio.Event()
    scan_id = "test-scan-123"

    async with scan_store_lock:
        scan_store[scan_id] = {
            "path": "/tmp/fake.h5",
            "job": job,
            "variables": [
                {"name": "soilMoisture", "group": "grids", "shape": [10, 20], "dtype": "float32"},
                {"name": "temp", "group": "grids", "shape": [10, 20], "dtype": "float32"},
            ],
            "state": "waiting",
        }

    from src.routes.upload import _handle_scan_convert
    await _handle_scan_convert(scan_id, "soilMoisture", "grids")

    assert job.variable == "soilMoisture"
    assert job.group == "grids"
    assert job.scan_event.is_set()
    assert scan_store[scan_id]["state"] == "converting"


@pytest.mark.asyncio
async def test_scan_convert_404_for_missing_scan():
    from fastapi import HTTPException
    from src.routes.upload import _handle_scan_convert
    with pytest.raises(HTTPException) as exc_info:
        await _handle_scan_convert("nonexistent-id", "var", "grp")
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_scan_convert_400_for_invalid_variable():
    job = Job(filename="test.h5")
    job.scan_event = asyncio.Event()
    scan_id = "test-scan-456"

    async with scan_store_lock:
        scan_store[scan_id] = {
            "path": "/tmp/fake.h5",
            "job": job,
            "variables": [{"name": "soilMoisture", "group": "grids", "shape": [10, 20], "dtype": "float32"}],
            "state": "waiting",
        }

    from fastapi import HTTPException
    from src.routes.upload import _handle_scan_convert
    with pytest.raises(HTTPException) as exc_info:
        await _handle_scan_convert(scan_id, "nonexistent_var", "grids")
    assert exc_info.value.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ingestion && uv run pytest tests/test_scan_endpoint.py -v`
Expected: FAIL — `_handle_scan_convert` does not exist

- [ ] **Step 3: Add the endpoint and helper**

In `ingestion/src/routes/upload.py`, add imports and the endpoint:

```python
from src.state import scan_store, scan_store_lock

class ScanConvertRequest(PydanticBaseModel):
    variable: str
    group: str = ""


async def _handle_scan_convert(scan_id: str, variable: str, group: str):
    """Core logic for scan-convert, extracted for testability."""
    async with scan_store_lock:
        entry = scan_store.get(scan_id)
        if entry is None:
            raise HTTPException(
                status_code=404,
                detail="Scan expired or not found. Please re-upload the file.",
            )
        var_names = [v["name"] for v in entry["variables"]]
        if variable not in var_names:
            raise HTTPException(
                status_code=400,
                detail="Variable not found in scan results.",
            )
        job = entry["job"]
        job.variable = variable
        job.group = group
        entry["state"] = "converting"
    job.scan_event.set()


@router.post("/scan/{scan_id}/convert")
async def scan_convert(scan_id: str, body: ScanConvertRequest):
    """Resume a paused pipeline with the selected variable."""
    await _handle_scan_convert(scan_id, body.variable, body.group)
    return {"status": "converting"}
```

Also add `.h5` and `.hdf5` to `RASTER_EXTENSIONS`:

```python
RASTER_EXTENSIONS = {".tif", ".tiff", ".nc", ".nc4", ".h5", ".hdf5"}
```

**Note:** The `upload_temporal` endpoint also uses `RASTER_EXTENSIONS`. Since temporal HDF5 is out of scope, add an explicit reject in `upload_temporal` for `.h5`/`.hdf5` extensions:

```python
TEMPORAL_EXCLUDED = {".h5", ".hdf5"}
# In upload_temporal, after extension validation:
if ext in TEMPORAL_EXCLUDED:
    raise HTTPException(
        status_code=400,
        detail=f"Temporal uploads do not support HDF5 files yet.",
    )
```

- [ ] **Step 4: Run tests**

Run: `cd ingestion && uv run pytest tests/test_scan_endpoint.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/routes/upload.py ingestion/tests/test_scan_endpoint.py
git commit -m "feat: add POST /api/scan/{scan_id}/convert endpoint"
```

---

### Task 10: Update frontend to accept HDF5 extensions

**Files:**
- Modify: `frontend/src/components/FileUploader.tsx:5-6,107`

- [ ] **Step 1: Update extensions and help text**

In `frontend/src/components/FileUploader.tsx`:

Change line 5: add `".h5", ".hdf5"` to `ALLOWED_EXTENSIONS`
Change line 6: add `".h5", ".hdf5"` to `RASTER_EXTENSIONS`
Change the help text (~line 107) to: `GeoTIFF · Shapefile (.zip) · GeoJSON · NetCDF · HDF5`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/FileUploader.tsx
git commit -m "feat: accept .h5 and .hdf5 in file uploader"
```

---

### Task 11: Handle `scan_result` SSE in `useConversionJob`

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/hooks/useConversionJob.ts`

- [ ] **Step 1: Add scan result types to `types.ts`**

```typescript
export interface ScannedVariable {
  name: string;
  group: string;
  shape: number[];
  dtype: string;
}

export interface ScanResult {
  scan_id: string;
  variables: ScannedVariable[];
}
```

Add `scanResult: ScanResult | null;` to the `ConversionJobState` interface.

- [ ] **Step 2: Update `useConversionJob` hook**

Add `scanResult: null` to the initial state.

In `connectSSE`, add a `scan_result` event listener:

```typescript
es.addEventListener("scan_result", (event) => {
  let data: ScanResult;
  try {
    data = JSON.parse((event as MessageEvent).data);
  } catch {
    return;
  }

  if (data.variables.length === 1) {
    confirmVariable(data.scan_id, data.variables[0].name, data.variables[0].group);
    return;
  }

  setState((prev) => ({
    ...prev,
    scanResult: data,
    isUploading: false,
  }));
});
```

Add a `confirmVariable` callback:

```typescript
const confirmVariable = useCallback(
  async (scanId: string, variable: string, group: string) => {
    setState((prev) => ({ ...prev, scanResult: null }));

    const resp = await fetch(`${config.apiBase}/api/scan/${scanId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variable, group }),
    });

    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({ detail: "Variable selection failed" }));
      setState((prev) => ({
        ...prev,
        status: "failed",
        error: detail.detail || "Variable selection failed",
        stages: updateStages("failed", detail.detail),
      }));
    }
  },
  [],
);
```

Return `confirmVariable` from the hook.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/useConversionJob.ts
git commit -m "feat: handle scan_result SSE and add confirmVariable to upload hook"
```

---

### Task 12: Build the VariablePicker component

**Files:**
- Create: `frontend/src/components/VariablePicker.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { Box, Flex, Text } from "@chakra-ui/react";
import type { ScannedVariable } from "../types";

interface VariablePickerProps {
  variables: ScannedVariable[];
  onSelect: (variable: string, group: string) => void;
}

export function VariablePicker({ variables, onSelect }: VariablePickerProps) {
  return (
    <Box py={10} px={8} maxW="520px" mx="auto">
      <Text color="brand.brown" fontSize="18px" fontWeight={700} mb={2} textAlign="center">
        Choose a variable
      </Text>
      <Text color="brand.textSecondary" fontSize="13px" mb={6} textAlign="center">
        This file contains multiple raster variables. Select one to convert.
      </Text>
      <Flex direction="column" gap={2}>
        {variables.map((v) => (
          <Box
            key={`${v.group}/${v.name}`}
            p={4}
            border="1px solid"
            borderColor="brand.border"
            borderRadius="8px"
            cursor="pointer"
            _hover={{ borderColor: "brand.orange", bg: "orange.50" }}
            onClick={() => onSelect(v.name, v.group)}
          >
            <Text fontWeight={600} color="brand.brown" fontSize="14px">
              {v.name}
            </Text>
            {v.group && (
              <Text fontSize="12px" color="brand.textSecondary" mt={1}>
                {v.group}
              </Text>
            )}
            <Text fontSize="12px" color="#999" mt={1}>
              {v.shape.join(" × ")} · {v.dtype}
            </Text>
          </Box>
        ))}
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/VariablePicker.tsx
git commit -m "feat: add VariablePicker component for HDF5/NetCDF variable selection"
```

---

### Task 13: Wire VariablePicker into the upload flow

**Files:**
- Modify: The page that renders `<FileUploader>` and uses `useConversionJob`

- [ ] **Step 1: Find the upload page**

Search for the component that renders `<FileUploader>`. Read it. It may be `frontend/src/pages/HomePage.tsx` or similar — look for the file that calls `useConversionJob()` and `<FileUploader>`.

- [ ] **Step 2: Import VariablePicker and wire it up**

```typescript
import { VariablePicker } from "../components/VariablePicker";
```

Destructure `confirmVariable` from the hook:
```typescript
const { state, startUpload, startUrlFetch, startTemporalUpload, confirmVariable } = useConversionJob();
```

Show VariablePicker when `state.scanResult` is present, replacing the normal upload/progress UI:
```typescript
{state.scanResult ? (
  <VariablePicker
    variables={state.scanResult.variables}
    onSelect={(variable, group) => confirmVariable(state.scanResult!.scan_id, variable, group)}
  />
) : (
  // existing upload/progress UI
)}
```

- [ ] **Step 3: Take a screenshot to verify**

Start the dev stack: `docker compose up -d --build`
Use Playwright MCP to navigate to `http://localhost:5185`, upload a NISAR HDF5 file, and screenshot the variable picker.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/  # the modified upload page
git commit -m "feat: show VariablePicker in upload flow for HDF5/NetCDF files"
```

---

### Task 14: Integration test with real NISAR data

- [ ] **Step 1: Rebuild and start the stack**

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
```

- [ ] **Step 2: Upload a NISAR HDF5 file via curl**

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@/home/anthony/sample-data/Raster/tif/NISAR/NISAR_L3_PR_SME2_010_147_A_172_2005_DHDH_A_20260119T104225_20260119T104300_X05010_N_F_J_001.h5"
```

Expected: `{"job_id": "...", "dataset_id": "..."}`

- [ ] **Step 3: Monitor SSE for scan_result**

```bash
curl -N http://localhost:8000/api/jobs/{job_id}/stream
```

Expected: `event: scan_result` with ~20+ variables

- [ ] **Step 4: Select a variable**

```bash
curl -X POST http://localhost:8000/api/scan/{scan_id}/convert \
  -H "Content-Type: application/json" \
  -d '{"variable": "soilMoisture", "group": "science/LSAR/SME2/grids"}'
```

Expected: Pipeline resumes, SSE emits converting → validating → ingesting → ready

- [ ] **Step 5: Verify map renders**

Use Playwright MCP to navigate to `http://localhost:5185/map/{dataset_id}` and screenshot.

- [ ] **Step 6: Test NetCDF regression**

Upload a single-variable NetCDF. Verify it auto-converts without showing the variable picker.

- [ ] **Step 7: Commit any fixes**

---

### Task 15: Scan store TTL cleanup

**Files:**
- Modify: `ingestion/src/app.py`

- [ ] **Step 1: Read `app.py` to find the FastAPI app setup**

- [ ] **Step 2: Add a lifespan-scoped cleanup task**

```python
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from src.state import scan_store, scan_store_lock

@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(_cleanup_scans())
    yield
    task.cancel()

async def _cleanup_scans():
    while True:
        await asyncio.sleep(300)
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        async with scan_store_lock:
            expired = [
                sid for sid, entry in scan_store.items()
                if entry.get("state") == "waiting"
                and entry.get("created_at", datetime.now(timezone.utc)) < cutoff
            ]
            for sid in expired:
                del scan_store[sid]
```

Pass `lifespan=lifespan` to the FastAPI constructor (or integrate into the existing lifespan if one exists).

- [ ] **Step 3: Run existing tests**

Run: `cd ingestion && uv run pytest -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add ingestion/src/app.py
git commit -m "feat: add TTL cleanup for expired scan entries"
```
