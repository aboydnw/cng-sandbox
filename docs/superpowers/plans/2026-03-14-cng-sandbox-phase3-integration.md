# CNG Sandbox Phase 3: Integration, CI/CD, and Containerization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire together the CLI toolkit (Phase 0), ingestion service (Phase 1), and frontend (Phase 2) into a working end-to-end pipeline, fix known bugs, add CI, and containerize everything.

**Architecture:** No new architecture — this phase connects existing pieces. The CLI toolkit becomes a pip dependency of the ingestion service. Two Dockerfiles get added (ingestion + frontend). Docker Compose is extended so `docker compose up` starts everything.

**Tech Stack:** Python 3.13, FastAPI, setuptools, Docker, GitHub Actions, deck.gl (WebMercatorViewport), Vitest, pytest

**Spec:** `docs/superpowers/specs/2026-03-14-cng-sandbox-phase3-integration-design.md`

---

## Chunk 1: CLI Toolkit Packaging + Backend Tests

### Task 1: Verify cng-toolkit packaging works

**Files:**
- Modify: `skills/geo-conversions/pyproject.toml`
- Modify: `sandbox/ingestion/pyproject.toml:10-24`

The toolkit's `pyproject.toml` already maps package names to directories (`geotiff_to_cog = "geotiff-to-cog"`, etc.). We need to verify this actually works when installed, then wire it as a dependency of the ingestion service.

- [ ] **Step 1: Test-install cng-toolkit in a temporary venv**

```bash
cd /home/anthony/projects/map-app-builder
python -m venv /tmp/cng-test-venv
/tmp/cng-test-venv/bin/pip install -e "skills/geo-conversions[all]"
```

Expected: installs without errors.

- [ ] **Step 2: Verify all four converter modules import**

```bash
/tmp/cng-test-venv/bin/python -c "
from geotiff_to_cog import convert, run_checks; print('geotiff_to_cog OK')
from shapefile_to_geoparquet import convert, run_checks; print('shapefile_to_geoparquet OK')
from geojson_to_geoparquet import convert, run_checks; print('geojson_to_geoparquet OK')
from netcdf_to_cog import convert, run_checks; print('netcdf_to_cog OK')
"
```

Expected: all four print "OK". If any fail, fix the `pyproject.toml` package-dir mapping or the module's `__init__.py`.

- [ ] **Step 3: Clean up test venv**

```bash
rm -rf /tmp/cng-test-venv
```

- [ ] **Step 4: Document the cng-toolkit install requirement**

setuptools doesn't support relative path dependencies in `pyproject.toml`. The cng-toolkit must be installed as a separate step, both locally and in the Dockerfile. Add a comment to `sandbox/ingestion/pyproject.toml` above the dependencies:

```toml
# NOTE: Also requires cng-toolkit[all] installed from skills/geo-conversions/.
# Install separately: pip install -e ../../skills/geo-conversions[all]
# (setuptools doesn't support relative path deps in pyproject.toml)
```

The Dockerfile (Task 6) handles this with two separate `pip install` steps.

- [ ] **Step 5: Verify pipeline imports work in the ingestion venv**

```bash
cd sandbox/ingestion
pip install -e ../../skills/geo-conversions[all]
python -c "from geotiff_to_cog import convert; print('pipeline import OK')"
```

Expected: "pipeline import OK"

- [ ] **Step 6: Verify pipeline.py's _import_and_convert matches the toolkit API**

Run the converter's function signatures to confirm they accept the arguments pipeline.py passes:

```bash
cd sandbox/ingestion
python -c "
import inspect
from geotiff_to_cog import convert, run_checks
print('convert sig:', inspect.signature(convert))
print('run_checks sig:', inspect.signature(run_checks))
"
```

Expected: both should accept `(input_path, output_path, **kwargs)`. The pipeline calls `convert(input_path, output_path, verbose=True)` and `run_checks(input_path, output_path)`.

- [ ] **Step 7: Commit**

