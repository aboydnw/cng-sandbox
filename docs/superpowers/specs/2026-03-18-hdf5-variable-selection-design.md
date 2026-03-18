# HDF5 Support & Variable Selection for HDF5/NetCDF

**Date:** 2026-03-18
**Status:** Draft

## Problem

The sandbox currently supports GeoTIFF, Shapefile, GeoJSON, and NetCDF. HDF5 is a common format for satellite missions (e.g., NISAR) but can't reuse the NetCDF converter because:

1. HDF5 files have deeply nested group hierarchies — `xr.open_dataset()` returns an empty dataset when the data lives in subgroups like `science/LSAR/SME2/grids/`.
2. HDF5 files often contain 30+ raster variables. The converter needs to know which one to extract.
3. Coordinates may be in projected CRS (e.g., EASE Grid) rather than lat/lon, requiring reprojection.

The NetCDF converter has the same variable selection limitation — it silently picks the first `data_var`, which is a known gap from the initial implementation. (Note: the converter itself already accepts a `variable` parameter; the gap is that the pipeline never gives the user a chance to choose one.)

**Format disambiguation:** Detection is extension-based (`.h5`/`.hdf5` → HDF5, `.nc`/`.nc4` → NetCDF). A NetCDF4 file renamed to `.h5` would go through the HDF5 converter, which uses h5py instead of xarray. This is acceptable — both read the same underlying HDF5 format — but the heuristics for coordinate/CRS detection differ. Users should use the correct extension for their files.

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

### Scan Flow via SSE

The upload endpoint (`POST /api/upload` and `POST /api/convert-url`) remains unchanged in its response shape — it always returns `{job_id, dataset_id}` immediately and starts the background pipeline. The scan flow is communicated via SSE on the existing job stream:

1. Pipeline starts, reaches SCANNING stage
2. For HDF5/NetCDF: pipeline scans the file for variables
3. If multiple variables found: pipeline sets a `scan_result` field on the Job and **pauses** by awaiting an `asyncio.Event` on the Job. The SSE generator detects `job.scan_result` and emits `event: scan_result`:

```json
{
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

4. If only one variable found: pipeline auto-selects it and continues to CONVERTING without pausing (no frontend change needed for simple files).

**Auto-select rule:** If `variables` has exactly one entry, the backend auto-selects and proceeds directly to conversion. This preserves current behavior for simple NetCDF files.

**Variable filtering:** Only 2D arrays (or 3D with a reducible time dimension) of numeric types (float32, float64, int16, int32, etc.) are included. Scalars, 1D coordinate arrays, and string datasets are excluded.

### Variable Selection API

`POST /api/scan/{scan_id}/convert` with body:

```json
{
  "variable": "soilMoisture",
  "group": "science/LSAR/SME2/grids"
}
```

This sets `job.variable` and `job.group`, then calls `job.scan_event.set()` to unblock the paused pipeline. The pipeline continues from CONVERTING through the normal stages.

**Error cases:**
- `scan_id` not found or expired → 404 with `"Scan expired or not found. Please re-upload the file."`
- `variable` not in the scanned list → 400 with `"Variable not found in scan results."`

### Pipeline Pause/Resume Mechanism

The pipeline is an `async def` running in a `BackgroundTask`. To pause it mid-execution:

1. Add `scan_event: asyncio.Event | None = None` and `scan_result: dict | None = None` fields to the `Job` model (excluded from serialization).
2. In `run_pipeline`, after scanning variables, if multiple are found:
   - Set `job.scan_result = {"scan_id": ..., "variables": [...]}` and create `job.scan_event = asyncio.Event()`
   - `await job.scan_event.wait()` — this suspends the pipeline coroutine without blocking any thread
   - When the event is set, read `job.variable` and `job.group`, then continue to CONVERTING
3. The `POST /api/scan/{scan_id}/convert` endpoint sets `job.variable`, `job.group`, and calls `job.scan_event.set()`

**SSE transport for `scan_result`:** The existing SSE generator in `jobs.py` polls `job.status` every 0.5s. Add a check: if `job.scan_result is not None` and hasn't been emitted yet, yield `{"event": "scan_result", "data": json.dumps(job.scan_result)}`. After emitting, set a flag so it's not re-emitted. The SSE connection stays open — subsequent status changes (CONVERTING, READY) flow through the same stream.

**File lifecycle:** Because `run_pipeline` awaits the `scan_event` before returning, `_run_and_cleanup`'s `finally` block naturally runs only after conversion completes (or fails/times out). No special file lifecycle handling is needed — the existing cleanup pattern works as-is.

**`scan_id` vs `job_id`:** The frontend receives `job_id` from the upload response and opens an SSE connection on that `job_id`. When `scan_result` arrives over SSE, it contains a `scan_id` used only for the `POST /api/scan/{scan_id}/convert` call. The SSE stream remains on the original `job_id` — no reconnection or new stream is needed.

### Scan Storage

A `scan_store` dict holds `{scan_id: {"path": temp_file_path, "job": job, "created_at": datetime, "variables": [...], "state": "waiting" | "converting"}}`. Entries expire after 30 minutes **only while in the "waiting" state** — once conversion has resumed (state = "converting"), the entry is not eligible for TTL cleanup. Cleanup runs via a background task on a 5-minute timer (not on each request) to avoid race conditions. All mutations to `scan_store` are protected by an `asyncio.Lock`.

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

**`models.py` (Job model):**
- Add `variable: str | None = None` and `group: str | None = None` fields to the `Job` model. These are set when the user selects a variable via the scan flow, then forwarded to the converter.

**`pipeline.py`:**
- `_import_and_convert`: add `FormatPair.HDF5_TO_COG` branch → `from hdf5_to_cog import convert`
- `_import_and_validate`: add `FormatPair.HDF5_TO_COG` branch → `from hdf5_to_cog import run_checks`
- `get_credits`: add `HDF5_TO_COG` entry with h5py + rasterio credits
- Change `_import_and_convert` to forward `variable` and `group` kwargs **only for HDF5 and NetCDF branches** (not all converters). The GeoTIFF, Shapefile, and GeoJSON converters don't accept these kwargs and shouldn't need to change.

**`upload.py`:**
- Upload response shape unchanged (`{job_id, dataset_id}`) for all formats
- New `POST /api/scan/{scan_id}/convert` endpoint (see Variable Selection API above)
- Scan flow is handled inside the pipeline via SSE, not in the upload response

**`state.py`:**
- Add `scan_store: dict = {}` alongside `jobs` and `datasets`
- Add `scan_store_lock: asyncio.Lock` for concurrent access protection

**Note on `convert-url`:** The `POST /api/convert-url` endpoint follows the same two-phase pattern — it fetches the file, starts the pipeline, and if it's HDF5/NetCDF with multiple variables, the pipeline emits `scan_result` via SSE just like a file upload.

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
- SSE listener handles new `event: scan_result` event type
- When received: surface `scanResult` (scan_id + variables) to parent via new state
- Single continuous SSE connection from upload through conversion — no reconnection needed
- New `confirmVariable(scanId, variable, group)` function that POSTs to `/api/scan/{scan_id}/convert`, which resumes the pipeline; SSE then receives the normal CONVERTING → READY events

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
