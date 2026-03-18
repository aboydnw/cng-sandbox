# PMTiles Vector Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tipg tile serving with PMTiles for polygon/line datasets so world-scale vectors render at full fidelity with no geometry simplification.

**Architecture:** After validation, `pipeline.py` reads the GeoParquet to detect geometry type. Polygon/line datasets run through tippecanoe → PMTiles → MinIO; point datasets continue through PostGIS → tipg unchanged. `VectorMap.tsx` detects the serving path from the `tile_url` prefix and registers the pmtiles-js protocol when needed.

**Tech Stack:** Python/FastAPI ingestion service, tippecanoe (subprocess), pmtiles-js v4 (already a dep), MapLibre GL JS, MinIO, geopandas, moto (test mocking for S3)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `sandbox/ingestion/src/services/pmtiles_ingest.py` | **Create** | tippecanoe subprocess + tile URL construction |
| `sandbox/ingestion/tests/test_pmtiles_ingest.py` | **Create** | Unit tests for pmtiles_ingest |
| `sandbox/ingestion/src/services/storage.py` | Modify | Add `upload_pmtiles` method |
| `sandbox/ingestion/tests/test_storage.py` | Modify | Test for `upload_pmtiles` |
| `sandbox/ingestion/src/services/pipeline.py` | Modify | Geometry routing, `get_credits` update, skip tipg wait |
| `sandbox/ingestion/tests/test_pipeline.py` | Modify | Test `get_credits(use_pmtiles=True)` |
| `sandbox/ingestion/src/services/vector_ingest.py` | Modify | Remove simplify block |
| `sandbox/ingestion/Dockerfile` | Modify | Install tippecanoe in runtime stage |
| `sandbox/docker-compose.yml` | Modify | Add `MINIO_PROXY_TARGET` to frontend env; set MinIO bucket to public read |
| `sandbox/frontend/vite.config.ts` | Modify | Add `/pmtiles` proxy |
| `sandbox/frontend/src/components/VectorMap.tsx` | Modify | PMTiles protocol detection + source; remove zoom clamp |
| `skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py` | Modify | Revert complexity check to `passed=False` |
| `skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py` | Modify | Same |
| `skills/geo-conversions/geojson-to-geoparquet/SKILL.md` | Modify | Update failure mode note |
| `skills/geo-conversions/shapefile-to-geoparquet/SKILL.md` | Modify | Same |

---

## Chunk 1: Python Backend

### Task 1: StorageService.upload_pmtiles

**Files:**
- Modify: `sandbox/ingestion/src/services/storage.py`
- Modify: `sandbox/ingestion/tests/test_storage.py`

- [ ] **Step 1: Write the failing test**

Add to `sandbox/ingestion/tests/test_storage.py`:

```python
def test_upload_pmtiles(storage):
    with tempfile.NamedTemporaryFile(suffix=".pmtiles", delete=False) as f:
        f.write(b"fake pmtiles data")
        path = f.name
    try:
        key = storage.upload_pmtiles(path, dataset_id="abc-123")
        assert key == "datasets/abc-123/converted/data.pmtiles"
    finally:
        os.unlink(path)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion && uv run pytest tests/test_storage.py::test_upload_pmtiles -v
```

Expected: FAIL with `AttributeError: 'StorageService' object has no attribute 'upload_pmtiles'`

- [ ] **Step 3: Implement `upload_pmtiles` in `storage.py`**

Add after `upload_converted`:

```python
def upload_pmtiles(self, local_path: str, dataset_id: str) -> str:
    """Upload a .pmtiles file to MinIO. Returns the storage key."""
    key = f"datasets/{dataset_id}/converted/data.pmtiles"
    self.s3.upload_file(local_path, self.bucket, key)
    return key
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd sandbox/ingestion && uv run pytest tests/test_storage.py -v
```

Expected: All storage tests PASS

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/storage.py sandbox/ingestion/tests/test_storage.py
git commit -m "feat(ingestion): add StorageService.upload_pmtiles"
```

---

### Task 2: pmtiles_ingest.py — new module

**Files:**
- Create: `sandbox/ingestion/src/services/pmtiles_ingest.py`
- Create: `sandbox/ingestion/tests/test_pmtiles_ingest.py`

- [ ] **Step 1: Write failing tests**

Create `sandbox/ingestion/tests/test_pmtiles_ingest.py`:

```python
import os
import subprocess
import tempfile