```bash
git add sandbox/ingestion/pyproject.toml
git commit -m "feat(sandbox): document cng-toolkit as ingestion dependency"
```

---

### Task 2: Add missing backend tests — _extract_bounds()

**Files:**
- Create: `sandbox/ingestion/tests/test_bounds.py`
- Reference: `sandbox/ingestion/src/services/pipeline.py:41-52`

- [ ] **Step 1: Write failing tests for _extract_bounds**

Create `sandbox/ingestion/tests/test_bounds.py`:

```python
from unittest.mock import MagicMock, patch

from src.models import DatasetType
from src.services.pipeline import _extract_bounds


@patch("src.services.pipeline.rasterio")
def test_extract_bounds_raster(mock_rasterio):
    mock_src = MagicMock()
    mock_src.bounds = MagicMock(left=-180.0, bottom=-90.0, right=180.0, top=90.0)
    mock_rasterio.open.return_value.__enter__ = MagicMock(return_value=mock_src)
    mock_rasterio.open.return_value.__exit__ = MagicMock(return_value=False)

    result = _extract_bounds("/fake/output.tif", DatasetType.RASTER)

    assert result == [-180.0, -90.0, 180.0, 90.0]
    mock_rasterio.open.assert_called_once_with("/fake/output.tif")


@patch("src.services.pipeline.gpd")
def test_extract_bounds_vector(mock_gpd):
    import numpy as np

    mock_gdf = MagicMock()
    mock_gdf.total_bounds = np.array([-73.99, 40.70, -73.97, 40.72])
    mock_gpd.read_parquet.return_value = mock_gdf

    result = _extract_bounds("/fake/output.parquet", DatasetType.VECTOR)

    assert result == [-73.99, 40.70, -73.97, 40.72]
    mock_gpd.read_parquet.assert_called_once_with("/fake/output.parquet")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion
python -m pytest tests/test_bounds.py -v
```

Expected: FAIL — `_extract_bounds` uses local imports (`import rasterio`, `import geopandas as gpd`), so the patch paths need to target the local import inside the function. The local import pattern means we need to patch at the module level where they're imported.

- [ ] **Step 3: Fix the patch targets to match the lazy import pattern**

The function does `import rasterio` inside the function body (line 44) and `import geopandas as gpd` (line 49). For `unittest.mock.patch` to work with local imports, we patch the module being imported, not a module attribute. Use `patch.dict("sys.modules", ...)` or restructure the patches:

```python
from unittest.mock import MagicMock, patch
import sys

from src.models import DatasetType


def test_extract_bounds_raster():
    mock_rasterio = MagicMock()
    mock_src = MagicMock()
    mock_src.bounds = MagicMock(left=-180.0, bottom=-90.0, right=180.0, top=90.0)
    mock_rasterio.open.return_value.__enter__ = MagicMock(return_value=mock_src)
    mock_rasterio.open.return_value.__exit__ = MagicMock(return_value=False)

    with patch.dict(sys.modules, {"rasterio": mock_rasterio}):
        from src.services.pipeline import _extract_bounds
        result = _extract_bounds("/fake/output.tif", DatasetType.RASTER)

    assert result == [-180.0, -90.0, 180.0, 90.0]


def test_extract_bounds_vector():
    import numpy as np

    mock_gpd = MagicMock()
    mock_gdf = MagicMock()
    mock_gdf.total_bounds = np.array([-73.99, 40.70, -73.97, 40.72])
    mock_gpd.read_parquet.return_value = mock_gdf

    with patch.dict(sys.modules, {"geopandas": mock_gpd}):
        from src.services.pipeline import _extract_bounds
        result = _extract_bounds("/fake/output.parquet", DatasetType.VECTOR)

    assert result == [-73.99, 40.70, -73.97, 40.72]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd sandbox/ingestion
python -m pytest tests/test_bounds.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/tests/test_bounds.py
git commit -m "test(sandbox): add unit tests for _extract_bounds"
```

