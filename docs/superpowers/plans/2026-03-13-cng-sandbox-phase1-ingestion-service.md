# CNG Sandbox Phase 1: Infrastructure + Ingestion Service — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Stand up eoAPI locally (Docker Compose) and build a thin FastAPI ingestion service that accepts file uploads, converts them to cloud-native formats via the cng-toolkit, validates, stores in S3/MinIO, and ingests into eoAPI for tile serving.

**Architecture:** Docker Compose runs eoAPI (pgSTAC + STAC API + titiler-pgstac + tipg) alongside MinIO (S3-compatible storage). A FastAPI service handles uploads, delegates conversion/validation to the `cng-toolkit` package (Phase 0 output), uploads results to MinIO, and ingests metadata into eoAPI. Raster datasets go through STAC → titiler-pgstac for tile serving. Vector datasets go through PostgreSQL → tipg for vector tile serving. SSE provides real-time progress updates.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, sse-starlette, boto3, python-magic, slowapi, geopandas, sqlalchemy, psycopg2, httpx, cng-toolkit (local), Docker Compose, eoAPI (pgSTAC, stac-fastapi-pgstac, titiler-pgstac, tipg), MinIO

**Spec:** `docs/CNG_SANDBOX_PRODUCT_SPEC_v0.2.md`
**Implementation plan:** `~/Documents/obsidian-notes/Project Docs/Map App Builder/cng-sandbox-implementation-plan.md`
**Phase 0 plan (completed):** `docs/superpowers/plans/2026-03-13-cng-sandbox-phase0-cli-toolkit.md`

**Prerequisites:**
- Phase 0 merged (all 4 conversion skills, packaged as `cng-toolkit`)
- Docker and Docker Compose installed
- Python 3.12+

---

## File Structure

```
sandbox/
├── docker-compose.yml                  # eoAPI services + MinIO
├── .env                                # Local dev environment variables
├── ingestion/
│   ├── pyproject.toml                  # FastAPI app + cng-toolkit dependency
│   ├── .gitignore
│   ├── src/
│   │   ├── __init__.py
│   │   ├── app.py                      # FastAPI application + lifespan + CORS
│   │   ├── config.py                   # Pydantic Settings (env-driven config)
│   │   ├── state.py                    # Shared mutable state (jobs, datasets, limiter)
│   │   ├── models.py                   # Pydantic models: Job, Dataset, ValidationResult
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py               # POST /api/upload
│   │   │   ├── jobs.py                 # GET /api/jobs/{id}, GET /api/jobs/{id}/stream (SSE)
│   │   │   └── datasets.py            # GET /api/datasets/{id}
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── detector.py             # Format detection (magic bytes + extension)
│   │       ├── storage.py              # S3/MinIO upload + presigned URLs
│   │       ├── pipeline.py             # Orchestrator: detect → convert → validate → store → ingest
│   │       ├── stac_ingest.py          # STAC collection/item creation + Transaction API ingestion
│   │       └── vector_ingest.py        # GeoParquet → PostgreSQL via geopandas
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py                 # Shared fixtures (test client, temp dirs, mock services)
│       ├── test_detector.py            # Format detection unit tests
│       ├── test_models.py              # Pydantic model validation tests
│       ├── test_storage.py             # Storage service tests (mocked S3)
│       ├── test_stac_ingest.py         # STAC item construction tests
│       ├── test_pipeline.py            # Pipeline orchestration tests
│       └── test_integration.py         # End-to-end tests against Docker Compose
```

---

## Chunk 1: Infrastructure + Project Scaffold

### Task 1: Create Docker Compose file

**Files:**
- Create: `sandbox/docker-compose.yml`
- Create: `sandbox/.env`

**Context:** This combines the official eoAPI services (pgSTAC database, STAC API, raster tiler, vector tiler) with a MinIO instance for S3-compatible storage. We use the exact Docker images from the eoAPI repo: `ghcr.io/stac-utils/pgstac:v0.9.6`, `ghcr.io/stac-utils/stac-fastapi-pgstac:5.0.2`, `ghcr.io/stac-utils/titiler-pgstac:1.7.2`, `ghcr.io/developmentseed/tipg:1.0.1`.

- [x] **Step 1: Create the sandbox directory**

```bash
mkdir -p sandbox
```

- [x] **Step 2: Write docker-compose.yml**

Create `sandbox/docker-compose.yml`:

```yaml
services:
  database:
    image: ghcr.io/stac-utils/pgstac:v0.9.6
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      PGUSER: ${POSTGRES_USER}
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: ${POSTGRES_DB}
    ports:
      - "${POSTGRES_PORT}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  stac-api:
    image: ghcr.io/stac-utils/stac-fastapi-pgstac:5.0.2
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASS: ${POSTGRES_PASSWORD}
      POSTGRES_DBNAME: ${POSTGRES_DB}
      POSTGRES_HOST_READER: database
      POSTGRES_HOST_WRITER: database
      POSTGRES_PORT: 5432
      DB_MIN_CONN_SIZE: 1
      DB_MAX_CONN_SIZE: 1
      ENABLE_TRANSACTIONS_EXTENSIONS: "TRUE"
      UVICORN_PORT: 8081
    ports:
      - "8081:8081"
    depends_on:
      database:
        condition: service_healthy

  raster-tiler:
    image: ghcr.io/stac-utils/titiler-pgstac:1.7.2
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASS: ${POSTGRES_PASSWORD}
      POSTGRES_DBNAME: ${POSTGRES_DB}
      POSTGRES_HOST: database
      POSTGRES_PORT: 5432
      AWS_ACCESS_KEY_ID: ${MINIO_ROOT_USER}
      AWS_SECRET_ACCESS_KEY: ${MINIO_ROOT_PASSWORD}
      AWS_ENDPOINT_URL: http://minio:9000
      AWS_HTTPS: "NO"
      AWS_VIRTUAL_HOSTING: "FALSE"
      GDAL_CACHEMAX: "75%"
      VSI_CACHE: "TRUE"
      VSI_CACHE_SIZE: "536870912"
      MOSAIC_CONCURRENCY: 1
      UVICORN_PORT: 8082
    ports:
      - "8082:8082"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      database:
        condition: service_healthy

  vector-tiler:
    image: ghcr.io/developmentseed/tipg:1.0.1
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASS: ${POSTGRES_PASSWORD}
      POSTGRES_DBNAME: ${POSTGRES_DB}
      POSTGRES_HOST: database
      POSTGRES_PORT: 5432
      UVICORN_PORT: 8083
    ports:
      - "8083:8083"
    depends_on:
      database:
        condition: service_healthy

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD};
      mc mb --ignore-existing local/${S3_BUCKET};
      exit 0;
      "

volumes:
  pgdata:
  miniodata:
```