import geopandas as gpd
import pytest
from moto import mock_aws
import boto3
from shapely.geometry import Point, Polygon

from src.services.pmtiles_ingest import get_pmtiles_tile_url, ingest_pmtiles
from src.services.storage import StorageService


def test_get_pmtiles_tile_url():
    url = get_pmtiles_tile_url("abc-123")
    assert url == "/pmtiles/datasets/abc-123/converted/data.pmtiles"


@pytest.fixture
def mock_storage():
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="test-bucket")
        yield StorageService(s3_client=s3, bucket="test-bucket")


@pytest.fixture
def polygon_parquet(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": ["poly_0", "poly_1"]},
        geometry=[
            Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
            Polygon([(2, 2), (3, 2), (3, 3), (2, 3)]),
        ],
        crs="EPSG:4326",
    )
    path = str(tmp_path / "test.parquet")
    gdf.to_parquet(path)
    return path


@pytest.fixture
def empty_parquet(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": []},
        geometry=gpd.GeoSeries([], dtype="geometry"),
        crs="EPSG:4326",
    )
    path = str(tmp_path / "empty.parquet")
    gdf.to_parquet(path)
    return path


def test_ingest_pmtiles_calls_tippecanoe_with_required_flags(
    monkeypatch, polygon_parquet, mock_storage
):
    """ingest_pmtiles runs tippecanoe with all required flags."""
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd)
        output_flag = next(f for f in cmd if f.startswith("--output="))
        output_path = output_flag.split("=", 1)[1]
        with open(output_path, "wb") as f:
            f.write(b"fake pmtiles")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)

    url = ingest_pmtiles("abc-123", polygon_parquet, _storage=mock_storage)

    assert len(calls) == 1
    cmd = calls[0]
    assert cmd[0] == "tippecanoe"
    assert "--no-feature-limit" in cmd
    assert "--no-tile-size-limit" in cmd
    assert "--force" in cmd
    assert "--maximum-zoom=14" in cmd
    assert "--layer=default" in cmd
    assert url == "/pmtiles/datasets/abc-123/converted/data.pmtiles"


def test_ingest_pmtiles_uploads_to_storage(
    monkeypatch, polygon_parquet, mock_storage
):
    """ingest_pmtiles uploads the generated .pmtiles file to storage."""
    def fake_run(cmd, **kwargs):
        output_flag = next(f for f in cmd if f.startswith("--output="))
        output_path = output_flag.split("=", 1)[1]
        with open(output_path, "wb") as f:
            f.write(b"fake pmtiles")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)

    ingest_pmtiles("abc-123", polygon_parquet, _storage=mock_storage)

    # Verify the file was uploaded to MinIO
    obj = mock_storage.s3.get_object(
        Bucket="test-bucket",
        Key="datasets/abc-123/converted/data.pmtiles",
    )
    assert obj["Body"].read() == b"fake pmtiles"


def test_ingest_pmtiles_raises_on_tippecanoe_failure(
    monkeypatch, polygon_parquet, mock_storage
):
    """ingest_pmtiles raises RuntimeError when tippecanoe exits non-zero."""
    def fake_run(cmd, **kwargs):
        return subprocess.CompletedProcess(cmd, 1, "", "tippecanoe: fatal error")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(RuntimeError):
        ingest_pmtiles("abc-123", polygon_parquet, _storage=mock_storage)


def test_ingest_pmtiles_raises_on_empty_dataset(
    monkeypatch, empty_parquet, mock_storage
):
    """ingest_pmtiles raises ValueError when dataset has no features."""
    with pytest.raises(ValueError):
        ingest_pmtiles("abc-123", empty_parquet, _storage=mock_storage)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pmtiles_ingest.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.services.pmtiles_ingest'`

- [ ] **Step 3: Implement `pmtiles_ingest.py`**

Create `sandbox/ingestion/src/services/pmtiles_ingest.py`:

```python
"""Convert GeoParquet to PMTiles and ingest to MinIO for vector tile serving."""

import os
import subprocess
import tempfile

import geopandas as gpd

from src.services.storage import StorageService


def get_pmtiles_tile_url(dataset_id: str) -> str:
    """Return the frontend-relative tile URL for a PMTiles dataset."""
    return f"/pmtiles/datasets/{dataset_id}/converted/data.pmtiles"


def ingest_pmtiles(
    dataset_id: str,
    parquet_path: str,
    _storage: StorageService | None = None,
) -> str:
    """Convert GeoParquet to PMTiles and upload to MinIO. Returns tile URL.

    Runs tippecanoe as a subprocess. tippecanoe generates zoom-appropriate
    tiles at each zoom level — no features are dropped and no simplification
    is applied to the stored data.

    This is a sync function — call via asyncio.to_thread() from async code.
    """
    storage = _storage or StorageService()

    gdf = gpd.read_parquet(parquet_path)
    gdf.columns = [c.lower() for c in gdf.columns]

    if len(gdf) == 0:
        raise ValueError(f"Dataset {dataset_id} has no features — cannot generate PMTiles")

    with tempfile.TemporaryDirectory() as tmpdir:
        geojson_path = os.path.join(tmpdir, "data.geojson")
        pmtiles_path = os.path.join(tmpdir, "data.pmtiles")

        gdf.to_file(geojson_path, driver="GeoJSON")

        result = subprocess.run(
            [
                "tippecanoe",
                f"--output={pmtiles_path}",
                "--no-feature-limit",
                "--no-tile-size-limit",
                "--force",
                "--maximum-zoom=14",
                "--layer=default",
                geojson_path,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"tippecanoe failed:\n{result.stderr}")

        storage.upload_pmtiles(pmtiles_path, dataset_id)

    return get_pmtiles_tile_url(dataset_id)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pmtiles_ingest.py -v
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/pmtiles_ingest.py sandbox/ingestion/tests/test_pmtiles_ingest.py
git commit -m "feat(ingestion): add pmtiles_ingest module with tippecanoe integration"
```

---

### Task 3: pipeline.py — geometry routing + get_credits

**Files:**
- Modify: `sandbox/ingestion/src/services/pipeline.py`
- Modify: `sandbox/ingestion/tests/test_pipeline.py`

- [ ] **Step 1: Write failing test for get_credits with use_pmtiles=True**

Add to `sandbox/ingestion/tests/test_pipeline.py`:

```python
def test_get_credits_vector_pmtiles():
    credits = get_credits(FormatPair.GEOJSON_TO_GEOPARQUET, use_pmtiles=True)
    names = [c["tool"] for c in credits]
    assert "GeoPandas" in names
    assert "tippecanoe" in names
    assert "PMTiles" in names
    assert "MapLibre" in names
    assert "tipg" not in names


def test_get_credits_vector_tipg_unchanged():
    credits = get_credits(FormatPair.GEOJSON_TO_GEOPARQUET, use_pmtiles=False)
    names = [c["tool"] for c in credits]
    assert "tipg" in names
    assert "tippecanoe" not in names
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pipeline.py -v
```

Expected: FAIL — `get_credits()` does not accept `use_pmtiles` keyword

- [ ] **Step 3: Update `get_credits` in `pipeline.py`**

Replace the existing `get_credits` function:

```python
def get_credits(format_pair: FormatPair, use_pmtiles: bool = False) -> list[dict]:
    """Return the credits list for a given conversion path."""
    credits = []

    if format_pair == FormatPair.GEOTIFF_TO_COG:
        credits.append({"tool": "rio-cogeo", "url": "https://github.com/cogeotiff/rio-cogeo", "role": "Converted by"})
    elif format_pair == FormatPair.NETCDF_TO_COG:
        credits.append({"tool": "xarray", "url": "https://xarray.dev", "role": "Read by"})
        credits.append({"tool": "rio-cogeo", "url": "https://github.com/cogeotiff/rio-cogeo", "role": "Converted by"})
    elif format_pair in (FormatPair.SHAPEFILE_TO_GEOPARQUET, FormatPair.GEOJSON_TO_GEOPARQUET):
        credits.append({"tool": "GeoPandas", "url": "https://geopandas.org", "role": "Converted by"})

    if format_pair.dataset_type == DatasetType.RASTER:
        credits.append({"tool": "TiTiler", "url": "https://developmentseed.org/titiler", "role": "Tiles served by"})
        credits.append({"tool": "pgSTAC", "url": "https://github.com/stac-utils/pgstac", "role": "Cataloged by"})
    elif use_pmtiles:
        credits.append({"tool": "tippecanoe", "url": "https://github.com/felt/tippecanoe", "role": "Tiles generated by"})
        credits.append({"tool": "PMTiles", "url": "https://github.com/protomaps/PMTiles", "role": "Tiles served by"})
    else:
        credits.append({"tool": "tipg", "url": "https://github.com/developmentseed/tipg", "role": "Tiles served by"})

    credits.append({"tool": "MapLibre", "url": "https://maplibre.org", "role": "Map rendered by"})
    return credits
```

- [ ] **Step 4: Run tests to verify get_credits tests pass**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pipeline.py -v
```

Expected: All pipeline tests PASS

- [ ] **Step 5: Add imports and geometry routing to `run_pipeline` in `pipeline.py`**

**5a. Replace the import line** (line 18 in current file — one line, not an addition):

Find:
```python
from src.services import stac_ingest, vector_ingest
```
Replace with:
```python
from src.services import stac_ingest, vector_ingest, pmtiles_ingest
```

**5b. Add `_detect_use_pmtiles` helper** after `_extract_band_count` (around line 64):

```python
def _detect_use_pmtiles(output_path: str) -> bool:
    """Return True if the dataset contains polygon or line features."""
    import geopandas as gpd
    gdf = gpd.read_parquet(output_path)
    return bool(
        gdf.geom_type.isin(
            ["Polygon", "MultiPolygon", "LineString", "MultiLineString"]
        ).any()
    )
```

**5c. Replace the Stage 4 block** (lines 121–135, which are still INSIDE the `with tempfile.TemporaryDirectory() as tmpdir:` block):

Find:
```python
            # Stage 4: Ingest
            job.status = JobStatus.INGESTING

            converted_key = storage.upload_converted(output_path, job.dataset_id, out_filename)
            s3_href = storage.get_s3_uri(converted_key)

            if format_pair.dataset_type == DatasetType.RASTER:
                tile_url = await stac_ingest.ingest_raster(
                    job.dataset_id, output_path, s3_href, job.filename,
                )
            else:
                tile_url = await asyncio.to_thread(
                    vector_ingest.ingest_vector, job.dataset_id, output_path,
                )
                await _wait_for_tipg_collection(job.dataset_id)
```

Replace with:
```python
            # Stage 4: Ingest
            job.status = JobStatus.INGESTING

            converted_key = storage.upload_converted(output_path, job.dataset_id, out_filename)
            s3_href = storage.get_s3_uri(converted_key)

            use_pmtiles = False
            if format_pair.dataset_type == DatasetType.RASTER:
                tile_url = await stac_ingest.ingest_raster(
                    job.dataset_id, output_path, s3_href, job.filename,
                )
            else:
                use_pmtiles = await asyncio.to_thread(_detect_use_pmtiles, output_path)
                if use_pmtiles:
                    tile_url = await asyncio.to_thread(
                        pmtiles_ingest.ingest_pmtiles, job.dataset_id, output_path,
                    )
                else:
                    tile_url = await asyncio.to_thread(
                        vector_ingest.ingest_vector, job.dataset_id, output_path,
                    )
                    await _wait_for_tipg_collection(job.dataset_id)
```

Note: `use_pmtiles` is assigned inside the `with tmpdir:` block but is accessible after it — Python `with` blocks do not create a new scope.

**5d. Replace the Dataset construction** (lines 140–154, which are OUTSIDE the `with tmpdir:` block, under `# Stage 5: Ready`):