---

### Task 3: Add missing backend tests — convert-url route

**Files:**
- Create: `sandbox/ingestion/tests/test_convert_url.py`
- Reference: `sandbox/ingestion/src/routes/upload.py:72-117`

- [ ] **Step 1: Write SSRF prevention tests for POST /api/convert-url**

Create `sandbox/ingestion/tests/test_convert_url.py`:

```python
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from src.app import create_app
from src.config import Settings


@pytest.fixture
def client():
    settings = Settings(
        s3_endpoint="http://fake:9000",
        stac_api_url="http://fake:8081",
        cors_origins=["*"],
    )
    app = create_app(settings=settings)
    with patch("src.app.boto3") as mock_boto3:
        mock_boto3.client.return_value = MagicMock()
        with TestClient(app) as c:
            yield c


def test_convert_url_rejects_file_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "file:///etc/passwd"})
    assert resp.status_code == 422


def test_convert_url_rejects_ftp_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "ftp://example.com/data.tif"})
    assert resp.status_code == 422


def test_convert_url_rejects_empty_scheme(client):
    resp = client.post("/api/convert-url", json={"url": "/etc/passwd"})
    assert resp.status_code == 422
```

These test the SSRF prevention in `upload.py:20-25` (pydantic `field_validator` on `ConvertUrlRequest`). The happy-path test (mocking httpx async streaming) is deferred — it's brittle and the SSRF cases are the critical coverage gap identified in the spec.

- [ ] **Step 2: Run tests**

```bash
cd sandbox/ingestion
python -m pytest tests/test_convert_url.py -v
```

Expected: 3 passed.

- [ ] **Step 3: Run all backend tests to verify no regressions**

```bash
cd sandbox/ingestion
python -m pytest tests/ -v
```

Expected: all tests pass (29 existing + new ones).

- [ ] **Step 4: Commit**

```bash
git add sandbox/ingestion/tests/test_convert_url.py
git commit -m "test(sandbox): add convert-url SSRF prevention tests"
```

---

## Chunk 2: Bug Fixes (Bounds + RasterMap Zoom)

### Task 4: Investigate and fix bounds not reaching frontend

**Files:**
- Modify: `sandbox/ingestion/src/services/pipeline.py:41-52` (if bounds extraction is the issue)
- Modify: `sandbox/ingestion/src/routes/datasets.py` (if serialization is the issue)
- Reference: `sandbox/ingestion/src/models.py:72-83` (Dataset model)
- Reference: `sandbox/ingestion/src/state.py` (datasets dict)

**Time-box: 2 hours.** If root cause not found, ship the STAC metadata fallback.

- [ ] **Step 1: Start the local stack and run a real upload**

```bash
cd sandbox
docker compose up -d
cd ingestion
pip install -e ../../skills/geo-conversions[all]
.venv/bin/uvicorn src.app:app --reload --port 8000 &
```

Upload a test GeoTIFF:
```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@/path/to/test.tif" \
  -v
```

Note the `dataset_id` from the response.

- [ ] **Step 2: Check the dataset endpoint**

```bash
curl http://localhost:8000/api/datasets/{dataset_id} | python -m json.tool
```

Check: is `bounds` null or populated? If null, the bug is confirmed.

- [ ] **Step 3: Add debug logging to trace bounds through pipeline**

Add temporary print statements to `pipeline.py`:
- After `_extract_bounds()` call (line 102): `print(f"DEBUG bounds: {bounds}")`
- After `Dataset(...)` creation (line 134): `print(f"DEBUG dataset.bounds: {dataset.bounds}")`

Re-run the upload and check server logs.

- [ ] **Step 4: Fix the root cause**