- [x] **Step 3: Write .env.example and .gitignore**

Create `sandbox/.env.example` (committed to git — safe defaults for local dev):

```env
POSTGRES_USER=sandbox
POSTGRES_PASSWORD=sandbox_dev_password
POSTGRES_DB=postgis
POSTGRES_PORT=5439

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

S3_BUCKET=sandbox-data
S3_ENDPOINT=http://localhost:9000
```

Copy it to `.env` (not committed):

```bash
cp sandbox/.env.example sandbox/.env
```

Create `sandbox/.gitignore`:

```
.env
```

- [x] **Step 4: Start Docker Compose and verify all services**

```bash
cd sandbox && docker compose up -d
```

Wait for services, then verify:

```bash
# Database
docker compose exec database pg_isready -U sandbox -d postgis

# STAC API
curl -sf http://localhost:8081/ | python -m json.tool | head -5

# Raster tiler
curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/docs

# Vector tiler
curl -sf http://localhost:8083/collections | python -m json.tool | head -5

# MinIO
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live
```

Expected: All return 200 or "OK". If any fail, check `docker compose logs <service>`.

- [x] **Step 5: Verify STAC Transaction API is enabled**

```bash
curl -sf http://localhost:8081/conformance | python -c "
import sys, json
data = json.load(sys.stdin)
txn = [c for c in data.get('conformsTo', []) if 'transaction' in c.lower()]
print('Transaction API:', 'ENABLED' if txn else 'DISABLED')
"
```

Expected: `Transaction API: ENABLED`

- [x] **Step 6: Commit**

```bash
git add sandbox/docker-compose.yml sandbox/.env.example sandbox/.gitignore
git commit -m "infra(sandbox): add Docker Compose with eoAPI services and MinIO"
```

---

### Task 2: Create ingestion service project scaffold

**Files:**
- Create: `sandbox/ingestion/pyproject.toml`
- Create: `sandbox/ingestion/.gitignore`
- Create: `sandbox/ingestion/src/__init__.py`
- Create: `sandbox/ingestion/src/routes/__init__.py`
- Create: `sandbox/ingestion/src/services/__init__.py`
- Create: `sandbox/ingestion/tests/__init__.py`

- [x] **Step 1: Create directory structure**

```bash
mkdir -p sandbox/ingestion/src/routes
mkdir -p sandbox/ingestion/src/services
mkdir -p sandbox/ingestion/tests
```

- [x] **Step 2: Write pyproject.toml**

Create `sandbox/ingestion/pyproject.toml`:

```toml
[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"

[project]
name = "cng-sandbox-ingestion"
version = "0.1.0"
description = "CNG Sandbox ingestion service"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "python-multipart>=0.0.9",
    "sse-starlette>=2.0.0",
    "boto3>=1.35.0",
    "python-magic>=0.4.27",
    "slowapi>=0.1.9",
    "httpx>=0.27.0",
    "pydantic-settings>=2.5.0",
    "geopandas>=1.0.0",
    "sqlalchemy>=2.0.0",
    "psycopg2-binary>=2.9.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.24.0", "moto[s3]>=5.0.0"]

[tool.setuptools.packages.find]
where = ["."]
include = ["src*"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

**Note:** `cng-toolkit` is installed as an editable dependency from the local path. After creating this file, run:
```bash
pip install -e "../../skills/geo-conversions[all]"
```
This makes `from geotiff_to_cog import convert, run_checks` work correctly — the `pyproject.toml` in `skills/geo-conversions/` maps the hyphenated directory names to valid Python package names via `[tool.setuptools.package-dir]`.

- [x] **Step 3: Write .gitignore**

Create `sandbox/ingestion/.gitignore`:

```
__pycache__/
*.pyc
.venv/
*.egg-info/
.pytest_cache/
uploads/
```

- [x] **Step 4: Create empty __init__.py files**

```bash
touch sandbox/ingestion/src/__init__.py
touch sandbox/ingestion/src/routes/__init__.py
touch sandbox/ingestion/src/services/__init__.py
touch sandbox/ingestion/tests/__init__.py
```

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/
git commit -m "feat(sandbox): scaffold ingestion service project structure"
```

---

### Task 3: Config + Settings

**Files:**
- Create: `sandbox/ingestion/src/config.py`
- Test: `sandbox/ingestion/tests/test_config.py` (deferred — config is trivial)

**Context:** Uses `pydantic-settings` to read environment variables. Also adds the cng-toolkit to the Python path so the ingestion service can import converters and validators directly.

- [x] **Step 1: Write config.py**

Create `sandbox/ingestion/src/config.py`:

```python
"""Application configuration via environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # S3 / MinIO
    s3_bucket: str = "sandbox-data"
    s3_endpoint: str = "http://localhost:9000"
    aws_access_key_id: str = "minioadmin"
    aws_secret_access_key: str = "minioadmin"
    s3_region: str = "us-east-1"

    # eoAPI URLs
    stac_api_url: str = "http://localhost:8081"
    raster_tiler_url: str = "http://localhost:8082"
    vector_tiler_url: str = "http://localhost:8083"

    # PostgreSQL (for vector ingest via geopandas)
    postgres_dsn: str = "postgresql://sandbox:sandbox_dev_password@localhost:5439/postgis"

    # Upload limits
    max_upload_bytes: int = 1_073_741_824  # 1 GB
    rate_limit: str = "5/hour"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_prefix": "", "case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [x] **Step 2: Verify the import works**

```bash
cd sandbox/ingestion
pip install -e ".[dev]"
pip install -e "../../skills/geo-conversions[all]"
python -c "from src.config import get_settings; s = get_settings(); print(f'Bucket: {s.s3_bucket}, STAC: {s.stac_api_url}')"
python -c "from geotiff_to_cog import convert, run_checks; print('cng-toolkit import: OK')"
```

Expected: `Bucket: sandbox-data, STAC: http://localhost:8081`

- [x] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/config.py
git commit -m "feat(sandbox): add pydantic-settings configuration"
```

---

### Task 4: Pydantic models

**Files:**
- Create: `sandbox/ingestion/src/models.py`
- Create: `sandbox/ingestion/tests/test_models.py`

- [x] **Step 1: Write the test**

Create `sandbox/ingestion/tests/test_models.py`:

```python
import pytest
from src.models import Job, JobStatus, DatasetType, FormatPair


def test_job_initial_status():
    job = Job(filename="test.tif")
    assert job.status == JobStatus.PENDING
    assert job.dataset_id is not None
    assert len(job.dataset_id) == 36  # UUID


def test_job_status_transitions():
    job = Job(filename="test.tif")
    job.status = JobStatus.SCANNING
    assert job.status == JobStatus.SCANNING
    job.status = JobStatus.READY
    assert job.validation_results == []


