# CNG Sandbox Phase 3: Integration, CI/CD, and Containerization — Design Spec

## Goal

Wire together Phases 0–2 into a working end-to-end pipeline, fix known bugs, add CI, and containerize everything so it's deployment-ready. After Phase 3, `docker compose up` starts the entire sandbox and a user can upload a file and see it on a map.

## Scope

**In scope:**
- CLI toolkit packaging (blocker for real uploads)
- Bug fixes surfaced during Phase 2
- E2E validation of all conversion paths
- GitHub Actions CI (lint + unit tests)
- Ingestion service Dockerfile
- Docker Compose update (add ingestion + frontend services)

**Out of scope (Phase 4):**
- AWS production deployment (eoAPI CDK, ECS, CloudFront)
- S3 lifecycle policy enforcement
- Domain routing (sandbox.devseed.com)
- Persistent job/dataset state (in-memory dicts are fine for demo)
- Production environment variables

---

## 3A. CLI Toolkit Packaging

**Problem:** The ingestion service's `pipeline.py` dynamically imports converters (`from geotiff_to_cog import convert`). This fails at runtime because `skills/geo-conversions/` isn't on the Python path. Tests pass only because converters are mocked.

**Solution:**
1. Install the existing `skills/geo-conversions/` package into a clean venv and confirm all four converter modules import correctly (`from geotiff_to_cog import convert`, etc.). Fix any packaging issues found.
2. Add `cng-toolkit` as a path dependency in `sandbox/ingestion/pyproject.toml`: `cng-toolkit = {path = "../../skills/geo-conversions", extras = ["all"]}`
3. Verify `from geotiff_to_cog import convert` and `from geotiff_to_cog import run_checks` resolve in the ingestion venv
4. Verify `pipeline.py`'s dynamic import logic matches the actual module/function signatures exposed by each converter's `__init__.py`

**Validation:** Run `python -c "from geotiff_to_cog import convert; print('ok')"` in the ingestion venv.

---

## 3B. Bug Fixes (Known Gaps from Phase 2)

### 3B-1. Bounds not reaching frontend

**Symptom:** Pipeline extracts bounds correctly, but the dataset's `bounds` field is `null` when the frontend fetches `/api/datasets/{id}`.

**Investigation approach:**
1. Trace the pipeline: does `_extract_bounds()` return valid bounds?
2. Does the `Dataset` model in `state.py` receive the bounds?
3. Does the `/api/datasets/{id}` response serialize bounds correctly?
4. Is there a race condition where the frontend fetches before the pipeline writes bounds?

**Fix:** Root cause TBD — requires a real converter running (depends on 3A). Time-box investigation to 2 hours. If the root cause isn't found within the time-box, ship the workaround: fetch bounds from the STAC item metadata (which is known to have correct bounds from ingestion) and pass them to the frontend via the `/api/datasets/{id}` response. File a follow-up bug for the pipeline bounds extraction.

### 3B-2. RasterMap hardcoded zoom

**Symptom:** RasterMap uses `zoom: 3` instead of fitting to dataset bounds. VectorMap correctly uses `fitBounds()`.

**Fix:** Use deck.gl's `WebMercatorViewport.fitBounds()` to compute initial view state from the dataset's bounding box. The bounds are available from the `/api/datasets/{id}` response. Pattern:
```typescript
import { WebMercatorViewport } from '@deck.gl/core';

const viewport = new WebMercatorViewport({ width: 800, height: 600 });
const { longitude, latitude, zoom } = viewport.fitBounds(
  [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
  { padding: 40 }
);
```

**Depends on:** 3B-1 (bounds must actually reach the frontend).

### 3B-3. Missing backend test coverage

**Tests to add:**
- `_extract_bounds()` — raster path (mock rasterio) and vector path (mock geopandas)
- `POST /api/convert-url` — happy path (mock httpx fetch + pipeline) and error cases (invalid URL scheme, unreachable URL)

---

## 3C. E2E Validation

After 3A and 3B, manually test all conversion paths with real data against the local Docker Compose stack.

| Test | Input | Expected result |
|------|-------|-----------------|
| GeoTIFF upload | Any `.tif` file | COG tiles render via titiler-pgstac (:8082), credits show rio-cogeo |
| Shapefile upload | `.zip` containing .shp + companions | Vector tiles render via tipg (:8083), credits show GeoPandas |
| GeoJSON upload | Any `.geojson` file | Same vector path as shapefile |
| NetCDF upload | Any `.nc` file with georeferenced variable | COG tiles render, credits show xarray + rio-cogeo |
| URL ingestion | Public HTTP URL to a GeoTIFF | Same as file upload path |
| SSRF prevention | `file:///etc/passwd` | 422 rejection |
| Wrong format | Upload a `.pdf` | Rejected with clear error |
| Oversized file | >1GB upload | Rejected before processing |
| Shareable URL | Copy URL → open in incognito | Same map + credits render |
| Expired dataset | Navigate to `/expired/anything` | Expiry page with CTAs |
| Rate limiting | 6 rapid uploads | 429 on the 6th |

**Test data:** Use small real-world files. Good sources:
- GeoTIFF: Natural Earth raster or a small Landsat scene
- Shapefile: Natural Earth countries
- GeoJSON: USGS earthquake feed (already used in test apps)
- NetCDF: A small ERA5 or NOAA climate file

---

## 3D. CI/CD — GitHub Actions