Based on investigation, fix the issue. Likely candidates:
1. **Bounds are extracted but not serialized:** Check `Dataset.model_dump()` includes bounds — it should since `bounds: list[float] | None = None` in models.py:78.
2. **Race condition:** Frontend fetches before pipeline completes. Check that the frontend polls or waits for `ready` status before fetching dataset.
3. **TemporaryDirectory cleanup:** Bounds extraction happens inside `with tempfile.TemporaryDirectory()` (line 82), so the file exists. But if the output_path is wrong, rasterio/geopandas would raise an exception caught by the outer try/except.

**Fallback (if time-box expires):** Fetch bounds from STAC metadata for raster datasets:

```python
# In pipeline.py, after stac_ingest.ingest_raster():
if format_pair.dataset_type == DatasetType.RASTER:
    # Fetch bounds from STAC item as fallback
    import httpx
    stac_resp = httpx.get(f"{settings.stac_api_url}/collections/sandbox-{job.dataset_id}/items", timeout=10.0)
    if stac_resp.status_code == 200:
        items = stac_resp.json().get("features", [])
        if items:
            bounds = items[0].get("bbox")
```

- [ ] **Step 5: Remove debug logging**

Remove all `print(f"DEBUG` statements added in Step 3.

- [ ] **Step 6: Verify no debug statements remain**

```bash
grep -rn "DEBUG\|print(" sandbox/ingestion/src/services/pipeline.py
```

Expected: no matches (the file has no print statements in its committed state).

- [ ] **Step 7: Run tests**

```bash
cd sandbox/ingestion
python -m pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add sandbox/ingestion/src/
git commit -m "fix(sandbox): fix bounds extraction reaching frontend"
```

---

### Task 5: Fix RasterMap hardcoded zoom

**Files:**
- Modify: `sandbox/frontend/src/components/RasterMap.tsx:52-62`

- [ ] **Step 1: Write failing test**

Create `sandbox/frontend/tests/RasterMap.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { WebMercatorViewport } from "@deck.gl/core";

describe("RasterMap zoom computation", () => {
  it("computes fitted zoom from bounds instead of hardcoding zoom:3", () => {
    const viewport = new WebMercatorViewport({ width: 800, height: 600 });
    const bounds: [number, number, number, number] = [-10, 40, 10, 50];
    const fitted = viewport.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding: 40 }
    );
    expect(fitted.zoom).toBeGreaterThan(3);
    expect(fitted.longitude).toBeCloseTo(0);
    expect(fitted.latitude).toBeCloseTo(45);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (this validates the approach)**

```bash
cd sandbox/frontend
npx vitest run tests/RasterMap.test.tsx
```

Expected: PASS (this tests the deck.gl API, not our component yet).

- [ ] **Step 3: Update RasterMap to use fitBounds**

In `sandbox/frontend/src/components/RasterMap.tsx`, replace the `initialViewState` computation (lines 52-62):

```typescript
import { WebMercatorViewport } from "@deck.gl/core";

// Replace the existing initialViewState useMemo:
const initialViewState = useMemo(() => {
  if (!dataset.bounds) {
    return { longitude: 0, latitude: 0, zoom: 2 };
  }
  const [west, south, east, north] = dataset.bounds;
  const viewport = new WebMercatorViewport({ width: 800, height: 600 });
  const { longitude, latitude, zoom } = viewport.fitBounds(
    [[west, south], [east, north]],
    { padding: 40 }
  );
  return { longitude, latitude, zoom };
}, [dataset.bounds]);
```

Also add `WebMercatorViewport` to the `@deck.gl/core` import at line 4:

```typescript
import { MapView, WebMercatorViewport } from "@deck.gl/core";
```

- [ ] **Step 4: Run all frontend tests**

```bash
cd sandbox/frontend
npx vitest run
```

Expected: all tests pass (15 existing + new).

- [ ] **Step 5: Run type check**

```bash
cd sandbox/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add sandbox/frontend/src/components/RasterMap.tsx sandbox/frontend/tests/RasterMap.test.tsx
git commit -m "fix(sandbox): compute fitted zoom from bounds in RasterMap"
```

---

## Chunk 3: Dockerfiles + Docker Compose

### Task 6: Create ingestion service Dockerfile

**Files:**
- Create: `sandbox/ingestion/Dockerfile`
- Create: `sandbox/ingestion/.dockerignore`

- [ ] **Step 1: Create .dockerignore**

Create `sandbox/ingestion/.dockerignore`:

```
__pycache__
*.pyc
.venv
.pytest_cache
tests/
*.egg-info
```

- [ ] **Step 2: Write the multi-stage Dockerfile**

Create `sandbox/ingestion/Dockerfile`. Build context is the repo root (so it can COPY both `skills/geo-conversions/` and `sandbox/ingestion/`).

```dockerfile
# Stage 1: Builder
FROM python:3.13-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal-dev \
    libmagic1 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install cng-toolkit first (changes less often)