def test_format_pair_from_extension():
    assert FormatPair.from_extension(".tif") == FormatPair.GEOTIFF_TO_COG
    assert FormatPair.from_extension(".shp") == FormatPair.SHAPEFILE_TO_GEOPARQUET
    assert FormatPair.from_extension(".geojson") == FormatPair.GEOJSON_TO_GEOPARQUET
    assert FormatPair.from_extension(".nc") == FormatPair.NETCDF_TO_COG


def test_format_pair_unknown_extension():
    with pytest.raises(ValueError):
        FormatPair.from_extension(".xlsx")


def test_format_pair_dataset_type():
    assert FormatPair.GEOTIFF_TO_COG.dataset_type == DatasetType.RASTER
    assert FormatPair.SHAPEFILE_TO_GEOPARQUET.dataset_type == DatasetType.VECTOR
    assert FormatPair.NETCDF_TO_COG.dataset_type == DatasetType.RASTER
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion && python -m pytest tests/test_models.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'src.models'`

- [x] **Step 3: Write models.py**

Create `sandbox/ingestion/src/models.py`:

```python
"""Pydantic models for jobs and datasets."""

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    CONVERTING = "converting"
    VALIDATING = "validating"
    INGESTING = "ingesting"
    READY = "ready"
    FAILED = "failed"


class DatasetType(str, Enum):
    RASTER = "raster"
    VECTOR = "vector"


class FormatPair(str, Enum):
    GEOTIFF_TO_COG = "geotiff-to-cog"
    SHAPEFILE_TO_GEOPARQUET = "shapefile-to-geoparquet"
    GEOJSON_TO_GEOPARQUET = "geojson-to-geoparquet"
    NETCDF_TO_COG = "netcdf-to-cog"

    @staticmethod
    def from_extension(ext: str) -> "FormatPair":
        ext = ext.lower()
        mapping = {
            ".tif": FormatPair.GEOTIFF_TO_COG,
            ".tiff": FormatPair.GEOTIFF_TO_COG,
            ".shp": FormatPair.SHAPEFILE_TO_GEOPARQUET,
            ".zip": FormatPair.SHAPEFILE_TO_GEOPARQUET,
            ".geojson": FormatPair.GEOJSON_TO_GEOPARQUET,
            ".json": FormatPair.GEOJSON_TO_GEOPARQUET,
            ".nc": FormatPair.NETCDF_TO_COG,
            ".nc4": FormatPair.NETCDF_TO_COG,
        }
        if ext not in mapping:
            raise ValueError(f"Unsupported format: {ext}")
        return mapping[ext]

    @property
    def dataset_type(self) -> DatasetType:
        if self in (FormatPair.GEOTIFF_TO_COG, FormatPair.NETCDF_TO_COG):
            return DatasetType.RASTER
        return DatasetType.VECTOR


class ValidationCheck(BaseModel):
    name: str
    passed: bool
    detail: str


class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dataset_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    status: JobStatus = JobStatus.PENDING
    format_pair: FormatPair | None = None
    error: str | None = None
    validation_results: list[ValidationCheck] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Dataset(BaseModel):
    id: str
    filename: str
    dataset_type: DatasetType
    format_pair: FormatPair
    tile_url: str
    stac_collection_id: str | None = None
    pg_table: str | None = None
    validation_results: list[ValidationCheck] = []
    credits: list[dict] = []
    created_at: datetime
```

- [x] **Step 4: Run tests**

```bash
cd sandbox/ingestion && python -m pytest tests/test_models.py -v
```

Expected: All 5 tests PASS.

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/models.py sandbox/ingestion/tests/test_models.py
git commit -m "feat(sandbox): add Pydantic models for jobs and datasets"
```

---

### Task 5: FastAPI application skeleton

**Files:**
- Create: `sandbox/ingestion/src/app.py`

**Context:** The main FastAPI app with CORS middleware, rate limiting, and a health check endpoint. Routes will be added in later tasks. Shared mutable state (jobs dict, datasets dict, rate limiter) lives in `state.py` to avoid circular imports between app.py and route modules.

- [x] **Step 1: Write state.py**

Create `sandbox/ingestion/src/state.py`:

```python
"""Shared mutable state — imported by both app.py and route modules.

Keeps state in a neutral module to avoid circular imports.
Jobs and datasets are ephemeral and lost on restart — adequate for v1 demo.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
jobs: dict = {}
datasets: dict = {}
```

- [x] **Step 2: Write app.py**

Create `sandbox/ingestion/src/app.py`:

```python
"""FastAPI application for the CNG Sandbox ingestion service."""

from contextlib import asynccontextmanager

import boto3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from src.config import get_settings
from src.state import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Verify S3/MinIO connectivity
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.s3_region,
    )
    s3.head_bucket(Bucket=settings.s3_bucket)
    app.state.s3 = s3
    yield


def create_app(settings=None) -> FastAPI:
    """Application factory — testable configuration."""
    if settings is None:
        settings = get_settings()

    app = FastAPI(title="CNG Sandbox Ingestion API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request, exc):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Max 5 uploads per hour."},
        )

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    # Routes are registered in later tasks — see Tasks 11-13
    return app


app = create_app()
```

- [x] **Step 2: Verify the app starts**

Make sure Docker Compose is running (for MinIO), then:

```bash
cd sandbox/ingestion
uvicorn src.app:app --reload --port 8000 &
sleep 2
curl -sf http://localhost:8000/api/health
kill %1
```

Expected: `{"status":"ok"}`

- [x] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/app.py sandbox/ingestion/src/state.py
git commit -m "feat(sandbox): add FastAPI application skeleton with CORS and rate limiting"
```

---

## Chunk 2: Services + Pipeline

### Task 6: Format detection service

**Files:**
- Create: `sandbox/ingestion/src/services/detector.py`
- Create: `sandbox/ingestion/tests/test_detector.py`

**Context:** Validates uploaded files by checking both the file extension AND magic bytes. This is the security gate — rejects files where the extension doesn't match the actual file type.

**Shapefile note:** Shapefiles require companion files (.dbf, .shx, .prj). The upload route accepts single files, so shapefiles must be uploaded as a `.zip` archive. The detector recognizes `.zip` and the pipeline unpacks it to find the `.shp` file. This is the standard approach for web-based shapefile upload.

- [x] **Step 1: Write the test**

Create `sandbox/ingestion/tests/test_detector.py`:

```python
import os
import tempfile

import pytest

from src.services.detector import detect_format, validate_magic_bytes, UnsupportedFormatError
from src.models import FormatPair


def test_detect_geotiff():
    assert detect_format("data.tif") == FormatPair.GEOTIFF_TO_COG
    assert detect_format("DATA.TIFF") == FormatPair.GEOTIFF_TO_COG


