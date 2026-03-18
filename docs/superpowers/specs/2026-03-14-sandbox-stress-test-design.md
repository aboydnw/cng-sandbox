# Sandbox Stress Test Design

**Date:** 2026-03-14
**Scope:** CNG Sandbox (`sandbox/`) — ingestion pipeline, frontend UI, geo-conversion skills

## Goal

Stress-test the sandbox with 10 real-world geospatial files of varying formats, sizes, and edge cases. Identify bugs, fix them, update the relevant skills, and commit test files to the repo for manual testing.

## Supported Formats

The sandbox accepts four format pairs:

| Input | Output | Pipeline |
|-------|--------|----------|
| GeoTIFF (`.tif`, `.tiff`) | Cloud-Optimized GeoTIFF | GeoTIFF → COG → MinIO → pgSTAC → titiler-pgstac |
| Shapefile (`.shp`, `.zip`) | GeoParquet | Shapefile → GeoParquet → PostgreSQL → tipg |
| GeoJSON (`.geojson`, `.json`) | GeoParquet | GeoJSON → GeoParquet → PostgreSQL → tipg |
| NetCDF (`.nc`, `.nc4`) | Cloud-Optimized GeoTIFF | NetCDF → COG → MinIO → pgSTAC → titiler-pgstac |

## Skill paths

The four conversion skills that must be updated when bugs are found:

| Format | Skill path |
|--------|-----------|
| GeoTIFF → COG | `skills/geo-conversions/geotiff-to-cog/` |
| Shapefile → GeoParquet | `skills/geo-conversions/shapefile-to-geoparquet/` |
| GeoJSON → GeoParquet | `skills/geo-conversions/geojson-to-geoparquet/` |
| NetCDF → COG | `skills/geo-conversions/netcdf-to-cog/` |

## Test Files

One file per targeted edge case, plus baselines. Ordered by increasing complexity/risk.

| # | Format | Filename | Source | Est. Size | Edge Case | Repo? |
|---|--------|----------|--------|-----------|-----------|-------|
| 1 | GeoJSON | `countries.geojson` | github.com/nvkelso/natural-earth-vector | ~4MB | Baseline vector | ✅ commit |
| 2 | Shapefile | `ne_10m_airports.zip` | naturalearthdata.com | ~1MB | Uppercase column names + ZIP | ✅ commit |
| 3 | Shapefile | `ne_10m_admin_0_countries.zip` | naturalearthdata.com | ~5MB | Zipped, complex polygons | ✅ commit |
| 4 | NetCDF | `air.mon.mean.nc` | psl.noaa.gov/data/gridded/data.ncep.reanalysis.html | ~8MB | Single variable, multiple timesteps | ✅ commit |
| 5 | NetCDF | `uwnd.mon.mean.nc` | psl.noaa.gov/data/gridded/data.ncep.reanalysis.html | ~8MB | Second variable (u-wind) — second separate upload after #4 | ✅ commit |
| 6 | GeoTIFF | `srtm_sample.tif` | opentopography.org (Global 1 Arc-Second, no account needed) | ~25MB | Projected CRS (UTM) — tests STAC bounds reprojection fix | ✅ commit |
| 7 | GeoTIFF | `seaice_conc.tif` | nsidc.org/data/g02135 (requires free NASA Earthdata account) | ~1MB | Polar CRS (EPSG:3413) — tests Mercator clamping fix | ✅ commit |
| 8 | Shapefile | `HydroRIVERS_v10_gr_shp.zip` | hydrosheds.org | ~200MB | Large file, line geometries | ⬇️ link only |
| 9 | GeoTIFF | `NE1_HR_LC.tif` | naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1 | ~86MB | Large baseline raster, WGS84 | ⬇️ link only |
| 10 | GeoJSON | `cb_2023_us_county_500k.geojson` | census.gov/geographies/mapping-files | ~60MB | Large, many features | ⬇️ link only |

### File acquisition

Files marked ✅ must be downloaded and committed to `sandbox/sample-data/` before testing begins. Use direct download URLs found during implementation; no scripting required.

