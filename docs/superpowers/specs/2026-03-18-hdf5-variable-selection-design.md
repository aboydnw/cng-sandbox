# HDF5 Support & Variable Selection for HDF5/NetCDF

**Date:** 2026-03-18
**Status:** Draft

## Problem

The sandbox currently supports GeoTIFF, Shapefile, GeoJSON, and NetCDF. HDF5 is a common format for satellite missions (e.g., NISAR) but can't reuse the NetCDF converter because:

1. HDF5 files have deeply nested group hierarchies — `xr.open_dataset()` returns an empty dataset when the data lives in subgroups like `science/LSAR/SME2/grids/`.
2. HDF5 files often contain 30+ raster variables. The converter needs to know which one to extract.
3. Coordinates may be in projected CRS (e.g., EASE Grid) rather than lat/lon, requiring reprojection.

The NetCDF converter has the same variable selection limitation — it silently picks the first `data_var`, which is a known gap from the initial implementation.

## Solution

Add a **two-phase upload flow** for HDF5 and NetCDF:

1. **Phase 1 (Scan):** Upload the file, scan it to discover variables, return the list to the frontend.
2. **Phase 2 (Convert):** User picks a variable, conversion proceeds as normal.

Files with only one eligible variable skip the picker automatically.

## Scope

- New format: HDF5 (`.h5`, `.hdf5`) → COG
- Retrofit NetCDF upload with variable selection
- New scan API endpoint
- New frontend VariablePicker component
- All other formats (GeoTIFF, Shapefile, GeoJSON) unchanged

## Design

### New API: Scan Endpoint

`POST /api/scan/{scan_id}/convert`

After an HDF5 or NetCDF file is uploaded via the existing `POST /api/upload`, the backend detects the format and — instead of converting immediately — scans the file and returns the variable list in the upload response:

```json
{
  "job_id": "uuid",
  "dataset_id": "uuid",
  "scan_id": "uuid",
  "variables": [
    {
      "name": "soilMoisture",
      "group": "science/LSAR/SME2/grids",
      "shape": [1890, 1485],
      "dtype": "float32"
    },
    {
      "name": "sigma0HH",
      "group": "science/LSAR/SME2/grids/radarData/frequencyA",
      "shape": [1890, 1485],
      "dtype": "float32"
    }
  ]
}
```

**Auto-select rule:** If `variables` has exactly one entry, the backend skips the scan response, auto-selects that variable, and proceeds directly to conversion (no frontend change needed for simple files).

**Variable filtering:** Only 2D arrays (or 3D with a reducible time dimension) of numeric types (float32, float64, int16, int32, etc.) are included. Scalars, 1D coordinate arrays, and string datasets are excluded.

**Scan storage:** A `scan_store` dict holds `{scan_id: {"path": temp_file_path, "job": job, "created_at": datetime}}`. Entries expire after 30 minutes via a cleanup check on each new scan request.

**Convert trigger:** `POST /api/scan/{scan_id}/convert` with body:

```json
{
  "variable": "soilMoisture",
  "group": "science/LSAR/SME2/grids"
}
```

This retrieves the temp file from `scan_store`, starts the normal pipeline with the selected variable/group passed through, and cleans up the scan entry.

### HDF5 Variable Discovery

For HDF5 files, the scanner walks the group tree recursively using h5py:

```
open file → walk all groups → for each dataset:
  - skip if ndim < 2
  - skip if dtype is string/object
  - skip if name matches coordinate patterns (xCoordinates, yCoordinates, latitude, longitude, etc.)
  - include: record name, full group path, shape, dtype
```

### NetCDF Variable Discovery

For NetCDF files, the scanner uses xarray:

```
open_dataset → list data_vars → for each variable:
  - skip if resulting spatial dims < 2 after removing time
  - include: record name, shape, dtype
  - group is always "" (root) for standard NetCDF
```

### HDF5 Converter Module

New `geo-conversions/hdf5-to-cog/` following the existing module pattern:

```
hdf5-to-cog/
  __init__.py          # Same lazy-loading pattern as netcdf-to-cog
  scripts/
    convert.py         # HDF5 → COG conversion
    validate.py        # Validation checks
```

**`convert(input_path, output_path, variable, group, compression="DEFLATE", verbose=False)`:**