COPY skills/geo-conversions/ /build/cng-toolkit/
RUN pip install --no-cache-dir "/build/cng-toolkit[all]"

# Copy ingestion service source + deps, then install
COPY sandbox/ingestion/ /build/ingestion/
WORKDIR /build/ingestion
RUN pip install --no-cache-dir .

# Stage 2: Runtime
FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal34 \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

WORKDIR /app
COPY sandbox/ingestion/src/ /app/src/

EXPOSE 8000

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Test the Docker build from repo root**

```bash
cd /home/anthony/projects/map-app-builder
docker build -f sandbox/ingestion/Dockerfile -t cng-ingestion .
```

Expected: builds successfully. If GDAL version mismatch, adjust `libgdal-dev` / `libgdal34` to match what's available in the python:3.13-slim base.

- [ ] **Step 4: Test the image runs**

```bash
docker run --rm -p 8000:8000 \
  -e S3_ENDPOINT=http://host.docker.internal:9000 \
  -e STAC_API_URL=http://host.docker.internal:8081 \
  cng-ingestion
```

Expected: likely fails because S3 isn't reachable. That's OK — we just need it to start without import errors. Check for `Application startup complete` in the logs.

**Note:** The lifespan function calls `s3.head_bucket()` which will fail without a real S3. For standalone Docker testing, this will error. It works when run via Docker Compose with the minio service. If this blocks testing, temporarily catch the S3 connection error in lifespan.

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/Dockerfile sandbox/ingestion/.dockerignore
git commit -m "feat(sandbox): add ingestion service Dockerfile"
```

---

### Task 7: Create frontend Dockerfile

**Files:**
- Create: `sandbox/frontend/Dockerfile`
- Create: `sandbox/frontend/.dockerignore`

- [ ] **Step 1: Create .dockerignore**

Create `sandbox/frontend/.dockerignore`:

```
node_modules
dist
.vite
```

- [ ] **Step 2: Write the dev-mode Dockerfile**

Create `sandbox/frontend/Dockerfile`:

```dockerfile
FROM node:20-slim

WORKDIR /app

# Dependencies installed at runtime via volume mount + entrypoint.
# The @maptool/core dependency uses "file:../../" which requires the
# full repo to be mounted. Docker Compose handles this via volumes.
COPY package.json package-lock.json ./

EXPOSE 5185

