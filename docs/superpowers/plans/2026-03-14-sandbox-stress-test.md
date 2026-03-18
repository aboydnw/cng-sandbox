# Sandbox Stress Test Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run 10 real-world geospatial files through the sandbox frontend UI, find and fix bugs, update the geo-conversion skills, and commit test files to the repo.

**Architecture:** Files are uploaded via the browser UI at `http://localhost:5185`. The ingestion pipeline (FastAPI + cng-toolkit) converts each file, registers it in pgSTAC or PostgreSQL, and returns a tile URL. The frontend renders the tiles on a map. Bugs are fixed atomically with one commit per issue, and propagated back to the relevant `skills/geo-conversions/<skill>/` directory.

**Tech Stack:** Docker Compose (8 services), FastAPI (ingestion), React + MapLibre + deck.gl (frontend), cng-toolkit (conversion), Chrome DevTools MCP (browser automation), rasterio/geopandas/xarray (conversion libs)

---

## Chunk 1: File Acquisition & Stack Setup

### Task 1: Verify the Docker stack

**Files:** None modified

- [ ] **Step 1: Check stack status**

```bash
cd /home/anthony/projects/map-app-builder
docker compose -f sandbox/docker-compose.yml ps
```

Expected: All 8 services (`database`, `stac-api`, `raster-tiler`, `vector-tiler`, `minio`, `minio-init`, `ingestion`, `frontend`) show `healthy` or `running`.

- [ ] **Step 2: If any service is unhealthy, check its logs**

```bash
docker compose -f sandbox/docker-compose.yml logs <service-name> --tail=30
```

Fix the issue before continuing. Common causes: database not yet healthy (wait 30s and retry `ps`), missing env vars in `.env`.

- [ ] **Step 3: Verify the frontend responds**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5185
```

Expected: `200`

- [ ] **Step 4: Verify Chrome is running for MCP**

```bash
curl -s http://127.0.0.1:9222/json/version | python3 -m json.tool | grep '"Browser"'
```

Expected: a line with the Chrome version. If it fails: `source ~/bin/start-xvfb.sh && source ~/bin/start-chrome-mcp.sh`

---

### Task 2: Download and commit repo-safe files (GeoJSON + Shapefiles)

**Files:**
- Create: `sandbox/sample-data/countries.geojson`
- Create: `sandbox/sample-data/ne_10m_airports.zip`
- Create: `sandbox/sample-data/ne_10m_admin_0_countries.zip`

- [ ] **Step 1: Create the sample-data directory if it doesn't exist**

```bash
mkdir -p /home/anthony/projects/map-app-builder/sandbox/sample-data
```

- [ ] **Step 2: Download countries GeoJSON (~4MB)**

```bash
curl -L -o sandbox/sample-data/countries.geojson \
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"
ls -lh sandbox/sample-data/countries.geojson
```

Expected: file ~3-5MB. If URL fails, use WebSearch to find the current raw GitHub URL for `ne_10m_admin_0_countries.geojson` in the nvkelso/natural-earth-vector repo.

- [ ] **Step 3: Download Natural Earth airports shapefile (~1MB)**

```bash
curl -L -o sandbox/sample-data/ne_10m_airports.zip \
  "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_airports.zip"
ls -lh sandbox/sample-data/ne_10m_airports.zip
```

Expected: file ~1MB. If the naciscdn.org URL fails, try `https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_airports.zip`

- [ ] **Step 4: Download Natural Earth countries shapefile (~5MB)**

```bash
curl -L -o sandbox/sample-data/ne_10m_admin_0_countries.zip \
  "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip"
ls -lh sandbox/sample-data/ne_10m_admin_0_countries.zip
```

Expected: file ~4-6MB.

- [ ] **Step 5: Commit these three files**

```bash
git add sandbox/sample-data/countries.geojson \
        sandbox/sample-data/ne_10m_airports.zip \
        sandbox/sample-data/ne_10m_admin_0_countries.zip
git commit -m "chore(sample-data): add GeoJSON and shapefile test fixtures"
```

---

### Task 3: Download and commit NetCDF test files

**Files:**
- Create: `sandbox/sample-data/air.mon.mean.nc`
- Create: `sandbox/sample-data/uwnd.mon.mean.nc`

- [ ] **Step 1: Download NCEP air temperature NetCDF (~8MB)**

```bash
curl -L -o sandbox/sample-data/air.mon.mean.nc \
  "https://downloads.psl.noaa.gov/Datasets/ncep.reanalysis/surface/air.mon.mean.nc"