Find:
```python
        dataset = Dataset(
            id=job.dataset_id,
            filename=job.filename,
            dataset_type=format_pair.dataset_type,
            format_pair=format_pair,
            tile_url=tile_url,
            bounds=bounds,
            band_count=band_count,
            stac_collection_id=f"sandbox-{job.dataset_id}" if format_pair.dataset_type == DatasetType.RASTER else None,
            pg_table=vector_ingest.build_table_name(job.dataset_id) if format_pair.dataset_type == DatasetType.VECTOR else None,
            validation_results=job.validation_results,
            credits=get_credits(format_pair),
            created_at=job.created_at,
        )
        datasets_store[job.dataset_id] = dataset
```

Replace with:
```python
        dataset = Dataset(
            id=job.dataset_id,
            filename=job.filename,
            dataset_type=format_pair.dataset_type,
            format_pair=format_pair,
            tile_url=tile_url,
            bounds=bounds,
            band_count=band_count,
            stac_collection_id=f"sandbox-{job.dataset_id}" if format_pair.dataset_type == DatasetType.RASTER else None,
            pg_table=vector_ingest.build_table_name(job.dataset_id) if (
                format_pair.dataset_type == DatasetType.VECTOR and not use_pmtiles
            ) else None,
            validation_results=job.validation_results,
            credits=get_credits(format_pair, use_pmtiles=use_pmtiles),
            created_at=job.created_at,
        )
        datasets_store[job.dataset_id] = dataset
```

- [ ] **Step 6: Run the full test suite**

```bash
cd sandbox/ingestion && uv run pytest -v
```

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add sandbox/ingestion/src/services/pipeline.py sandbox/ingestion/tests/test_pipeline.py
git commit -m "feat(ingestion): route polygon/line datasets through PMTiles pipeline"
```

---

### Task 4: Remove simplification from vector_ingest.py

**Files:**
- Modify: `sandbox/ingestion/src/services/vector_ingest.py`

Context: The `simplify(0.05)` block was a workaround for MapLibre's 65535-vertex limit and PostGIS `ST_AsMVT` errors. With PMTiles serving polygon/line data, this path only handles point datasets — which have no vertex complexity issues.

- [ ] **Step 1: Remove the simplify block from `vector_ingest.py`**

Remove this entire block from `ingest_vector`:

```python
    # Pre-simplify polygon/line geometries before loading to PostGIS.
    # Two downstream issues require this:
    # ...
    non_point = gdf.geom_type.isin(["Polygon", "MultiPolygon", "LineString", "MultiLineString"])
    if non_point.any():
        gdf = gdf.copy()
        gdf.loc[non_point, "geometry"] = gdf.loc[non_point, "geometry"].simplify(
            0.05, preserve_topology=True
        )
```

The result should be:

```python
def ingest_vector(dataset_id: str, parquet_path: str) -> str:
    """Load GeoParquet into PostgreSQL. Returns tile URL template."""
    settings = get_settings()
    table_name = build_table_name(dataset_id)

    gdf = gpd.read_parquet(parquet_path)
    gdf.columns = [c.lower() for c in gdf.columns]

    engine = create_engine(settings.postgres_dsn)
    gdf.to_postgis(table_name, engine, if_exists="replace", index=False)
    engine.dispose()

    return get_vector_tile_url(dataset_id)
```

- [ ] **Step 2: Run the test suite to confirm nothing broke**

```bash
cd sandbox/ingestion && uv run pytest -v
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/services/vector_ingest.py
git commit -m "fix(ingestion): remove geometry simplification workaround from vector_ingest"
```

---

## Chunk 2: Infrastructure, Frontend, Skills

### Task 5: Install tippecanoe + MinIO public read

**Files:**
- Modify: `sandbox/ingestion/Dockerfile`
- Modify: `sandbox/docker-compose.yml`

**Background:** tippecanoe must be installed in the runtime container (not just the builder stage). The base image `python:3.13-slim` resolves to Debian Trixie (13) — tippecanoe 2.53.0 is available in Trixie's apt repository. Consider pinning `FROM python:3.13-slim-trixie` to prevent breakage if the slim tag moves to a future Debian release that drops tippecanoe. MinIO must allow anonymous reads so the browser can make HTTP range requests to the PMTiles files via the Vite proxy (appropriate for a local dev sandbox — do not replicate in production).

- [ ] **Step 1: Add tippecanoe to the Dockerfile runtime stage**

In `sandbox/ingestion/Dockerfile`, update the runtime `apt-get install` block:

```dockerfile
# Stage 2: Runtime
FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal36 \
    libmagic1 \
    curl \
    tippecanoe \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Add `MINIO_PROXY_TARGET` to the frontend service in `docker-compose.yml`**