CMD ["sh", "-c", "npm install && npx vite --host"]
```

This is intentionally minimal — the Docker Compose service mounts the full repo as a volume so the `file:../../` dependency on `@maptool/core` resolves correctly. `npm install` runs at container startup (not build time) because it needs the volume mount.

- [ ] **Step 3: Test the Docker build**

```bash
cd /home/anthony/projects/map-app-builder
docker build -f sandbox/frontend/Dockerfile -t cng-frontend sandbox/frontend/
```

Expected: builds successfully (it's just node:20-slim + copy package.json).

- [ ] **Step 4: Commit**

```bash
git add sandbox/frontend/Dockerfile sandbox/frontend/.dockerignore
git commit -m "feat(sandbox): add frontend Dockerfile (dev mode)"
```

---

### Task 8: Update Docker Compose with ingestion + frontend services

**Files:**
- Modify: `sandbox/docker-compose.yml`
- Modify: `sandbox/.env.example`
- Modify: `sandbox/ingestion/src/config.py:29` (add port 5185 to default CORS)

- [ ] **Step 1: Add port 5185 to default CORS origins**

In `sandbox/ingestion/src/config.py`, update line 29:

```python
cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:5185"]
```

- [ ] **Step 2: Add ingestion and frontend services to docker-compose.yml**

Append before the `volumes:` section in `sandbox/docker-compose.yml`:

```yaml
  ingestion:
    build:
      context: ..
      dockerfile: sandbox/ingestion/Dockerfile
    ports:
      - "8000:8000"
    environment:
      S3_BUCKET: ${S3_BUCKET}
      S3_ENDPOINT: http://minio:9000
      AWS_ACCESS_KEY_ID: ${MINIO_ROOT_USER}
      AWS_SECRET_ACCESS_KEY: ${MINIO_ROOT_PASSWORD}
      STAC_API_URL: http://stac-api:8081
      RASTER_TILER_URL: http://raster-tiler:8082
      VECTOR_TILER_URL: http://vector-tiler:8083
      POSTGRES_DSN: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@database:5432/${POSTGRES_DB}
      CORS_ORIGINS: '["http://localhost:5185"]'
    depends_on:
      database:
        condition: service_healthy
      minio:
        condition: service_healthy
      stac-api:
        condition: service_started
      raster-tiler:
        condition: service_started
      vector-tiler:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build:
      context: frontend
      dockerfile: Dockerfile
    ports:
      - "5185:5185"
    environment:
      VITE_API_BASE: http://localhost:8000
      VITE_RASTER_TILER_URL: http://localhost:8082
      VITE_VECTOR_TILER_URL: http://localhost:8083
    volumes:
      - ../:/repo
      - /repo/sandbox/frontend/node_modules
    working_dir: /repo/sandbox/frontend
    depends_on:
      ingestion:
        condition: service_healthy
```

**Why localhost for VITE_* vars:** The browser (not the container) makes these requests. The browser connects to the host-mapped ports, not Docker-internal hostnames.

- [ ] **Step 3: Test docker compose up**

```bash
cd sandbox
cp .env.example .env
docker compose up --build
```

Expected: all services start. Check logs for errors. The ingestion service should show `Application startup complete`. The frontend should show `VITE vX.X.X ready`.

- [ ] **Step 4: Verify frontend can reach the API**

Open `http://localhost:5185` in a browser (or curl). The upload page should load. If there are CORS errors in the browser console, check the `CORS_ORIGINS` env var.

- [ ] **Step 5: Commit**

```bash
git add sandbox/docker-compose.yml sandbox/.env.example sandbox/ingestion/src/config.py
git commit -m "feat(sandbox): add ingestion + frontend to Docker Compose"
```

---

## Chunk 4: CI/CD + E2E Validation

### Task 9: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/sandbox-ci.yml`

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write the CI workflow**

Create `.github/workflows/sandbox-ci.yml`:

```yaml
name: Sandbox CI

on:
  push:
    branches: [main]
    paths:
      - "sandbox/**"
      - "skills/geo-conversions/**"
  pull_request:
    paths:
      - "sandbox/**"
      - "skills/geo-conversions/**"

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: sandbox/ingestion
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install system deps
        run: sudo apt-get update && sudo apt-get install -y libmagic1

      - name: Install cng-toolkit
        run: pip install -e "../../skills/geo-conversions[all]"

      - name: Install ingestion deps
        run: pip install -e ".[dev]"

      - name: Run tests
        run: python -m pytest tests/ -v

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: sandbox/frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install deps
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npx vitest run
```