ls -lh sandbox/sample-data/air.mon.mean.nc
```

Expected: file ~7-9MB. If this URL fails, use WebSearch for "NOAA PSL NCEP reanalysis air.mon.mean.nc download" to find the current URL.

- [ ] **Step 2: Download NCEP u-wind NetCDF (~8MB)**

```bash
curl -L -o sandbox/sample-data/uwnd.mon.mean.nc \
  "https://downloads.psl.noaa.gov/Datasets/ncep.reanalysis/pressure/uwnd.mon.mean.nc"
ls -lh sandbox/sample-data/uwnd.mon.mean.nc
```

Expected: file ~7-9MB. Note: this file contains multiple pressure levels — the pipeline will extract the first variable at timestep 0.

- [ ] **Step 3: Commit**

```bash
git add sandbox/sample-data/air.mon.mean.nc \
        sandbox/sample-data/uwnd.mon.mean.nc
git commit -m "chore(sample-data): add NetCDF test fixtures"
```

---

### Task 4: Download and commit GeoTIFF test files

**Files:**
- Create: `sandbox/sample-data/srtm_sample.tif`
- Create: `sandbox/sample-data/seaice_conc.tif`

- [ ] **Step 1: Download an SRTM GeoTIFF in UTM/projected CRS (~25MB)**

Use WebSearch to find a direct download URL for an SRTM 30m or 90m GeoTIFF tile from OpenTopography, USGS, or AWS open data. The file must be:
- A GeoTIFF
- In a projected CRS (UTM, e.g. EPSG:32612 or similar — NOT EPSG:4326)
- ~10-30MB in size

Likely sources to search for:
- "OpenTopography SRTM GeoTIFF direct download"
- "AWS Open Data Copernicus DEM GeoTIFF 30m tile"
- USGS SRTM via EarthExplorer (may require free account)

```bash
# Example (replace URL with the one found via WebSearch):
curl -L -o sandbox/sample-data/srtm_sample.tif "<URL>"
ls -lh sandbox/sample-data/srtm_sample.tif
```

Verify it has a projected CRS:
```bash
docker run --rm -v $(pwd)/sandbox/sample-data:/data ghcr.io/osgeo/gdal:ubuntu-small-latest \
  gdalinfo /data/srtm_sample.tif | grep -E "PROJCS|GEOGCS|AUTHORITY"