1. Open with h5py, navigate to `group`
2. Read the 2D variable as numpy array
3. Read coordinate arrays from the same group (e.g., `xCoordinates`, `yCoordinates`)
4. Read `projection` scalar to determine source CRS (EPSG code)
5. Build affine transform from coordinate arrays + spacing values
6. Write temporary GeoTIFF in native CRS
7. Reproject to EPSG:4326 using `rasterio.warp.reproject`
8. Convert to COG with rio-cogeo (512x512 blocks, DEFLATE, 6 overview levels)

**CRS detection heuristics** (checked in order):
1. `projection` scalar in the same group → interpret as EPSG code
2. `crs` or `spatial_ref` attribute on the group or root → parse WKT/PROJ string
3. If coordinates are named `latitude`/`longitude` and values are in -180..180 / -90..90 range → assume EPSG:4326
4. Fall back: error with "Cannot determine CRS"

**Coordinate detection heuristics** (checked in order):
1. `xCoordinates`/`yCoordinates` arrays in the same group (NISAR pattern)
2. `x`/`y` arrays in the same group
3. `longitude`/`latitude` arrays in the same group or parent
4. Fall back: error with "Cannot determine coordinates"

**Validation checks** (`run_checks`):
- COG structure valid (rio-cogeo)
- CRS is EPSG:4326 (confirms reprojection worked)
- Bounds are within valid geographic range (-180..180, -90..90)
- Band count is 1
- NoData value defined
- Overviews present (>= 3 levels)
- Pixel fidelity: sample random pixels from h5py source, reproject their coordinates, compare against COG values (tolerance accounts for interpolation from reprojection)

### Pipeline Changes

**`models.py`:**
- Add `FormatPair.HDF5_TO_COG = "hdf5-to-cog"`
- Add `.h5`, `.hdf5` to `FormatPair.from_extension()`
- Add `HDF5_TO_COG` to the `dataset_type` property → `DatasetType.RASTER`

**`detector.py`:**
- Add `HDF5_TO_COG` to `_MIME_WHITELIST` with `{"application/x-hdf5", "application/x-hdf", "application/octet-stream"}`
- Update error message to list `.h5` / `.hdf5` as accepted formats

**`pipeline.py`:**
- `_import_and_convert`: add `FormatPair.HDF5_TO_COG` branch → `from hdf5_to_cog import convert`
- `_import_and_validate`: add `FormatPair.HDF5_TO_COG` branch → `from hdf5_to_cog import run_checks`
- `get_credits`: add `HDF5_TO_COG` entry with h5py + rasterio credits
- Pass `variable` and `group` kwargs through to converter (stored on the Job model or passed via scan flow)

**`upload.py`:**
- Modify `upload_file` response: for HDF5/NetCDF formats, run scan first and return `scan_id` + `variables` in the response
- New `POST /api/scan/{scan_id}/convert` endpoint
- `scan_store` dict with TTL cleanup

**`state.py`:**
- Add `scan_store: dict = {}` alongside `jobs` and `datasets`

### Frontend Changes

**`FileUploader.tsx`:**
- Add `.h5`, `.hdf5` to `ALLOWED_EXTENSIONS` and `RASTER_EXTENSIONS`
- Update help text: `"GeoTIFF · Shapefile (.zip) · GeoJSON · NetCDF · HDF5"`

**New component: `VariablePicker.tsx`:**
- Inline panel (replaces the progress area, not a modal)
- Renders a list of selectable rows, each showing: variable name, group path (dimmed, only for HDF5), shape, dtype
- Clicking a row calls `onSelect(variable, group)`
- Simple, minimal — follows existing Chakra UI patterns in the codebase

**`useConversionJob.ts` (upload hook):**
- After upload response, check for `scan_id` and `variables` fields
- If present and `variables.length > 1`: surface to parent via new state (`scanResult`)
- If `variables.length === 1`: auto-call `/api/scan/{scan_id}/convert` immediately
- New `confirmVariable(scanId, variable, group)` function that POSTs to the convert endpoint and then starts normal SSE polling

**`MapPage.tsx`:**
- Handle the new `scanResult` state from the upload hook
- Show `VariablePicker` when scan result is present, hide it when variable is confirmed

### Dependencies

**Ingestion service:**
- Add `h5py` to `pyproject.toml` dependencies
- Add `rasterio` warp imports (already available, used by other converters)

**Docker:**
- No new system-level dependencies — h5py's wheels include libhdf5

### What's NOT in scope

- HDF5 files with no detectable CRS (will error with a clear message)
- Multi-variable extraction (one variable per conversion)
- HDF-EOS specific metadata parsing beyond what's described above
- Temporal HDF5 uploads (future work — would need multi-file scan coordination)