- [ ] **Step 3: Validate the workflow YAML syntax**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/sandbox-ci.yml'))"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/sandbox-ci.yml
git commit -m "ci: add sandbox backend + frontend CI workflow"
```

---

### Task 10: End-to-end validation with real data

This task is manual verification using the Docker Compose stack. No code changes — just validation.

**Prerequisites:** Docker Compose stack running (`cd sandbox && docker compose up`).

- [ ] **Step 1: Download test data**

```bash
mkdir -p /tmp/sandbox-test-data

# Small GeoTIFF — Natural Earth shaded relief (small crop)
curl -L -o /tmp/sandbox-test-data/test.tif \
  "https://github.com/rasterio/rasterio/raw/main/tests/data/RGB.byte.tif"

# Small GeoJSON — earthquake data
curl -L -o /tmp/sandbox-test-data/test.geojson \
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
```

- [ ] **Step 2: Test GeoTIFF upload**

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@/tmp/sandbox-test-data/test.tif"
```

Note `job_id` and `dataset_id`. Poll for completion:

```bash
curl http://localhost:8000/api/jobs/{job_id}
```

Wait until `status: "ready"`. Then check dataset:

```bash
curl http://localhost:8000/api/datasets/{dataset_id} | python -m json.tool
```

Verify: `tile_url` is populated, `bounds` is not null, `credits` includes rio-cogeo and TiTiler.

- [ ] **Step 3: Test GeoJSON upload**

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@/tmp/sandbox-test-data/test.geojson"
```

Same verification: wait for ready, check dataset has `tile_url`, `bounds`, credits include GeoPandas and tipg.

- [ ] **Step 4: Test SSRF prevention**

```bash
curl -X POST http://localhost:8000/api/convert-url \
  -H "Content-Type: application/json" \
  -d '{"url": "file:///etc/passwd"}'
```

Expected: 422 response.

- [ ] **Step 5: Test Shapefile upload (zip)**

Create a small test shapefile. Use Natural Earth if available, or create one programmatically:

```bash
# If ogr2ogr is available, convert the GeoJSON to shapefile
ogr2ogr /tmp/sandbox-test-data/test.shp /tmp/sandbox-test-data/test.geojson
cd /tmp/sandbox-test-data && zip test_shp.zip test.shp test.shx test.dbf test.prj 2>/dev/null
```

Upload the zip:
```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@/tmp/sandbox-test-data/test_shp.zip"
```

Same verification: wait for ready, check dataset has `tile_url`, `bounds`, credits include GeoPandas and tipg. If ogr2ogr isn't available, skip — GeoJSON covers the same vector pipeline.

- [ ] **Step 6: Test oversized file rejection**

```bash
# Create a file just over 1GB (1GB + 1 byte)
truncate -s 1073741825 /tmp/sandbox-test-data/oversized.tif
curl -X POST http://localhost:8000/api/upload \
  -F "file=@/tmp/sandbox-test-data/oversized.tif"
```

Expected: 413 response with "File too large" message. The upload should be rejected during streaming, before the full file is received.

- [ ] **Step 7: Test wrong format rejection**

```bash
echo "not a geospatial file" > /tmp/sandbox-test-data/test.pdf
curl -X POST http://localhost:8000/api/upload \
  -F "file=@/tmp/sandbox-test-data/test.pdf"
```

Expected: job fails with clear error about unsupported format.

- [ ] **Step 8: Test rate limiting**

```bash
for i in $(seq 1 6); do
  echo "--- Request $i ---"
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/upload \
    -F "file=@/tmp/sandbox-test-data/test.tif"
  echo
done
```

Expected: first 5 return 200, 6th returns 429.

- [ ] **Step 9: Verify map rendering via Chrome DevTools MCP**

This is a headless VM — use Chrome DevTools MCP for screenshot-based verification.

```
1. Use navigate_page to open http://localhost:5185
2. take_screenshot to /tmp/sandbox-e2e-upload.png — verify upload page renders
3. Upload the test GeoTIFF through the UI (or use the dataset_id from Step 2)
4. navigate_page to http://localhost:5185/map/{dataset_id}
5. take_screenshot to /tmp/sandbox-e2e-raster-map.png — verify:
   - Raster tiles render
   - Bounds auto-zoom centers on dataset extent (not world view)
   - Credits panel visible in sidebar