In the `frontend:` service `environment:` block, add:

```yaml
      MINIO_PROXY_TARGET: http://minio:9000
```

- [ ] **Step 3: Set the MinIO bucket to public read in `minio-init`**

In `docker-compose.yml`, update the `minio-init` entrypoint to add `mc anonymous set download`:

```yaml
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD};
      mc mb --ignore-existing local/${S3_BUCKET};
      mc anonymous set download local/${S3_BUCKET};
      exit 0;
      "
```

- [ ] **Step 4: Rebuild the ingestion container and verify tippecanoe is available**

```bash
docker compose -f sandbox/docker-compose.yml build ingestion
docker compose -f sandbox/docker-compose.yml run --rm ingestion tippecanoe --version
```

Expected: Output like `tippecanoe v2.x.x`

- [ ] **Step 5: Bring up the full stack**

```bash
docker compose -f sandbox/docker-compose.yml down -v
docker compose -f sandbox/docker-compose.yml up -d --build
docker compose -f sandbox/docker-compose.yml ps
```

Expected: All services healthy

- [ ] **Step 6: Commit**

```bash
git add sandbox/ingestion/Dockerfile sandbox/docker-compose.yml
git commit -m "feat(infra): install tippecanoe in ingestion container; set MinIO bucket to public read"
```

---

### Task 6: Vite proxy for /pmtiles

**Files:**
- Modify: `sandbox/frontend/vite.config.ts`

- [ ] **Step 1: Add the /pmtiles proxy entry**

In `sandbox/frontend/vite.config.ts`, add the `/pmtiles` entry inside the `proxy` object, after the `/vector` entry:

```typescript
      "/pmtiles": {
        target: process.env.MINIO_PROXY_TARGET || "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/pmtiles/, "/sandbox-data"),
      },
```

The full proxy block becomes:

```typescript
    proxy: {
      "/api": process.env.API_PROXY_TARGET || "http://localhost:8000",
      "/raster": {
        target: process.env.RASTER_TILER_PROXY_TARGET || "http://localhost:8082",
        rewrite: (path: string) => path.replace(/^\/raster/, ""),
      },
      "/vector": {
        target: process.env.VECTOR_TILER_PROXY_TARGET || "http://localhost:8083",
        rewrite: (path: string) => path.replace(/^\/vector/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-store";
          });
        },
      },
      "/pmtiles": {
        target: process.env.MINIO_PROXY_TARGET || "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/pmtiles/, "/sandbox-data"),
      },
    },
```

- [ ] **Step 2: Rebuild the frontend container**

```bash
docker compose -f sandbox/docker-compose.yml build frontend
docker compose -f sandbox/docker-compose.yml up -d frontend
```

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/vite.config.ts
git commit -m "feat(frontend): add /pmtiles proxy to MinIO for range request serving"
```

---

### Task 7: VectorMap.tsx PMTiles support

**Files:**
- Modify: `sandbox/frontend/src/components/VectorMap.tsx`

- [ ] **Step 1: Update VectorMap.tsx**

Replace the entire file with:

```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import { Box, NativeSelect } from "@chakra-ui/react";
import maplibregl, { addProtocol, removeProtocol } from "maplibre-gl";
import { createPMTilesProtocol } from "@maptool/core";
import type { Dataset } from "../types";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const FILL_COLOR = "#CF3F02";
const LINE_COLOR = "#CF3F02";
const CIRCLE_COLOR = "#CF3F02";

interface VectorMapProps {
  dataset: Dataset;
}