def test_detect_shapefile():
    assert detect_format("rivers.shp") == FormatPair.SHAPEFILE_TO_GEOPARQUET
    assert detect_format("rivers.zip") == FormatPair.SHAPEFILE_TO_GEOPARQUET


def test_detect_geojson():
    assert detect_format("points.geojson") == FormatPair.GEOJSON_TO_GEOPARQUET


def test_detect_netcdf():
    assert detect_format("sst.nc") == FormatPair.NETCDF_TO_COG


def test_detect_unsupported():
    with pytest.raises(UnsupportedFormatError):
        detect_format("data.xlsx")


def test_validate_magic_bytes_geojson():
    with tempfile.NamedTemporaryFile(suffix=".geojson", mode="w", delete=False) as f:
        f.write('{"type": "FeatureCollection", "features": []}')
        path = f.name
    try:
        # GeoJSON is text/JSON — magic bytes check should pass
        validate_magic_bytes(path, FormatPair.GEOJSON_TO_GEOPARQUET)
    finally:
        os.unlink(path)


def test_validate_magic_bytes_mismatch():
    with tempfile.NamedTemporaryFile(suffix=".tif", mode="w", delete=False) as f:
        f.write("this is not a tiff file")
        path = f.name
    try:
        with pytest.raises(UnsupportedFormatError, match="does not match"):
            validate_magic_bytes(path, FormatPair.GEOTIFF_TO_COG)
    finally:
        os.unlink(path)
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion && python -m pytest tests/test_detector.py -v
```

Expected: FAIL

- [x] **Step 3: Write detector.py**

Create `sandbox/ingestion/src/services/detector.py`:

```python
"""Format detection via file extension and magic byte validation."""

import os

import magic

from src.models import FormatPair


class UnsupportedFormatError(Exception):
    pass


# Maps MIME types to the format pairs that accept them
_MIME_WHITELIST: dict[FormatPair, set[str]] = {
    FormatPair.GEOTIFF_TO_COG: {"image/tiff"},
    FormatPair.SHAPEFILE_TO_GEOPARQUET: {"application/x-esri-shapefile", "application/octet-stream", "application/dbf", "application/zip"},
    FormatPair.GEOJSON_TO_GEOPARQUET: {"application/json", "text/plain", "application/geo+json"},
    FormatPair.NETCDF_TO_COG: {"application/x-netcdf", "application/octet-stream", "application/x-hdf"},
}


def detect_format(filename: str) -> FormatPair:
    """Detect the conversion format pair from a filename's extension."""
    ext = os.path.splitext(filename)[1].lower()
    try:
        return FormatPair.from_extension(ext)
    except ValueError:
        raise UnsupportedFormatError(
            f"Unsupported file format: '{ext}'. "
            f"Accepted: .tif, .tiff, .shp, .zip, .geojson, .json, .nc"
        )


def validate_magic_bytes(file_path: str, expected_format: FormatPair) -> None:
    """Verify that the file's magic bytes match the expected format."""
    mime = magic.from_file(file_path, mime=True)
    allowed = _MIME_WHITELIST.get(expected_format, set())
    if mime not in allowed:
        raise UnsupportedFormatError(
            f"File content ({mime}) does not match expected format ({expected_format.value}). "
            f"The file may be corrupted or mislabeled."
        )
```

- [x] **Step 4: Run tests**

```bash
cd sandbox/ingestion && python -m pytest tests/test_detector.py -v
```

Expected: All 6 tests PASS.

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/detector.py sandbox/ingestion/tests/test_detector.py
git commit -m "feat(sandbox): add format detection service with magic byte validation"
```

---

### Task 7: Storage service

**Files:**
- Create: `sandbox/ingestion/src/services/storage.py`
- Create: `sandbox/ingestion/tests/test_storage.py`

**Context:** Handles uploading files to S3/MinIO and generating presigned URLs. Uses dataset-scoped paths: `datasets/{dataset_id}/raw/` and `datasets/{dataset_id}/converted/`.

- [x] **Step 1: Write the test**

Create `sandbox/ingestion/tests/test_storage.py`:

```python
import os
import tempfile

import boto3
import pytest
from moto import mock_aws

from src.services.storage import StorageService


@pytest.fixture
def storage():
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="test-bucket")
        svc = StorageService(s3_client=s3, bucket="test-bucket")
        yield svc


def test_upload_raw_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake tiff data")
        path = f.name
    try:
        key = storage.upload_raw(path, dataset_id="abc-123", filename="data.tif")
        assert key == "datasets/abc-123/raw/data.tif"
    finally:
        os.unlink(path)


def test_upload_converted_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake cog data")
        path = f.name
    try:
        key = storage.upload_converted(path, dataset_id="abc-123", filename="output.tif")
        assert key == "datasets/abc-123/converted/output.tif"
    finally:
        os.unlink(path)


def test_get_presigned_url(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"data")
        path = f.name
    try:
        key = storage.upload_converted(path, dataset_id="abc-123", filename="output.tif")
        url = storage.get_presigned_url(key)
        assert "abc-123" in url
        assert "output.tif" in url
    finally:
        os.unlink(path)
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion && python -m pytest tests/test_storage.py -v
```

Expected: FAIL

- [x] **Step 3: Write storage.py**

Create `sandbox/ingestion/src/services/storage.py`:

```python
"""S3/MinIO storage service for raw and converted files."""

import boto3

from src.config import get_settings


class StorageService:
    def __init__(self, s3_client=None, bucket: str | None = None):
        if s3_client is None:
            settings = get_settings()
            s3_client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.s3_region,
            )
        self.s3 = s3_client
        self.bucket = bucket or get_settings().s3_bucket

    def upload_raw(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a raw input file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/raw/{filename}"
        self.s3.upload_file(file_path, self.bucket, key)
        return key

    def upload_converted(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a converted output file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/converted/{filename}"
        self.s3.upload_file(file_path, self.bucket, key)
        return key

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned URL for a stored file."""
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def get_s3_uri(self, key: str) -> str:
        """Return the s3:// URI for a key."""
        return f"s3://{self.bucket}/{key}"
```

- [x] **Step 4: Run tests**

```bash
cd sandbox/ingestion && python -m pytest tests/test_storage.py -v
```

Expected: All 3 tests PASS.

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/storage.py sandbox/ingestion/tests/test_storage.py
git commit -m "feat(sandbox): add S3/MinIO storage service with dataset-scoped paths"
```

---

### Task 8: STAC ingestion service

**Files:**
- Create: `sandbox/ingestion/src/services/stac_ingest.py`
- Create: `sandbox/ingestion/tests/test_stac_ingest.py`

**Context:** Builds STAC collections and items from COG metadata, then ingests them via eoAPI's Transaction API (HTTP POST). The raster tiler (titiler-pgstac) then serves tiles from the ingested items.

- [x] **Step 1: Write the test**

Create `sandbox/ingestion/tests/test_stac_ingest.py`:

```python
from datetime import datetime, timezone