6. Repeat with GeoJSON dataset_id from Step 3
7. take_screenshot to /tmp/sandbox-e2e-vector-map.png — verify vector features render
```

- [ ] **Step 10: Test expired page**

```
1. navigate_page to http://localhost:5185/expired/fake-id
2. take_screenshot to /tmp/sandbox-e2e-expired.png — verify expiry page with CTAs
```

- [ ] **Step 11: Test shareable URL**

Open the raster map URL from Step 7 in a new page (simulating incognito). Verify the same map + credits render.

- [ ] **Step 12: Document any issues found**

If any E2E test fails, fix the issue and commit. If the fix is non-trivial, create a follow-up task.

- [ ] **Step 13: Clean up test data**

```bash
rm -rf /tmp/sandbox-test-data
```

---

## Chunk 5: Final Polish + Update Implementation Plan

### Task 11: Update the high-level implementation plan in Obsidian

**Files:**
- Modify: `/home/anthony/Documents/obsidian-notes/Project Docs/Map App Builder/cng-sandbox-implementation-plan.md`

- [ ] **Step 1: Update Phase 3 status and add Phase 4**

Update the phase table at the top to mark Phase 3 as done. Add Phase 4 with its scope:

```markdown
| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: CLI Toolkit | ~75% complete | GeoTIFF/Shapefile/GeoJSON/NetCDF converters done. Packaging done (3A). |
| Phase 1: Ingestion Service | **Done** | All endpoints, pipeline, eoAPI integration, Docker Compose stack. |
| Phase 2: Frontend | **Done** | Upload page, SSE progress, raster/vector map rendering, credits, share, expiry. |
| Phase 3: Integration + CI | **Done** | E2E working, CI green, Dockerized. |
| Phase 4: AWS Deployment | **Not started** | eoAPI CDK, ECS, CloudFront, S3 lifecycle, persistent state. |
```

- [ ] **Step 2: Add Phase 4 section**

Add a new section after Phase 3:

```markdown
## Phase 4: AWS Production Deployment

**Status: NOT STARTED**

### 4A. eoAPI CDK deployment
- Deploy pgSTAC, titiler-pgstac, tipg via eoAPI CDK (Lambda + Aurora Serverless + CloudFront)

### 4B. Ingestion service deployment
- Push Docker image to ECR
- Deploy to ECS Fargate
- Add persistent state (PostgreSQL for job/dataset metadata)

### 4C. Frontend deployment
- Multi-stage Dockerfile (Vite build → nginx)
- VITE_* vars as build args
- Deploy to CloudFront or Vercel

### 4D. Reverse proxy routing
- CloudFront behaviors route by path prefix:
  - `/api/*` → Ingestion API (ECS)
  - `/stac/*` → STAC API
  - `/raster/*` → Raster Tiler
  - `/vector/*` → Vector Tiler
  - `/*` → Frontend (static)

### 4E. Production hardening
- S3 lifecycle policy (30-day expiry on `sandbox/` prefix)
- Environment variables via AWS SSM/Secrets Manager
- CORS for production domain
- No secrets in code or images
```

The Obsidian file syncs automatically — no git commit needed.

---

### Task 12: Run final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd sandbox/ingestion
python -m pytest tests/ -v
```

Expected: all pass (29 original + new bounds + convert-url tests).

- [ ] **Step 2: Run all frontend tests + type check**

```bash
cd sandbox/frontend
npx tsc --noEmit && npx vitest run
```

Expected: all pass (15 original + RasterMap test).

- [ ] **Step 3: Verify Docker Compose builds cleanly**

```bash
cd sandbox
docker compose build
```

Expected: both ingestion and frontend images build without errors.

- [ ] **Step 4: Fix any issues found**

If any verification step fails, fix the issue and commit before proceeding.