The NSIDC sea ice file (#7) requires a free NASA Earthdata account at `urs.earthdata.nasa.gov`. If unavailable, substitute any other small GeoTIFF in a polar CRS (EPSG:3413 or EPSG:3031) — e.g., generate one synthetically with rasterio — to ensure the Mercator clamping regression is still covered. Note the substitution in test results.

Files marked ⬇️ are too large for the repo. Their download links and source credits go in `sandbox/sample-data/README.md` (create this file if it doesn't exist; format: a markdown table with columns: File, Source, URL, Size, Notes).

### NetCDF time-index behavior

The sandbox frontend does not expose a `--time-index` control. The ingestion pipeline always extracts timestep 0 by default. For files #4 and #5, the expected behavior is that the first timestep is displayed. This is expected and correct — no UI change is needed. The test verifies that the pipeline selects a valid timestep automatically.

## Test Methodology

### Stack health check

Before testing, confirm the stack is ready:

```bash
docker compose -f sandbox/docker-compose.yml ps
```

All 8 services must show `healthy` or `running` status: `database`, `stac-api`, `raster-tiler`, `vector-tiler`, `minio`, `minio-init`, `ingestion`, `frontend`. If a service shows `unhealthy` or `exited`, check its logs: `docker compose -f sandbox/docker-compose.yml logs <service>`.

### Per-file test steps

1. **Navigate to frontend** — open `http://localhost:5185` (the upload page, route `/`) via Chrome DevTools MCP
2. **Upload the file** — use the `upload_file` MCP tool targeting `input[type="file"]` on the upload page
3. **Wait for completion** — the frontend subscribes to SSE and auto-navigates to the map page when the job reaches `ready`. Poll the job status via the API endpoint `GET /api/jobs/{id}` if needed. Timeout: 10 minutes. If status is still not terminal after 10 minutes, declare the test hung and check container logs.
4. **Screenshot the result** — capture the map page (route `/map/{dataset_id}`) or the error state; save to `/tmp/test-<n>-<filename>.png`
5. **Check console errors** — `list_console_messages` to catch silent JS failures at ERROR level
6. **Document outcome** — see pass/fail criteria below

If a file causes an unhandled exception in the ingestion container (not a validation error — a crash), check container logs: `docker compose -f sandbox/docker-compose.yml logs ingestion --tail=50`. Do not restart the stack; other containers are unaffected. Continue to the next file.

### Pass/fail criteria

A test **passes** if all of the following are true:
- Job status reaches `ready` (not `failed`)
- The frontend shows a map with visible tiles in the correct geographic location
- The map viewport is zoomed to the data extent (not stuck at world level or showing empty ocean)
- No ERROR-level messages in the browser console related to tile loading or map rendering
- Console warnings are acceptable

A test **fails** if any of the following occur:
- Job status is `failed`
- Map renders blank (no tiles visible) despite a `ready` status
- Map viewport is incorrect (wrong location or zoom)
- Console shows tile fetch errors (4xx/5xx responses)

A test produces a **visual defect** (separate from pass/fail) if tiles render but the data looks wrong (e.g., color scale is uncalibrated, features are outside expected bounds). Document but do not block.

### Test order

Files are tested in table order (#1–#10): smallest/simplest first for fast feedback. Each test is independent — the stack is not wiped between uploads; the datasets list accumulates.

### Bug classification

| Category | Examples | Fix location |
|----------|----------|-------------|
| Ingestion pipeline | CRS reprojection, column names, file parsing | `sandbox/ingestion/src/` |
| Frontend rendering | Blank map, wrong bounds, tile URL errors | `sandbox/frontend/src/` |
| Skill validation gap | A known failure not caught by `validate.py` | `skills/geo-conversions/<skill>/scripts/validate.py` |

## Bug Fix Protocol

Every bug found during this testing cycle must be addressed in three places:

1. **Fix the root cause** — in `sandbox/ingestion/src/` or `sandbox/frontend/src/`. One atomic git commit per bug with a `fix(sandbox):` prefix.
2. **Update `validate.py`** — add a `CheckResult` to the relevant skill's `scripts/validate.py` that would have caught the issue. One commit with a `fix(skills):` prefix.
3. **Update `SKILL.md`** — in the relevant skill's `SKILL.md`, add:
   - A new entry under "Known failure modes" with root cause and fix
   - A new line in the Changelog with today's date

If the bug is in the ingestion pipeline but not related to any conversion skill (e.g., a frontend rendering bug), skip steps 2–3.

## Deliverables

| Deliverable | Location |
|-------------|----------|
| Repo-safe test files (files #1–#7) | `sandbox/sample-data/` |
| Download links for large files (#8–#10) | `sandbox/sample-data/README.md` |
| Bug fixes (one commit each) | `sandbox/ingestion/`, `sandbox/frontend/` |
| Updated validation scripts | `skills/geo-conversions/<skill>/scripts/validate.py` |
| Updated skill docs | `skills/geo-conversions/<skill>/SKILL.md` |

## Known Pre-existing Edge Cases (regression checks)

These were fixed in earlier sessions and should pass. If they fail, it's a regression.

- Projected CRS bounds reprojected to WGS84 before STAC registration (`geotiff-to-cog`)
- Polar CRS bounds clamped to ±85.051129° for Mercator viewport (`geotiff-to-cog`)
- Uppercase column names lowercased before PostgreSQL ingest (`shapefile-to-geoparquet`)
- Zipped shapefiles with nested directory structures (`shapefile-to-geoparquet`)