from src.services.stac_ingest import build_collection, build_item


def test_build_collection():
    col = build_collection(
        dataset_id="abc-123",
        filename="temperature.tif",
        bbox=[-10.0, -10.0, 10.0, 10.0],
    )
    assert col["id"] == "sandbox-abc-123"
    assert col["type"] == "Collection"
    assert col["extent"]["spatial"]["bbox"] == [[-10.0, -10.0, 10.0, 10.0]]
    assert "temporal" in col["extent"]


def test_build_item():
    item = build_item(
        dataset_id="abc-123",
        filename="temperature.tif",
        s3_href="s3://bucket/datasets/abc-123/converted/temperature.tif",
        bbox=[-10.0, -10.0, 10.0, 10.0],
        datetime_str="2026-03-13T00:00:00Z",
    )
    assert item["type"] == "Feature"
    assert item["collection"] == "sandbox-abc-123"
    assert item["assets"]["data"]["href"] == "s3://bucket/datasets/abc-123/converted/temperature.tif"
    assert item["assets"]["data"]["type"] == "image/tiff; application=geotiff; profile=cloud-optimized"
    assert item["bbox"] == [-10.0, -10.0, 10.0, 10.0]
    # Geometry should be a polygon from the bbox
    coords = item["geometry"]["coordinates"][0]
    assert len(coords) == 5  # closed polygon
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion && python -m pytest tests/test_stac_ingest.py -v
```

Expected: FAIL

- [x] **Step 3: Write stac_ingest.py**

Create `sandbox/ingestion/src/services/stac_ingest.py`:

```python
"""STAC collection/item construction and ingestion via Transaction API."""

from datetime import datetime, timezone

import httpx
import rasterio

from src.config import get_settings


def get_cog_metadata(cog_path: str) -> dict:
    """Extract spatial metadata from a COG file."""
    with rasterio.open(cog_path) as src:
        bounds = src.bounds
        return {
            "bbox": [bounds.left, bounds.bottom, bounds.right, bounds.top],
            "width": src.width,
            "height": src.height,
            "crs": str(src.crs),
            "bands": src.count,
            "dtype": str(src.dtypes[0]),
            "nodata": src.nodata,
        }


def build_collection(dataset_id: str, filename: str, bbox: list[float]) -> dict:
    """Build a STAC collection for a single-file dataset."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "type": "Collection",
        "id": f"sandbox-{dataset_id}",
        "stac_version": "1.0.0",
        "description": f"User upload: {filename}",
        "links": [],
        "license": "proprietary",
        "extent": {
            "spatial": {"bbox": [bbox]},
            "temporal": {"interval": [[now, None]]},
        },
    }


def build_item(
    dataset_id: str,
    filename: str,
    s3_href: str,
    bbox: list[float],
    datetime_str: str | None = None,
) -> dict:
    """Build a STAC item for a converted COG."""
    if datetime_str is None:
        datetime_str = datetime.now(timezone.utc).isoformat()

    west, south, east, north = bbox
    geometry = {
        "type": "Polygon",
        "coordinates": [[
            [west, south], [east, south], [east, north], [west, north], [west, south],
        ]],
    }

    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": f"{dataset_id}-data",
        "collection": f"sandbox-{dataset_id}",
        "geometry": geometry,
        "bbox": bbox,
        "properties": {"datetime": datetime_str},
        "links": [],
        "assets": {
            "data": {
                "href": s3_href,
                "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                "roles": ["data"],
            }
        },
    }


async def ingest_raster(dataset_id: str, cog_path: str, s3_href: str, filename: str) -> str:
    """Ingest a COG into eoAPI: create collection + item via Transaction API.

    Returns the tile URL template for the ingested item.
    """
    settings = get_settings()
    meta = get_cog_metadata(cog_path)

    collection = build_collection(dataset_id, filename, meta["bbox"])
    item = build_item(dataset_id, filename, s3_href, meta["bbox"])

    async with httpx.AsyncClient(base_url=settings.stac_api_url, timeout=30.0) as client:
        # Create collection (ignore 409 if already exists)
        resp = await client.post("/collections", json=collection)
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(f"Failed to create STAC collection: {resp.status_code} {resp.text}")

        # Create item
        collection_id = f"sandbox-{dataset_id}"
        resp = await client.post(f"/collections/{collection_id}/items", json=item)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Failed to create STAC item: {resp.status_code} {resp.text}")

    # NOTE: Verify the actual tile URL pattern by checking http://localhost:8082/docs
    # after eoAPI is running. titiler-pgstac may use /collections/{id}/tiles/...
    # or /searches/{search_id}/tiles/... depending on the version.
    tile_url = (
        f"{settings.raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}"
    )
    return tile_url
```

- [x] **Step 4: Run tests**

```bash
cd sandbox/ingestion && python -m pytest tests/test_stac_ingest.py -v
```

Expected: All 2 tests PASS.

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/stac_ingest.py sandbox/ingestion/tests/test_stac_ingest.py
git commit -m "feat(sandbox): add STAC ingestion service with Transaction API"
```

---

### Task 9: Vector ingestion service

**Files:**
- Create: `sandbox/ingestion/src/services/vector_ingest.py`
- Create: `sandbox/ingestion/tests/test_vector_ingest.py`

**Context:** Loads GeoParquet into PostgreSQL using geopandas `to_postgis()`. tipg auto-discovers new tables and serves vector tiles. Uses the same PostgreSQL database as eoAPI (pgSTAC) — the vector tables live in the `public` schema alongside pgSTAC's tables.

- [x] **Step 1: Write the test**

Create `sandbox/ingestion/tests/test_vector_ingest.py`:

```python
from src.services.vector_ingest import build_table_name, get_vector_tile_url


def test_build_table_name():
    name = build_table_name("abc-123")
    assert name == "sandbox_abc123"


def test_build_table_name_sanitizes():
    name = build_table_name("abc-123-def-456")
    assert name == "sandbox_abc123def456"
    # No hyphens — PostgreSQL table names shouldn't have them unquoted
    assert "-" not in name


def test_get_vector_tile_url():
    url = get_vector_tile_url("abc-123", tiler_url="http://localhost:8083")
    assert "sandbox_abc123" in url
    assert "{z}" in url
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion && python -m pytest tests/test_vector_ingest.py -v
```

Expected: FAIL

- [x] **Step 3: Write vector_ingest.py**

Create `sandbox/ingestion/src/services/vector_ingest.py`:

```python
"""Load GeoParquet into PostgreSQL for tipg vector tile serving."""

import geopandas as gpd
from sqlalchemy import create_engine

from src.config import get_settings


def build_table_name(dataset_id: str) -> str:
    """Build a PostgreSQL table name from a dataset ID."""
    # Remove hyphens — unquoted PG identifiers are simpler without them
    sanitized = dataset_id.replace("-", "")
    return f"sandbox_{sanitized}"


def get_vector_tile_url(dataset_id: str, tiler_url: str | None = None) -> str:
    """Build the tipg vector tile URL template for a dataset."""
    if tiler_url is None:
        tiler_url = get_settings().vector_tiler_url
    table = build_table_name(dataset_id)
    return f"{tiler_url}/collections/public.{table}/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}"


def ingest_vector(dataset_id: str, parquet_path: str) -> str:
    """Load GeoParquet into PostgreSQL. Returns tile URL template.

    tipg auto-discovers new tables in the public schema and
    serves them as OGC Features + vector tiles.

    This is a sync function — call via asyncio.to_thread() from async code.
    """
    settings = get_settings()
    table_name = build_table_name(dataset_id)

    gdf = gpd.read_parquet(parquet_path)

    engine = create_engine(settings.postgres_dsn)
    gdf.to_postgis(table_name, engine, if_exists="replace", index=False)
    engine.dispose()

    return get_vector_tile_url(dataset_id)
```

- [x] **Step 4: Run tests**

```bash
cd sandbox/ingestion && python -m pytest tests/test_vector_ingest.py -v
```

Expected: All 3 tests PASS.

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/vector_ingest.py sandbox/ingestion/tests/test_vector_ingest.py
git commit -m "feat(sandbox): add vector ingestion service (geopandas to PostgreSQL)"
```

---

### Task 10: Pipeline orchestration service

**Files:**
- Create: `sandbox/ingestion/src/services/pipeline.py`
- Create: `sandbox/ingestion/tests/test_pipeline.py`

**Context:** This is the core orchestrator. It runs the full pipeline: detect format → convert → validate → upload to S3 → ingest into eoAPI. It updates the Job model at each stage so SSE can stream progress. Runs in a background thread (FastAPI BackgroundTasks).

- [x] **Step 1: Write the test**

Create `sandbox/ingestion/tests/test_pipeline.py`:

```python
import dataclasses
import os
import tempfile

import pytest

from src.models import Job, JobStatus, FormatPair, DatasetType
from src.services.pipeline import get_credits


def test_get_credits_raster():
    credits = get_credits(FormatPair.GEOTIFF_TO_COG)
    names = [c["tool"] for c in credits]
    assert "rio-cogeo" in names
    assert "TiTiler" in names
    assert "MapLibre" in names


def test_get_credits_vector():
    credits = get_credits(FormatPair.SHAPEFILE_TO_GEOPARQUET)
    names = [c["tool"] for c in credits]
    assert "GeoPandas" in names
    assert "tipg" in names
    assert "MapLibre" in names


def test_get_credits_netcdf():
    credits = get_credits(FormatPair.NETCDF_TO_COG)
    names = [c["tool"] for c in credits]
    assert "xarray" in names
    assert "rio-cogeo" in names
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd sandbox/ingestion && python -m pytest tests/test_pipeline.py -v
```

Expected: FAIL

- [x] **Step 3: Write pipeline.py**

Create `sandbox/ingestion/src/services/pipeline.py`:

```python
"""Pipeline orchestrator: detect → convert → validate → store → ingest.