export function VectorMap({ dataset }: VectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState("streets");
  const isInitialMount = useRef(true);

  const isPMTiles = dataset.tile_url.startsWith("/pmtiles/");

  const addVectorLayers = useCallback((map: maplibregl.Map) => {
    if (isPMTiles) {
      const pmtilesUrl = `pmtiles://${window.location.origin}${dataset.tile_url}`;
      map.addSource("vector-data", {
        type: "vector",
        url: pmtilesUrl,
      });
    } else {
      const tileUrl = dataset.tile_url.startsWith("/")
        ? `${window.location.origin}${dataset.tile_url}`
        : dataset.tile_url;
      map.addSource("vector-data", {
        type: "vector",
        tiles: [tileUrl],
      });
    }

    map.addLayer({
      id: "vector-fill",
      type: "fill",
      source: "vector-data",
      "source-layer": "default",
      paint: { "fill-color": FILL_COLOR, "fill-opacity": 0.3 },
    });

    map.addLayer({
      id: "vector-line",
      type: "line",
      source: "vector-data",
      "source-layer": "default",
      paint: { "line-color": LINE_COLOR, "line-width": 1.5 },
    });

    map.addLayer({
      id: "vector-circle",
      type: "circle",
      source: "vector-data",
      "source-layer": "default",
      paint: {
        "circle-color": CIRCLE_COLOR,
        "circle-radius": 4,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1,
      },
    });

    map.on("click", ["vector-fill", "vector-line", "vector-circle"], (e) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      const container = document.createElement("div");
      for (const [k, v] of Object.entries(props)) {
        const row = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = k + ": ";
        row.appendChild(label);
        row.appendChild(document.createTextNode(String(v)));
        container.appendChild(row);
      }
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setDOMContent(container)
        .addTo(map);
    });

    map.on("mouseenter", "vector-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "vector-fill", () => {
      map.getCanvas().style.cursor = "";
    });
  }, [dataset.tile_url, isPMTiles]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Reset the basemap-change guard so it doesn't fire spuriously when
    // addVectorLayers changes identity after a dataset swap.
    isInitialMount.current = true;

    // Register pmtiles protocol before map creation when serving PMTiles.
    // Use protocol.tile directly — pmtiles-js uses arrow functions, no .bind() needed.
    let pmtilesCleanup: (() => void) | null = null;
    if (isPMTiles) {
      const { protocol, cleanup } = createPMTilesProtocol();
      addProtocol("pmtiles", protocol.tile);
      pmtilesCleanup = cleanup;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[basemap],
      center: dataset.bounds
        ? [(dataset.bounds[0] + dataset.bounds[2]) / 2, (dataset.bounds[1] + dataset.bounds[3]) / 2]
        : [0, 0],
      zoom: dataset.bounds ? 3 : 2,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      addVectorLayers(map);

      if (dataset.bounds) {
        map.fitBounds(
          [
            [dataset.bounds[0], dataset.bounds[1]],
            [dataset.bounds[2], dataset.bounds[3]],
          ],
          { padding: 40, animate: false },
        );
      }
    });

    mapRef.current = map;
    return () => {
      if (isPMTiles) {
        removeProtocol("pmtiles");
        pmtilesCleanup?.();
      }
      map.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(BASEMAPS[basemap]);
    map.once("style.load", () => {
      addVectorLayers(map);
    });
  }, [basemap, addVectorLayers]);

  return (
    <Box position="relative" w="100%" h="100%">
      <Box ref={containerRef} w="100%" h="100%" />
      <Box position="absolute" top={3} left={3} bg="white" borderRadius="4px" shadow="sm" p={1}>
        <NativeSelect.Root size="xs">
          <NativeSelect.Field
            value={basemap}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBasemap(e.target.value)}
          >
            <option value="streets">Streets</option>
            <option value="satellite">Satellite</option>
            <option value="dark">Dark</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>
    </Box>
  );
}
```

Key changes from the previous version:
- `isPMTiles` detected from `tile_url` prefix
- PMTiles path uses `map.addSource` with `url: pmtilesUrl` (archive URL, not tiles array)
- tipg path unchanged — still uses `tiles: [tileUrl]`
- pmtiles protocol registered on map init, removed on cleanup
- `if (map.getZoom() < 2) map.setZoom(2)` clamp removed — PMTiles handles all zoom levels
- `isInitialMount.current = true` reset at start of `[dataset]` effect — prevents basemap effect from firing spuriously when `addVectorLayers` changes identity after a dataset swap
- Unused `import { config }` removed

- [ ] **Step 2: Rebuild and test with a polygon dataset**

```bash
npm run build
docker compose -f sandbox/docker-compose.yml build frontend
docker compose -f sandbox/docker-compose.yml up -d frontend
```

Upload `sandbox/sample-data/countries.geojson` via the UI at `http://localhost:5185`. The dataset should display at full world view without vertex errors in the console.

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/src/components/VectorMap.tsx
git commit -m "feat(frontend): add PMTiles rendering path to VectorMap; remove zoom clamp"
```

---

### Task 8: Rollback skill workarounds

**Files:**
- Modify: `skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py`
- Modify: `skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py`
- Modify: `skills/geo-conversions/geojson-to-geoparquet/SKILL.md`
- Modify: `skills/geo-conversions/shapefile-to-geoparquet/SKILL.md`

**Background:** The `check_geometry_complexity` check was temporarily changed to return `passed=True` (with a `WARNING:` prefix) to avoid blocking uploads while the sandbox used forced simplification. Now that the pipeline uses PMTiles for polygon/line data, this check should be a hard fail again — it's a valid warning for users loading data directly into PostGIS without the pipeline's PMTiles path.

- [ ] **Step 1: Revert `check_geometry_complexity` in both validate.py files**

In **both** `skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py` and `skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py`, change the over-threshold return from `passed=True` back to `passed=False`, and remove the `WARNING:` prefix:

Find:
```python
    return CheckResult("Geometry complexity", True,
                       f"WARNING: Total vertices: {total_coords:,} exceeds {warn_threshold:,}. "
                       f"Likely to trigger ST_AsMVT 'tolerance condition error (-20)' in tipg "
                       f"and MapLibre 'Max vertices per segment is 65535' errors. "
                       f"Pre-simplify before to_postgis(): "
                       f"gdf.geometry.simplify(0.05, preserve_topology=True)")