```

Expected: output should show a projected CRS (e.g., `PROJCS["WGS 84 / UTM zone..."`). If it shows `GEOGCS["WGS 84"` the CRS is geographic, not projected — find a different file.

- [ ] **Step 2: Acquire the polar CRS sea ice GeoTIFF (~1MB)**

**Option A (preferred):** Download from NSIDC. Requires a free NASA Earthdata account at `urs.earthdata.nasa.gov`. The dataset is NSIDC-0051 (Sea Ice Concentrations from Nimbus-7 SMMR and DMSP SSM/I-SSMIS). Use WebSearch for "NSIDC G02135 GeoTIFF download" to find the current data URL.

```bash
# After obtaining the file (filename may differ):
cp /path/to/downloaded/seaice_file.tif sandbox/sample-data/seaice_conc.tif
ls -lh sandbox/sample-data/seaice_conc.tif
```

**Option B (fallback if NSIDC account unavailable):** Generate a synthetic polar-CRS GeoTIFF with rasterio:

```python
# Run this as: python /tmp/gen_polar.py
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.crs import CRS

# EPSG:3413 - NSIDC Sea Ice Polar Stereographic North
crs = CRS.from_epsg(3413)
# A small tile in the Arctic (~500km x 500km)
transform = from_bounds(-500000, -500000, 500000, 500000, 100, 100)
data = np.random.randint(0, 100, (1, 100, 100), dtype=np.uint8)

with rasterio.open(
    "sandbox/sample-data/seaice_conc.tif",
    "w", driver="GTiff", height=100, width=100,
    count=1, dtype="uint8", crs=crs, transform=transform,
) as dst:
    dst.write(data)
print("Created sandbox/sample-data/seaice_conc.tif")
```

```bash
python /tmp/gen_polar.py
ls -lh sandbox/sample-data/seaice_conc.tif
```

Verify polar CRS:
```bash
docker run --rm -v $(pwd)/sandbox/sample-data:/data ghcr.io/osgeo/gdal:ubuntu-small-latest \
  gdalinfo /data/seaice_conc.tif | grep -E "PROJCS|AUTHORITY"
```

Expected: should show `EPSG:3413` or `NSIDC Sea Ice Polar Stereographic North`.

Note in the git commit message whether Option A or B was used.

- [ ] **Step 3: Commit**

```bash
git add sandbox/sample-data/srtm_sample.tif \
        sandbox/sample-data/seaice_conc.tif
git commit -m "chore(sample-data): add GeoTIFF test fixtures (UTM + polar CRS)"
```

---

### Task 5: Create sample-data README with large-file download links

**Files:**
- Create: `sandbox/sample-data/README.md`

- [ ] **Step 1: Create the README**

Create `sandbox/sample-data/README.md` with this content (verify the URLs are current before writing — use WebSearch if needed):

```markdown
# Sample Data

Test files for the CNG Sandbox. Small files (≤50MB) are committed here.
Large files must be downloaded separately.

## Files in this directory

| File | Format | Size | Edge Case |
|------|--------|------|-----------|
| `countries.geojson` | GeoJSON | ~4MB | Baseline vector |
| `ne_10m_airports.zip` | Shapefile | ~1MB | Uppercase column names + ZIP |
| `ne_10m_admin_0_countries.zip` | Shapefile | ~5MB | Zipped, complex polygons |
| `air.mon.mean.nc` | NetCDF | ~8MB | Single variable, multiple timesteps |
| `uwnd.mon.mean.nc` | NetCDF | ~8MB | U-wind component, multiple pressure levels |
| `srtm_sample.tif` | GeoTIFF | ~25MB | Projected CRS (UTM) |
| `seaice_conc.tif` | GeoTIFF | ~1MB | Polar CRS (EPSG:3413) |

## Large files (download separately)

| File | Source | URL | Size | Notes |
|------|--------|-----|------|-------|
| `HydroRIVERS_v10_gr_shp.zip` | HydroSHEDS | https://www.hydrosheds.org/products/hydrorivers | ~200MB | Large shapefile, line geometries. Registration required. |
| `NE1_HR_LC.tif` | Natural Earth | https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1/ | ~86MB | Large baseline raster, WGS84. |
| `cb_2023_us_county_500k.geojson` | US Census | https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html | ~60MB | Large GeoJSON, many features. Convert the .zip Shapefile to GeoJSON first if needed. |
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/sample-data/README.md
git commit -m "chore(sample-data): add README with download links for large test files"
```

---

## Chunk 2: Test Execution — Files 1–5

### Bug Fix Protocol (reference for all test tasks)

When a bug is found during any test:

**Step A — Fix the root cause:**
Identify the failure location: ingestion pipeline (`sandbox/ingestion/src/`) or frontend (`sandbox/frontend/src/`). Read the relevant file, understand the bug, write a minimal fix. Commit:
```bash
git add <changed files>
git commit -m "fix(sandbox): <description of fix>"
```

**Step B — Add a validate.py check (skip for frontend-only bugs):**
Open the relevant skill's `scripts/validate.py` (e.g., `skills/geo-conversions/geotiff-to-cog/scripts/validate.py`). Add a new `CheckResult` that would have caught the bug. Run the validator's self-test to confirm the new check works:
```bash
cd skills/geo-conversions && uv run python -m geotiff_to_cog.scripts.validate
# or: uv run python geotiff-to-cog/scripts/validate.py
```
Commit:
```bash
git add skills/geo-conversions/<skill>/scripts/validate.py
git commit -m "fix(skills): add <check-name> validation check to <skill>"
```

**Step C — Update SKILL.md (skip for frontend-only bugs):**
Open `skills/geo-conversions/<skill>/SKILL.md`. Add to "Known failure modes":
```
- **<Short title>**: <Root cause description>. Fix: <what was changed>. The validate script now checks for this.
```
Add to Changelog:
```
- 2026-03-14: <what was added/fixed>
```
Commit:
```bash
git add skills/geo-conversions/<skill>/SKILL.md
git commit -m "docs(skills): document <issue> in <skill> SKILL.md"
```

After fixing, re-run the same file through the sandbox to confirm the fix works before moving to the next test file.

---

### Task 6: Test File 1 — countries.geojson (baseline vector)

**Expected behavior:** Job reaches `ready`, map shows country polygons covering the whole world, viewport is at world zoom level.

- [ ] **Step 1: Navigate to the upload page**

Use Chrome DevTools MCP: `navigate_page` to `http://localhost:5185`. Take a screenshot to confirm the upload UI is visible.

- [ ] **Step 2: Upload the file**

Use `upload_file` MCP tool:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/countries.geojson`

- [ ] **Step 3: Wait for completion**

The frontend auto-navigates to `/map/{dataset_id}` when the job succeeds. Wait up to 10 minutes. If the page doesn't navigate automatically, poll:
```bash
# Get the latest job ID from the API
curl -s http://localhost:5185/api/datasets | python3 -m json.tool | grep '"id"' | head -1
curl -s http://localhost:5185/api/jobs/<job-id> | python3 -m json.tool | grep '"status"'
```

- [ ] **Step 4: Screenshot the result**

Use `take_screenshot`, save to `/tmp/test-01-countries.png`. Use the Read tool to inspect the screenshot visually.

Pass criteria:
- Map shows country polygon outlines covering the globe
- Viewport is zoomed to show all countries (not blank or ocean-only)
- No error banner in the UI

- [ ] **Step 5: Check console errors**

Use `list_console_messages`. Flag any ERROR-level messages. Warnings are acceptable.

- [ ] **Step 6: Document outcome**

If PASS: continue to Task 7.
If FAIL: check ingestion logs, identify root cause, apply Bug Fix Protocol above, re-run this test, then continue.

---

### Task 7: Test File 2 — ne_10m_airports.zip (uppercase columns + ZIP)

**Expected behavior:** Job reaches `ready`, map shows airport point markers scattered across the globe. This file has uppercase column names like `IATA_CODE`, `NAME`, `SCALERANK` — these must be lowercased before PostgreSQL ingest (already handled in `vector_ingest.py`, but verify).

- [ ] **Step 1: Navigate to upload page**

Use `navigate_page` to `http://localhost:5185`.

- [ ] **Step 2: Upload the file**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/ne_10m_airports.zip`

- [ ] **Step 3: Wait for completion (timeout: 10 min)**

- [ ] **Step 4: Screenshot and inspect**

Save to `/tmp/test-02-airports.png`. Read and inspect the screenshot.

Pass criteria:
- Point markers visible across the world map
- Viewport zoomed to show global extent

- [ ] **Step 5: Check console errors**

- [ ] **Step 6: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 8: Test File 3 — ne_10m_admin_0_countries.zip (zipped shapefile, complex polygons)

**Expected behavior:** Job reaches `ready`, map shows country boundary polygons. This is a larger/more complex shapefile than the GeoJSON version — tests the ZIP extraction and polygon complexity.

- [ ] **Step 1: Navigate to upload page**

- [ ] **Step 2: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/ne_10m_admin_0_countries.zip`

- [ ] **Step 3: Wait for completion (timeout: 10 min)**

- [ ] **Step 4: Screenshot**

Save to `/tmp/test-03-shp-countries.png`. Verify country polygons are visible.

- [ ] **Step 5: Check console errors**

- [ ] **Step 6: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 9: Test File 4 — air.mon.mean.nc (NetCDF, single variable, multi-timestep)

**Expected behavior:** Job reaches `ready`, map shows a global air temperature raster (continuous color gradient covering land and ocean). The pipeline extracts timestep 0 of the `air` variable. The file is in EPSG:4326.

- [ ] **Step 1: Navigate to upload page**

- [ ] **Step 2: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/air.mon.mean.nc`

- [ ] **Step 3: Wait for completion (timeout: 10 min)**

If it fails with a validation error about "unsupported dimension names", check the actual dimension names in the file:
```bash
python3 -c "import xarray as xr; ds = xr.open_dataset('sandbox/sample-data/air.mon.mean.nc'); print(ds)"
```
The netcdf-to-cog converter expects `lat`/`latitude`/`y` and `lon`/`longitude`/`x`. If the file uses different names, this is a known limitation (documented in SKILL.md), not a bug.

- [ ] **Step 4: Screenshot**

Save to `/tmp/test-04-air-temp.png`. Verify a continuous-color global raster is visible.

- [ ] **Step 5: Check console errors**

- [ ] **Step 6: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 10: Test File 5 — uwnd.mon.mean.nc (NetCDF, second variable type)

**Expected behavior:** Job reaches `ready`, map shows a global u-wind raster. This file has multiple pressure levels as a third dimension — the pipeline should automatically select the first available 2D slice.

Note: `uwnd.mon.mean.nc` may have dimensions `(time, level, lat, lon)`. The netcdf-to-cog converter selects the first data variable and squeezes extra dimensions. If it fails with a dimensionality error, this is a new bug to fix.

- [ ] **Step 1: Inspect the file's structure before uploading**

```bash
python3 -c "
import xarray as xr
ds = xr.open_dataset('sandbox/sample-data/uwnd.mon.mean.nc')
print(ds)
print('Variables:', list(ds.data_vars))
print('Dims:', dict(ds.dims))
"
```

Note the dimensions and variable names. If the file has a `level` dimension in addition to `time`, `lat`, `lon`, the conversion may fail — watch for this.

- [ ] **Step 2: Navigate to upload page**

- [ ] **Step 3: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/uwnd.mon.mean.nc`

- [ ] **Step 4: Wait for completion (timeout: 10 min)**

- [ ] **Step 5: Screenshot**

Save to `/tmp/test-05-uwnd.png`. Verify a continuous-color global raster is visible.

- [ ] **Step 6: Check console errors**

- [ ] **Step 7: Document outcome and apply Bug Fix Protocol if needed**

---

## Chunk 3: Test Execution — Files 6–10

### Task 11: Test File 6 — srtm_sample.tif (projected CRS — UTM)

**Expected behavior:** Job reaches `ready`, map shows terrain elevation data for the tile's geographic area. This is the regression test for the projected CRS bounds fix — STAC must receive WGS84 bounds, not UTM bounds.

- [ ] **Step 1: Navigate to upload page**

- [ ] **Step 2: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/srtm_sample.tif`

- [ ] **Step 3: Wait for completion (timeout: 10 min)**

If it fails with a bounds-related error or titiler returns no tiles (status `ready` but map is blank), check `pipeline.py:_extract_bounds` — it should be reprojecting bounds from UTM to EPSG:4326. Also check the STAC item bounds via:
```bash
curl -s http://localhost:8081/collections | python3 -m json.tool | grep '"id"'
# Then:
curl -s "http://localhost:8081/collections/<collection-id>/items" | python3 -m json.tool | grep -A4 '"bbox"'
```

Expected bbox should be in degrees (e.g., `[-112.0, 36.0, -111.0, 37.0]`), not meters.

- [ ] **Step 4: Screenshot**

Save to `/tmp/test-06-srtm.png`. Verify terrain data is visible in the correct location (should be in the western US or wherever the tile covers).

- [ ] **Step 5: Check console errors**

- [ ] **Step 6: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 12: Test File 7 — seaice_conc.tif (polar CRS — EPSG:3413)

**Expected behavior:** Job reaches `ready`. This is the regression test for the Mercator bounds clamping fix — the WGS84 bounds must be clamped to ±85.051129° before being passed to the deck.gl viewport. If the fix is working, the map should render (possibly showing the Arctic region or a default zoom). Without the fix, the map would be blank due to NaN viewport values.

- [ ] **Step 1: Navigate to upload page**

- [ ] **Step 2: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/seaice_conc.tif`

- [ ] **Step 3: Wait for completion (timeout: 10 min)**

- [ ] **Step 4: Screenshot and inspect carefully**

Save to `/tmp/test-07-seaice.png`. Read and inspect.

Key things to check:
- Is the map blank? If so, check browser console for NaN-related errors in fitBounds — this is the regression.
- Does the map show the Arctic region at some reasonable zoom?
- Are tiles loading (check network requests in console)?

- [ ] **Step 5: Check console errors**

Pay special attention to any `NaN` or `Infinity` in viewport-related errors.

- [ ] **Step 6: Check WebGL status**

```javascript
// Evaluate in browser via MCP:
const c = document.createElement('canvas');
const gl = c.getContext('webgl2');
gl ? gl.getParameter(gl.RENDERER) : 'NO WEBGL'
```

Use `evaluate_script` MCP tool. Expected: a renderer string (e.g., `"Google SwiftShader"`), not `"NO WEBGL"`.

- [ ] **Step 7: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 13: Test File 8 — HydroRIVERS_v10_gr_shp.zip (~200MB, large shapefile)

**Note:** This file is too large for the repo. It must be downloaded before this test. If already present in `sandbox/sample-data/` from a previous session, reuse it.

- [ ] **Step 1: Check if the file already exists**

```bash
ls -lh sandbox/sample-data/HydroRIVERS_v10_gr_shp.zip 2>/dev/null || echo "not found"
```

If not found: download from `https://www.hydrosheds.org/products/hydrorivers`. Registration is required; use WebSearch to find a direct download link or use the HydroSHEDS download portal.

- [ ] **Step 2: Navigate to upload page**

- [ ] **Step 3: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/HydroRIVERS_v10_gr_shp.zip`

- [ ] **Step 4: Wait for completion (timeout: 10 min — large file)**

A 200MB shapefile will take significantly longer than smaller files. Monitor ingestion logs if it seems stuck:
```bash
docker compose -f sandbox/docker-compose.yml logs ingestion --follow
```
(Ctrl-C after status changes to `ready` or `failed`)

- [ ] **Step 5: Screenshot**

Save to `/tmp/test-08-hydrorivers.png`. Verify river line geometries are visible.

- [ ] **Step 6: Check console errors**

- [ ] **Step 7: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 14: Test File 9 — NE1_HR_LC.tif (~86MB, large GeoTIFF, WGS84)

**Note:** This file is too large for the repo. Download from Natural Earth before this test.

- [ ] **Step 1: Check if the file already exists**

```bash
ls -lh sandbox/sample-data/NE1_HR_LC.tif 2>/dev/null || echo "not found"
```

If not found: use WebSearch for "Natural Earth NE1_HR_LC.tif download" to find the current download URL from `naturalearthdata.com`. The file is typically in a zip archive.

- [ ] **Step 2: Navigate to upload page**

- [ ] **Step 3: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/NE1_HR_LC.tif`

- [ ] **Step 4: Wait for completion (timeout: 10 min)**

- [ ] **Step 5: Screenshot**

Save to `/tmp/test-09-ne1-raster.png`. Verify a global shaded relief / land cover raster is visible across the world map.

- [ ] **Step 6: Check console errors**

- [ ] **Step 7: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 15: Test File 10 — cb_2023_us_county_500k.geojson (~60MB, large GeoJSON)

**Note:** This file is too large for the repo. Download before testing.

- [ ] **Step 1: Check if the file exists**

```bash
ls -lh sandbox/sample-data/cb_2023_us_county_500k.geojson 2>/dev/null || echo "not found"
```

If not found: the US Census Bureau provides this as a shapefile. Download the county 500k shapefile from the Census cartographic boundary page and convert to GeoJSON:

```bash
# Download the shapefile zip
curl -L -o /tmp/cb_2023_us_county_500k.zip \
  "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip"

# Convert to GeoJSON using GDAL (via Docker to avoid local install)
docker run --rm -v /tmp:/data ghcr.io/osgeo/gdal:ubuntu-small-latest \
  ogr2ogr -f GeoJSON /data/cb_2023_us_county_500k.geojson \
  /vsizip//data/cb_2023_us_county_500k.zip

cp /tmp/cb_2023_us_county_500k.geojson sandbox/sample-data/
ls -lh sandbox/sample-data/cb_2023_us_county_500k.geojson
```

If the Census URL fails, use WebSearch for "US Census 2023 county 500k shapefile download".

- [ ] **Step 2: Navigate to upload page**

- [ ] **Step 3: Upload**

`upload_file`:
- Selector: `input[type="file"]`
- File path: `/home/anthony/projects/map-app-builder/sandbox/sample-data/cb_2023_us_county_500k.geojson`

- [ ] **Step 4: Wait for completion (timeout: 10 min)**

A 60MB GeoJSON will take a while to parse and convert. If the ingestion times out or OOM-fails, this is a new bug — check memory limits in `docker-compose.yml`.

- [ ] **Step 5: Screenshot**

Save to `/tmp/test-10-us-counties.png`. Verify US county polygons are visible across the continental US.

- [ ] **Step 6: Check console errors**

- [ ] **Step 7: Document outcome and apply Bug Fix Protocol if needed**

---

### Task 16: Final commit and cleanup

- [ ] **Step 1: Verify all sample-data files are committed**

```bash
git status sandbox/sample-data/
```

Expected: clean (no untracked files). If any files are unstaged, add and commit them.

- [ ] **Step 2: Summarize test results**

Write a brief summary comment in `sandbox/sample-data/README.md` under a `## Test Results` heading with the date, which files passed/failed, and any bugs fixed. Commit:

```bash
git add sandbox/sample-data/README.md
git commit -m "docs(sample-data): add stress test results summary"
```

- [ ] **Step 3: Close browser tabs**

Use `close_page` MCP tool to close any open browser tabs. Do NOT run `pkill -f chrome` — it will kill the MCP server.