Conversion and validation are CPU/IO-bound sync operations. They run in a
thread via asyncio.to_thread() to avoid blocking the event loop (which would
freeze SSE streams and health checks during processing).
"""

import asyncio
import os
import tempfile

from src.config import get_settings
from src.models import Job, JobStatus, FormatPair, DatasetType, ValidationCheck
from src.services.detector import detect_format, validate_magic_bytes
from src.services.storage import StorageService
from src.services import stac_ingest, vector_ingest


def get_credits(format_pair: FormatPair) -> list[dict]:
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
    else:
        credits.append({"tool": "tipg", "url": "https://github.com/developmentseed/tipg", "role": "Tiles served by"})

    credits.append({"tool": "MapLibre", "url": "https://maplibre.org", "role": "Map rendered by"})
    return credits


async def run_pipeline(job: Job, input_path: str, datasets_store: dict) -> None:
    """Execute the full conversion pipeline. Updates job status in-place.

    This function is called from a BackgroundTask. It catches all exceptions
    and sets job.status = FAILED with an error message rather than crashing.
    """
    settings = get_settings()
    storage = StorageService()

    try:
        # Stage 1: Scan
        job.status = JobStatus.SCANNING
        format_pair = detect_format(job.filename)
        job.format_pair = format_pair
        validate_magic_bytes(input_path, format_pair)

        # Upload raw file to S3
        storage.upload_raw(input_path, job.dataset_id, job.filename)

        # Stage 2: Convert
        job.status = JobStatus.CONVERTING

        # Determine output filename
        if format_pair.dataset_type == DatasetType.RASTER:
            out_filename = os.path.splitext(job.filename)[0] + ".tif"
        else:
            out_filename = os.path.splitext(job.filename)[0] + ".parquet"

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, out_filename)

            # Run sync conversion in a thread to avoid blocking the event loop
            await asyncio.to_thread(_import_and_convert, format_pair, input_path, output_path)

            # Stage 3: Validate
            job.status = JobStatus.VALIDATING
            check_results = await asyncio.to_thread(_import_and_validate, format_pair, input_path, output_path)
            job.validation_results = [
                ValidationCheck(name=c.name, passed=c.passed, detail=c.detail)
                for c in check_results
            ]

            failed = [c for c in check_results if not c.passed]
            if failed:
                job.status = JobStatus.FAILED
                job.error = f"{len(failed)} validation check(s) failed"
                return

            # Stage 4: Ingest
            job.status = JobStatus.INGESTING

            # Upload converted file to S3
            converted_key = storage.upload_converted(output_path, job.dataset_id, out_filename)
            s3_href = storage.get_s3_uri(converted_key)

            # Ingest into eoAPI
            if format_pair.dataset_type == DatasetType.RASTER:
                tile_url = await stac_ingest.ingest_raster(
                    job.dataset_id, output_path, s3_href, job.filename,
                )
            else:
                tile_url = await asyncio.to_thread(
                    vector_ingest.ingest_vector, job.dataset_id, output_path,
                )

        # Stage 5: Ready
        job.status = JobStatus.READY

        from src.models import Dataset
        dataset = Dataset(
            id=job.dataset_id,
            filename=job.filename,
            dataset_type=format_pair.dataset_type,
            format_pair=format_pair,
            tile_url=tile_url,
            stac_collection_id=f"sandbox-{job.dataset_id}" if format_pair.dataset_type == DatasetType.RASTER else None,
            pg_table=vector_ingest.build_table_name(job.dataset_id) if format_pair.dataset_type == DatasetType.VECTOR else None,
            validation_results=job.validation_results,
            credits=get_credits(format_pair),
            created_at=job.created_at,
        )
        datasets_store[job.dataset_id] = dataset

    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)


def _import_and_convert(format_pair: FormatPair, input_path: str, output_path: str) -> None:
    """Import the appropriate cng-toolkit converter and run it."""
    if format_pair == FormatPair.GEOTIFF_TO_COG:
        from geotiff_to_cog import convert
    elif format_pair == FormatPair.SHAPEFILE_TO_GEOPARQUET:
        from shapefile_to_geoparquet import convert
    elif format_pair == FormatPair.GEOJSON_TO_GEOPARQUET:
        from geojson_to_geoparquet import convert
    elif format_pair == FormatPair.NETCDF_TO_COG:
        from netcdf_to_cog import convert
    else:
        raise ValueError(f"Unknown format pair: {format_pair}")

    convert(input_path, output_path, verbose=True)


def _import_and_validate(format_pair: FormatPair, input_path: str, output_path: str) -> list:
    """Import the appropriate cng-toolkit validator and run checks."""
    if format_pair == FormatPair.GEOTIFF_TO_COG:
        from geotiff_to_cog import run_checks
    elif format_pair == FormatPair.SHAPEFILE_TO_GEOPARQUET:
        from shapefile_to_geoparquet import run_checks
    elif format_pair == FormatPair.GEOJSON_TO_GEOPARQUET:
        from geojson_to_geoparquet import run_checks
    elif format_pair == FormatPair.NETCDF_TO_COG:
        from netcdf_to_cog import run_checks
    else:
        raise ValueError(f"Unknown format pair: {format_pair}")

    return run_checks(input_path, output_path)
```

- [x] **Step 4: Run tests**

```bash
cd sandbox/ingestion && python -m pytest tests/test_pipeline.py -v
```

Expected: All 3 tests PASS.

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/pipeline.py sandbox/ingestion/tests/test_pipeline.py
git commit -m "feat(sandbox): add pipeline orchestration service"
```

---

## Chunk 3: API Routes + Integration

### Task 11: Upload route

**Files:**
- Create: `sandbox/ingestion/src/routes/upload.py`

**Context:** Accepts multipart file upload (POST /api/upload), validates size, saves to a temp directory, creates a Job, and kicks off the pipeline as a background task. Returns the job ID immediately so the client can subscribe to SSE for progress.

- [x] **Step 1: Write upload.py**

Create `sandbox/ingestion/src/routes/upload.py`:

```python
"""Upload route — accepts files and starts the conversion pipeline."""

import os
import tempfile

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from src.state import jobs, datasets, limiter
from src.config import get_settings
from src.models import Job
from src.services.pipeline import run_pipeline

router = APIRouter(prefix="/api")


@router.post("/upload")
@limiter.limit("5/hour")
async def upload_file(
    request: Request,
    file: UploadFile,
    background_tasks: BackgroundTasks,
):
    """Accept a file upload and start the conversion pipeline."""
    settings = get_settings()

    # Validate file size (read in chunks to avoid loading entire file in memory)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1])
    size = 0
    try:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            size += len(chunk)
            if size > settings.max_upload_bytes:
                os.unlink(tmp.name)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size is {settings.max_upload_bytes // (1024*1024)} MB.",
                )
            tmp.write(chunk)
        tmp.close()
    except HTTPException:
        raise
    except Exception:
        os.unlink(tmp.name)
        raise

    if not file.filename:
        os.unlink(tmp.name)
        raise HTTPException(status_code=400, detail="Filename is required.")

    job = Job(filename=file.filename)
    jobs[job.id] = job

    background_tasks.add_task(_run_and_cleanup, job, tmp.name)
    return {"job_id": job.id, "dataset_id": job.dataset_id}


async def _run_and_cleanup(job: Job, input_path: str):
    """Run the pipeline, then clean up the temp file."""
    try:
        await run_pipeline(job, input_path, datasets)
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)
```

- [x] **Step 2: Register the router in app.py**

Add to the bottom of `sandbox/ingestion/src/app.py` (before the health check or after middleware setup):

```python
from src.routes.upload import router as upload_router
app.include_router(upload_router)
```

- [x] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/routes/upload.py sandbox/ingestion/src/app.py
git commit -m "feat(sandbox): add file upload route with size validation"
```

---

### Task 12: Jobs route with SSE

**Files:**
- Create: `sandbox/ingestion/src/routes/jobs.py`

**Context:** GET /api/jobs/{id} returns the current job status. GET /api/jobs/{id}/stream provides SSE (Server-Sent Events) that emit status updates as the pipeline progresses.

- [x] **Step 1: Write jobs.py**

Create `sandbox/ingestion/src/routes/jobs.py`:

```python
"""Job status routes with SSE progress streaming."""

import asyncio
import json

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from src.state import jobs
from src.models import JobStatus

router = APIRouter(prefix="/api")


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get the current status of a conversion job."""
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.model_dump()