```

Replace with:
```python
    return CheckResult("Geometry complexity", False,
                       f"Total vertices: {total_coords:,} exceeds {warn_threshold:,}. "
                       f"Likely to trigger ST_AsMVT 'tolerance condition error (-20)' in tipg "
                       f"and MapLibre 'Max vertices per segment is 65535' errors. "
                       f"Pre-simplify before to_postgis(): "
                       f"gdf.geometry.simplify(0.05, preserve_topology=True)")
```

- [ ] **Step 2: Update SKILL.md known failure modes in both skill files**

In **both** `SKILL.md` files, update the `ST_AsMVT tolerance condition error` failure mode to note that the sandbox pipeline no longer hits this because it routes polygon/line data through PMTiles:

Find the line:
```
- **Complex polygons cause `ST_AsMVT tolerance condition error (-20)` and MapLibre vertex errors**: ...
```

After `gdf.geometry.simplify(0.05, preserve_topology=True)`, add:

```
 **Note:** The CNG Sandbox ingestion pipeline avoids this entirely by routing polygon/line datasets through tippecanoe → PMTiles instead of PostGIS. This failure mode only applies when loading directly into PostGIS.
```

- [ ] **Step 3: Run the validate.py self-tests to confirm the check works**

```bash
cd skills/geo-conversions/geojson-to-geoparquet && python scripts/validate.py
cd skills/geo-conversions/shapefile-to-geoparquet && python scripts/validate.py
```

Expected: Both self-tests PASS (synthetic test data has few vertices, well under the threshold)

- [ ] **Step 4: Update changelogs in both SKILL.md files**

Add to the Changelog section of both files:
```
- 2026-03-15: Sandbox pipeline now uses PMTiles for polygon/line datasets — ST_AsMVT and MapLibre vertex errors no longer apply to the pipeline path. Reverted check_geometry_complexity to hard-fail (passed=False) for standalone PostGIS use.
```

- [ ] **Step 5: Commit**

```bash
git add skills/geo-conversions/geojson-to-geoparquet/scripts/validate.py \
        skills/geo-conversions/shapefile-to-geoparquet/scripts/validate.py \
        skills/geo-conversions/geojson-to-geoparquet/SKILL.md \
        skills/geo-conversions/shapefile-to-geoparquet/SKILL.md
git commit -m "fix(skills): revert geometry complexity check to hard-fail; update failure mode docs"
```