Single workflow file: `.github/workflows/sandbox-ci.yml`

**Triggers:** Push to `main`, PRs touching `sandbox/**` or `skills/geo-conversions/**`.

**Jobs (run in parallel):**

### Backend job
- Python 3.13, install system deps (libmagic)
- Install `cng-toolkit[all]` from `skills/geo-conversions/`
- Install ingestion deps from `sandbox/ingestion/pyproject.toml`
- Run `python -m pytest tests/ -v`

### Frontend job
- Node 20, `npm ci` in `sandbox/frontend/`
- Run `npx tsc --noEmit` (type check)
- Run `npx vitest run` (unit tests)

**Not included (Phase 4):** Integration tests requiring Docker Compose (eoAPI stack). These are manual in Phase 3.

---

## 3E. Ingestion Service Dockerfile

Multi-stage build:

**Stage 1 (builder):**
- Base: `python:3.13-slim`
- Install system deps: `libgdal-dev`, `libmagic1`, `gcc`
- Copy `skills/geo-conversions/` and install `cng-toolkit[all]`
- Copy `sandbox/ingestion/` and install deps

**Stage 2 (runtime):**
- Base: `python:3.13-slim`
- Install runtime-only system deps: `libgdal34`, `libmagic1`
- Copy installed packages from builder
- Expose port 8000
- CMD: `uvicorn src.app:app --host 0.0.0.0 --port 8000`

**Build context:** Must be the repo root (not `sandbox/ingestion/`) so the Dockerfile can COPY both `skills/geo-conversions/` and `sandbox/ingestion/`.

Location: `sandbox/ingestion/Dockerfile`

---

## 3F. Docker Compose Update

Add two services to `sandbox/docker-compose.yml`:

### ingestion service
- Build from `sandbox/ingestion/Dockerfile` (context: repo root)
- Port 8000
- Depends on: database, minio, stac-api, raster-tiler, vector-tiler
- Environment (from `config.py` Settings class, overridden for Docker networking):
  - `S3_ENDPOINT=http://minio:9000`
  - `STAC_API_URL=http://stac-api:8081`
  - `RASTER_TILER_URL=http://raster-tiler:8082`
  - `VECTOR_TILER_URL=http://vector-tiler:8083`
  - `POSTGRES_DSN=postgresql://sandbox:sandbox_dev_password@database:5432/postgis`
  - `CORS_ORIGINS=["http://localhost:5185"]`
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` from `.env`
- Health check: `curl http://localhost:8000/api/health`

### frontend service
- Build from `sandbox/frontend/Dockerfile`
- Simple single-stage Dockerfile for Phase 3 (dev mode):
  - Base: `node:20-slim`
  - `WORKDIR /app`, copy `package.json` + `package-lock.json`, `npm ci`, copy source
  - CMD: `npx vite --host` (hot reload on port 5185)
  - Phase 4 switches to a multi-stage prod build (Vite build → nginx/serve). Note: `VITE_*` env vars are baked in at build time, so the prod Dockerfile will need build args instead of runtime env vars.
- Port 5185
- Environment: `VITE_API_BASE`, `VITE_RASTER_TILER_URL`, `VITE_VECTOR_TILER_URL` point at compose service hostnames

### Frontend build configuration

The frontend's `src/config.ts` already reads `VITE_API_BASE`, `VITE_RASTER_TILER_URL`, `VITE_VECTOR_TILER_URL` from environment. No code changes needed — Docker Compose passes the right values via the frontend service's environment block. For local development outside Docker, the existing Vite proxy (`/api` → `localhost:8000`) continues to work.

### Updated CORS
- Ingestion service's `cors_origins` setting needs `http://localhost:5185` added (the frontend's port)

### One-command startup
After this change: `cd sandbox && docker compose up` starts everything. No manual venv activation or separate terminal windows.

---

## Dependencies Between Tasks

```
3A (toolkit packaging)
 ├──▶ 3B-1 (bounds bug — needs real converter to investigate)
 │     └──▶ 3B-2 (zoom fix — needs bounds working)
 ├──▶ 3C (E2E testing — needs working pipeline)
 └──▶ 3E (Dockerfile — needs toolkit installable)
      └──▶ 3F (Compose update — needs Dockerfile)

3B-3 (backend tests) — independent, can run in parallel with 3A
3D (CI/CD) — independent, can run in parallel with 3A
```

**Critical path:** 3A → 3E → 3F → 3C (E2E testing needs the full Compose stack running)

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| GDAL version mismatch between host and Docker | Medium | Pin GDAL version in Dockerfile, test with same version locally |
| cng-toolkit import paths don't match pipeline.py expectations | Medium | Verify module structure in 3A before moving on |
| eoAPI services need schema/config changes for real data | Low | Already tested with STAC ingest in Phase 1 unit tests |
| Large GeoTIFF conversion OOMs in Docker | Low | Set memory limits in compose, test with realistic file sizes |

---

## Success Criteria

Phase 3 is done when:
1. `docker compose up` in `sandbox/` starts all services (eoAPI + ingestion + frontend)
2. A user can upload a GeoTIFF, Shapefile, or GeoJSON and see tiles on the map
3. Bounds auto-zoom works for both raster and vector
4. Credits panel shows correct tools per format
5. Shareable URL works in a separate browser session
6. CI pipeline passes on a clean PR
7. All existing tests continue to pass (29 backend + 15 frontend)