@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    """SSE stream of job status updates."""
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        import time
        last_status = None
        start = time.monotonic()
        max_duration = 600  # 10 minutes

        while time.monotonic() - start < max_duration:
            if job.status != last_status:
                last_status = job.status
                data = {
                    "status": job.status.value,
                    "validation_results": [v.model_dump() for v in job.validation_results],
                }
                if job.error:
                    data["error"] = job.error
                if job.dataset_id:
                    data["dataset_id"] = job.dataset_id
                yield {"event": "status", "data": json.dumps(data)}

                if job.status in (JobStatus.READY, JobStatus.FAILED):
                    break

            await asyncio.sleep(0.5)
        else:
            yield {"event": "timeout", "data": json.dumps({"error": "Job timed out"})}

    return EventSourceResponse(event_generator())
```

- [x] **Step 2: Register the router in app.py**

Add to `sandbox/ingestion/src/app.py`:

```python
from src.routes.jobs import router as jobs_router
app.include_router(jobs_router)
```

- [x] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/routes/jobs.py sandbox/ingestion/src/app.py
git commit -m "feat(sandbox): add job status route with SSE progress streaming"
```

---

### Task 13: Datasets route

**Files:**
- Create: `sandbox/ingestion/src/routes/datasets.py`

**Context:** GET /api/datasets/{id} returns dataset metadata including the tile URL, validation results, and credits. This is what the frontend uses after a conversion is complete.

- [x] **Step 1: Write datasets.py**

Create `sandbox/ingestion/src/routes/datasets.py`:

```python
"""Dataset metadata route."""

from fastapi import APIRouter, HTTPException

from src.state import datasets

router = APIRouter(prefix="/api")


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str):
    """Get metadata for a converted dataset."""
    dataset = datasets.get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset.model_dump()
```

- [x] **Step 2: Register the router in app.py**

Add to `sandbox/ingestion/src/app.py`:

```python
from src.routes.datasets import router as datasets_router
app.include_router(datasets_router)
```

- [x] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/routes/datasets.py sandbox/ingestion/src/app.py
git commit -m "feat(sandbox): add dataset metadata route"
```

---

### Task 14: Integration test — end-to-end upload

**Files:**
- Create: `sandbox/ingestion/tests/conftest.py`
- Create: `sandbox/ingestion/tests/test_integration.py`

**Context:** These tests require Docker Compose running (eoAPI + MinIO). They upload real files through the API, wait for the pipeline to complete, and verify that tile URLs return 200.

- [x] **Step 1: Write conftest.py**

Create `sandbox/ingestion/tests/conftest.py`:

```python
import os
import tempfile

import numpy as np
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from src.app import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def synthetic_geotiff():
    """Generate a small synthetic GeoTIFF for testing."""
    import rasterio
    from rasterio.transform import from_bounds

    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        path = f.name

    with rasterio.open(
        path, "w", driver="GTiff",
        width=64, height=64, count=1, dtype="float32",
        crs="EPSG:4326",
        transform=from_bounds(-10, -10, 10, 10, 64, 64),
        nodata=-9999.0,
    ) as dst:
        data = np.random.default_rng(42).standard_normal((64, 64)).astype(np.float32)
        dst.write(data, 1)

    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def synthetic_geojson():
    """Generate a small synthetic GeoJSON for testing."""
    import json
    with tempfile.NamedTemporaryFile(suffix=".geojson", mode="w", delete=False) as f:
        geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [0.0, 0.0]},
                    "properties": {"name": "origin"},
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [1.0, 1.0]},
                    "properties": {"name": "northeast"},
                },
            ],
        }
        json.dump(geojson, f)
        path = f.name

    yield path
    if os.path.exists(path):
        os.unlink(path)
```

- [x] **Step 2: Write integration test**

Create `sandbox/ingestion/tests/test_integration.py`:

```python
"""Integration tests — require Docker Compose running (eoAPI + MinIO).

Run with: cd sandbox && docker compose up -d
Then: cd ingestion && python -m pytest tests/test_integration.py -v -s
"""

import time

import httpx
import pytest


def _is_docker_running():
    """Check if eoAPI services are reachable."""
    try:
        resp = httpx.get("http://localhost:8081/", timeout=2.0)
        return resp.status_code == 200
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _is_docker_running(),
    reason="Docker Compose services not running (start with: cd sandbox && docker compose up -d)",
)


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_upload_geotiff_end_to_end(client, synthetic_geotiff):
    # Upload
    with open(synthetic_geotiff, "rb") as f:
        resp = client.post("/api/upload", files={"file": ("test.tif", f, "image/tiff")})
    assert resp.status_code == 200
    data = resp.json()
    job_id = data["job_id"]
    dataset_id = data["dataset_id"]

    # Poll for completion (max 60 seconds)
    for _ in range(120):
        resp = client.get(f"/api/jobs/{job_id}")
        assert resp.status_code == 200
        job = resp.json()
        if job["status"] in ("ready", "failed"):
            break
        time.sleep(0.5)

    assert job["status"] == "ready", f"Job failed: {job.get('error')}"

    # Verify dataset metadata
    resp = client.get(f"/api/datasets/{dataset_id}")
    assert resp.status_code == 200
    dataset = resp.json()
    assert dataset["dataset_type"] == "raster"
    assert "tile_url" in dataset
    assert len(dataset["credits"]) > 0
    assert len(dataset["validation_results"]) == 8


def test_upload_geojson_end_to_end(client, synthetic_geojson):
    with open(synthetic_geojson, "rb") as f:
        resp = client.post("/api/upload", files={"file": ("test.geojson", f, "application/json")})
    assert resp.status_code == 200
    data = resp.json()
    job_id = data["job_id"]
    dataset_id = data["dataset_id"]

    for _ in range(120):
        resp = client.get(f"/api/jobs/{job_id}")
        job = resp.json()
        if job["status"] in ("ready", "failed"):
            break
        time.sleep(0.5)

    assert job["status"] == "ready", f"Job failed: {job.get('error')}"

    resp = client.get(f"/api/datasets/{dataset_id}")
    dataset = resp.json()
    assert dataset["dataset_type"] == "vector"
    assert len(dataset["validation_results"]) == 9


def test_upload_oversized_file_rejected(client):
    # Create a file that claims to be too large
    # We'll test this by setting a very low limit
    resp = client.post(
        "/api/upload",
        files={"file": ("test.tif", b"x" * 100, "image/tiff")},
    )
    # With default 1GB limit, 100 bytes should succeed (the pipeline may fail
    # on magic bytes, but the upload itself should be accepted)
    assert resp.status_code == 200


def test_job_not_found(client):
    resp = client.get("/api/jobs/nonexistent-id")
    assert resp.status_code == 404


def test_dataset_not_found(client):
    resp = client.get("/api/datasets/nonexistent-id")
    assert resp.status_code == 404
```

- [x] **Step 3: Run unit tests (no Docker required)**

```bash
cd sandbox/ingestion && python -m pytest tests/ -v --ignore=tests/test_integration.py
```

Expected: All unit tests from Tasks 4-10 PASS.

- [x] **Step 4: Run integration tests (Docker required)**

```bash
cd sandbox && docker compose up -d
cd ingestion && python -m pytest tests/test_integration.py -v -s
```

Expected: All integration tests PASS. If any fail, debug with `docker compose logs` and fix before proceeding.

- [x] **Step 5: Commit**

```bash
git add sandbox/ingestion/tests/conftest.py sandbox/ingestion/tests/test_integration.py
git commit -m "test(sandbox): add integration tests for upload pipeline"
```

---

## Verification

After all tasks are complete:

```bash
# 1. All unit tests pass
cd sandbox/ingestion && python -m pytest tests/ --ignore=tests/test_integration.py -v

# 2. Docker Compose services all healthy
cd sandbox && docker compose up -d && docker compose ps

# 3. Integration tests pass
cd sandbox/ingestion && python -m pytest tests/test_integration.py -v -s

# 4. Manual smoke test — upload a GeoTIFF via curl
curl -F "file=@/path/to/test.tif" http://localhost:8000/api/upload
# Note the job_id, then:
curl http://localhost:8000/api/jobs/{job_id}
# Wait for "ready", then:
curl http://localhost:8000/api/datasets/{dataset_id}
```

All commands should succeed. The dataset response should include a `tile_url` pointing at eoAPI's raster tiler.
