# Datasets Management Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a datasets management page with browse and delete capabilities, backed by persistent PostgreSQL storage instead of the current in-memory dict.

**Architecture:** Extract the SQLAlchemy `Base` to a shared module so both `StoryRow` and the new `DatasetRow` use it. Replace the in-memory `datasets_store` dict with database reads/writes. Add a `DELETE /api/datasets/{id}` endpoint with cascading cleanup (STAC, MinIO, Postgres). Build a frontend `/datasets` page with a table and delete confirmation dialog.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React/Chakra UI/React Router (frontend), pytest with in-memory SQLite (tests)

**Spec:** `docs/superpowers/specs/2026-03-21-datasets-management-design.md`

---

## File Structure

### Backend (ingestion/)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/models/base.py` | Create | Shared SQLAlchemy `Base` class |
| `src/models/story.py` | Modify | Import `Base` from `base.py` instead of defining it |
| `src/models/dataset.py` | Create | `DatasetRow` ORM model + `DatasetResponse` Pydantic schema |
| `src/routes/datasets.py` | Modify | Replace in-memory reads with DB queries; add DELETE endpoint with `story_count`; add sort order |
| `src/services/dataset_delete.py` | Create | Cascading delete logic (STAC, MinIO, Postgres table, DB row) |
| `src/services/storage.py` | Modify | Add `delete_object` and `delete_prefix` methods |
| `src/services/pipeline.py` | Modify | Write `DatasetRow` to DB instead of `datasets_store` dict |
| `src/services/temporal_pipeline.py` | Modify | Same change as `pipeline.py` — write DB row instead of dict |
| `src/routes/upload.py` | Modify | Pass `db_session_factory` to both pipelines instead of `datasets` dict |
| `src/state.py` | Modify | Remove `datasets` dict |
| `src/app.py` | Modify | Import `Base` from new location |
| `tests/test_datasets.py` | Create | Tests for dataset CRUD + delete |
| `tests/test_stories.py` | Modify | Update `Base` import |
| `tests/conftest.py` | Modify | Consolidate shared test fixtures (db_engine, app, client) using `create_app` factory |

### Frontend (frontend/src/)

| File | Action | Responsibility |
|------|--------|----------------|
| `pages/DatasetsPage.tsx` | Create | Dataset list table with delete |
| `components/Header.tsx` | Modify | Add "Datasets" nav link |
| `App.tsx` | Modify | Add `/datasets` route |

---

## Task 1: Extract shared SQLAlchemy Base

**Files:**
- Create: `ingestion/src/models/base.py`
- Modify: `ingestion/src/models/story.py`
- Modify: `ingestion/src/app.py`
- Modify: `ingestion/tests/test_stories.py`
- Modify: `ingestion/tests/conftest.py`

- [ ] **Step 1: Create `base.py`**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Update `story.py` to import from `base.py`**

Replace `from sqlalchemy.orm import DeclarativeBase` and the `Base` class definition with:

```python
from src.models.base import Base
```

Remove `DeclarativeBase` import. Keep everything else unchanged.

- [ ] **Step 3: Update `app.py` import**

Change:
```python
from src.models.story import Base
```
to:
```python
from src.models.base import Base
```

- [ ] **Step 4: Update `tests/test_stories.py` import**

Change:
```python
from src.models.story import Base
```
to:
```python
from src.models.base import Base
```

- [ ] **Step 5: Consolidate shared test fixtures into `conftest.py`**

The existing `conftest.py` uses `from src.app import app` (the module-level singleton). Move to the `create_app` factory pattern so all test files share the same fixtures. Replace `conftest.py` contents with:

```python
import os
import json
import tempfile
from contextlib import asynccontextmanager

import numpy as np
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from src.app import create_app
from src.config import Settings
from src.models.base import Base


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def app(db_engine):
    settings = Settings(
        s3_endpoint="http://fake:9000",
        postgres_dsn="sqlite:///:memory:",
    )
    application = create_app(settings, lifespan=_noop_lifespan)
    application.state.db_session_factory = sessionmaker(bind=db_engine)
    return application


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def synthetic_geotiff():
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

Then remove the duplicate `db_engine`, `app`, `client` fixtures from `test_stories.py` (keep only the test functions).

- [ ] **Step 6: Run existing tests to verify no breakage**

Run: `cd ingestion && uv run pytest tests/test_stories.py -v`
Expected: All existing story tests pass.

- [ ] **Step 7: Commit**

```
feat: extract shared SQLAlchemy Base to models/base.py
```

---

## Task 2: Create DatasetRow model

**Files:**
- Create: `ingestion/src/models/dataset.py`
- Create: `ingestion/tests/test_datasets.py`

- [ ] **Step 1: Write the failing test — table creation**

In `tests/test_datasets.py` (uses shared fixtures from `conftest.py`):

```python
from sqlalchemy import inspect


def test_datasets_table_created(db_engine):
    inspector = inspect(db_engine)
    assert "datasets" in inspector.get_table_names()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ingestion && uv run pytest tests/test_datasets.py::test_datasets_table_created -v`
Expected: FAIL — `"datasets"` not in table names.

- [ ] **Step 3: Create `models/dataset.py`**

```python
"""Dataset persistence model."""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text

from src.models.base import Base


class DatasetRow(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    dataset_type = Column(String, nullable=False)
    format_pair = Column(String, nullable=False)
    tile_url = Column(String, nullable=False)
    bounds_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        """Convert to the Dataset API response format."""
        meta = json.loads(self.metadata_json) if self.metadata_json else {}
        bounds = json.loads(self.bounds_json) if self.bounds_json else None
        return {
            "id": self.id,
            "filename": self.filename,
            "dataset_type": self.dataset_type,
            "format_pair": self.format_pair,
            "tile_url": self.tile_url,
            "bounds": bounds,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            **meta,
        }
```

Note: Using `Text` columns with JSON strings for `bounds_json` and `metadata_json` instead of `JSONB` because the test suite uses SQLite (which doesn't support JSONB). This works fine for the scale of this application.

- [ ] **Step 4: Import DatasetRow in app.py so create_all discovers it**

In `app.py`, add after the existing Base import:

```python
from src.models.dataset import DatasetRow  # noqa: F401 — ensures table creation
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ingestion && uv run pytest tests/test_datasets.py::test_datasets_table_created -v`
Expected: PASS

- [ ] **Step 6: Commit**

```
feat: add DatasetRow SQLAlchemy model for persistent dataset storage
```

---

## Task 3: Wire pipelines to write DatasetRow instead of in-memory dict

**Files:**
- Modify: `ingestion/src/services/pipeline.py`
- Modify: `ingestion/src/services/temporal_pipeline.py`
- Modify: `ingestion/src/routes/upload.py`
- Modify: `ingestion/src/state.py`

- [ ] **Step 1: Update `run_pipeline` signature**

In `pipeline.py`, change the signature of `run_pipeline` from:

```python
async def run_pipeline(job: Job, input_path: str, datasets_store: dict) -> None:
```

to:

```python
async def run_pipeline(job: Job, input_path: str, db_session_factory) -> None:
```

- [ ] **Step 2: Replace dict write with DB write**

At the end of `run_pipeline` (around line 323-353), replace:

```python
datasets_store[job.dataset_id] = dataset
```

with:

```python
from src.models.dataset import DatasetRow
session = db_session_factory()
try:
    row = DatasetRow(
        id=dataset.id,
        filename=dataset.filename,
        dataset_type=dataset.dataset_type.value,
        format_pair=dataset.format_pair.value,
        tile_url=dataset.tile_url,
        bounds_json=json.dumps(dataset.bounds) if dataset.bounds else None,
        metadata_json=json.dumps({
            k: v for k, v in dataset.model_dump().items()
            if k not in ("id", "filename", "dataset_type", "format_pair", "tile_url", "bounds", "created_at")
        }, default=str),
        created_at=dataset.created_at,
    )
    session.add(row)
    session.commit()
finally:
    session.close()
```

Add `import json` at the top of `pipeline.py` if not already present.

Keep the `dataset` local variable construction unchanged — only the final storage line changes.

- [ ] **Step 3: Apply the same change to `temporal_pipeline.py`**

In `temporal_pipeline.py`, change the signature of `run_temporal_pipeline` from:

```python
async def run_temporal_pipeline(job: Job, input_paths: list[str], filenames: list[str], datasets_store: dict) -> None:
```

to:

```python
async def run_temporal_pipeline(job: Job, input_paths: list[str], filenames: list[str], db_session_factory) -> None:
```

Apply the same DB write pattern at the end (around line 180) where `datasets_store[job.dataset_id] = dataset` is replaced with the `DatasetRow` write, identical to the `pipeline.py` change.

- [ ] **Step 4: Update `upload.py` to pass session factory**

In `routes/upload.py`, update both `_run_and_cleanup` and `_run_temporal_and_cleanup`:

For `_run_and_cleanup`, replace:
```python
await run_pipeline(job, input_path, datasets)
```
with:
```python
await run_pipeline(job, input_path, db_session_factory)
```

For `_run_temporal_and_cleanup`, replace:
```python
await run_temporal_pipeline(job, input_paths, filenames, datasets)
```
with:
```python
await run_temporal_pipeline(job, input_paths, filenames, db_session_factory)
```

Both functions need `db_session_factory` as a parameter, passed from the route handler via `request.app.state.db_session_factory`.

Also remove the `datasets` import from `src.state` in `upload.py` (keep `jobs`, `scan_store`, `scan_store_lock`).

- [ ] **Step 5: Remove `datasets` from `state.py`**

In `state.py`, remove the line:

```python
datasets: dict = {}
```

- [ ] **Step 6: Run existing tests**

Run: `cd ingestion && uv run pytest -v`
Expected: All tests pass. Some tests that directly use the in-memory `datasets` store may need updating — fix any that break.

- [ ] **Step 7: Commit**

```
feat: persist datasets to PostgreSQL via pipeline
```

---

## Task 4: Rewrite dataset list/get endpoints to read from DB

**Files:**
- Modify: `ingestion/src/routes/datasets.py`
- Modify: `ingestion/tests/test_datasets.py`

- [ ] **Step 1: Write failing test — list datasets returns empty**

Add to `tests/test_datasets.py`:

```python
def test_list_datasets_empty(client):
    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    assert resp.json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ingestion && uv run pytest tests/test_datasets.py::test_list_datasets_empty -v`
Expected: May fail due to old import of `datasets` from state.

- [ ] **Step 3: Rewrite `routes/datasets.py`**

```python
"""Dataset metadata routes."""

import json

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session

from src.models.dataset import DatasetRow
from src.models.story import StoryRow

router = APIRouter(prefix="/api")


def _get_session(request: Request) -> Session:
    return request.app.state.db_session_factory()


def _story_count_for_dataset(session: Session, dataset_id: str) -> int:
    """Count stories that reference a dataset (in dataset_id or chapters_json)."""
    count = 0
    rows = session.query(StoryRow).all()
    for row in rows:
        if row.dataset_id == dataset_id:
            count += 1
            continue
        chapters = json.loads(row.chapters_json) if row.chapters_json else []
        for ch in chapters:
            lc = ch.get("layer_config") or {}
            if lc.get("dataset_id") == dataset_id:
                count += 1
                break
    return count


@router.get("/datasets")
async def list_datasets(request: Request):
    session = _get_session(request)
    try:
        rows = session.query(DatasetRow).order_by(DatasetRow.created_at.desc()).all()
        result = []
        for row in rows:
            d = row.to_dict()
            d["story_count"] = _story_count_for_dataset(session, row.id)
            result.append(d)
        return result
    finally:
        session.close()


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, request: Request):
    session = _get_session(request)
    try:
        row = session.get(DatasetRow, dataset_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        d = row.to_dict()
        d["story_count"] = _story_count_for_dataset(session, row.id)
        return d
    finally:
        session.close()
```

- [ ] **Step 4: Run tests**

Run: `cd ingestion && uv run pytest tests/test_datasets.py -v`
Expected: PASS

- [ ] **Step 5: Write test — list with seeded data**

Add to `tests/test_datasets.py`:

```python
def test_list_datasets_with_data(client, db_engine):
    from src.models.dataset import DatasetRow
    from sqlalchemy.orm import sessionmaker
    from datetime import datetime, timezone

    session = sessionmaker(bind=db_engine)()
    row = DatasetRow(
        id="ds-001",
        filename="test.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/raster/collections/sandbox-ds-001/tiles/{z}/{x}/{y}",
        metadata_json="{}",
        created_at=datetime.now(timezone.utc),
    )
    session.add(row)
    session.commit()
    session.close()

    resp = client.get("/api/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == "ds-001"
    assert data[0]["filename"] == "test.tif"
    assert data[0]["story_count"] == 0


def test_get_dataset_not_found(client):
    resp = client.get("/api/datasets/nonexistent")
    assert resp.status_code == 404
```

- [ ] **Step 6: Run tests and verify**

Run: `cd ingestion && uv run pytest tests/test_datasets.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```
feat: rewrite dataset endpoints to read from PostgreSQL
```

---

## Task 5: Add StorageService delete methods

**Files:**
- Modify: `ingestion/src/services/storage.py`
- Modify: `ingestion/tests/test_datasets.py`

- [ ] **Step 1: Write failing test**

Add to `tests/test_datasets.py`:

```python
def test_storage_delete_object(monkeypatch):
    from src.services.storage import StorageService

    deleted_keys = []

    class FakeS3:
        def delete_object(self, Bucket, Key):
            deleted_keys.append(Key)

        def list_objects_v2(self, Bucket, Prefix):
            return {"Contents": [{"Key": f"{Prefix}file1"}, {"Key": f"{Prefix}file2"}]}

    storage = StorageService(s3_client=FakeS3(), bucket="test-bucket")
    storage.delete_object("datasets/ds-001/converted/data.tif")
    assert deleted_keys == ["datasets/ds-001/converted/data.tif"]


def test_storage_delete_prefix(monkeypatch):
    from src.services.storage import StorageService

    deleted_keys = []

    class FakeS3:
        def list_objects_v2(self, Bucket, Prefix):
            return {"Contents": [{"Key": f"{Prefix}file1"}, {"Key": f"{Prefix}file2"}]}

        def delete_object(self, Bucket, Key):
            deleted_keys.append(Key)

    storage = StorageService(s3_client=FakeS3(), bucket="test-bucket")
    storage.delete_prefix("datasets/ds-001/")
    assert len(deleted_keys) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ingestion && uv run pytest tests/test_datasets.py::test_storage_delete_object tests/test_datasets.py::test_storage_delete_prefix -v`
Expected: FAIL — `delete_object`/`delete_prefix` not defined.

- [ ] **Step 3: Add methods to `StorageService`**

Add to `storage.py`:

```python
def delete_object(self, key: str) -> None:
    """Delete a single object from S3."""
    self.s3.delete_object(Bucket=self.bucket, Key=key)

def delete_prefix(self, prefix: str) -> None:
    """Delete all objects under a given S3 prefix."""
    continuation_token = None
    while True:
        kwargs = {"Bucket": self.bucket, "Prefix": prefix}
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        resp = self.s3.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []):
            self.s3.delete_object(Bucket=self.bucket, Key=obj["Key"])
        if not resp.get("IsTruncated"):
            break
        continuation_token = resp.get("NextContinuationToken")
```

- [ ] **Step 4: Run tests**

Run: `cd ingestion && uv run pytest tests/test_datasets.py::test_storage_delete_object tests/test_datasets.py::test_storage_delete_prefix -v`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat: add delete_object and delete_prefix to StorageService
```

---

## Task 6: Create dataset delete service

**Files:**
- Create: `ingestion/src/services/dataset_delete.py`
- Modify: `ingestion/tests/test_datasets.py`

- [ ] **Step 1: Write failing test**

Add to `tests/test_datasets.py`:

```python
def test_delete_dataset_endpoint(client, db_engine):
    from src.models.dataset import DatasetRow
    from sqlalchemy.orm import sessionmaker
    from datetime import datetime, timezone

    session = sessionmaker(bind=db_engine)()
    row = DatasetRow(
        id="ds-del",
        filename="delete-me.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/raster/collections/sandbox-ds-del/tiles/{z}/{x}/{y}",
        metadata_json='{"stac_collection_id": "sandbox-ds-del"}',
        created_at=datetime.now(timezone.utc),
    )
    session.add(row)
    session.commit()
    session.close()

    resp = client.delete("/api/datasets/ds-del")
    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] is True

    resp = client.get("/api/datasets/ds-del")
    assert resp.status_code == 404


def test_delete_dataset_not_found(client):
    resp = client.delete("/api/datasets/nonexistent")
    assert resp.status_code == 404


def test_delete_dataset_reports_affected_stories(client, db_engine):
    from src.models.dataset import DatasetRow
    from src.models.story import StoryRow
    from sqlalchemy.orm import sessionmaker
    from datetime import datetime, timezone
    import json

    session = sessionmaker(bind=db_engine)()
    session.add(DatasetRow(
        id="ds-ref",
        filename="referenced.tif",
        dataset_type="raster",
        format_pair="geotiff-to-cog",
        tile_url="/raster/tiles/{z}/{x}/{y}",
        metadata_json="{}",
        created_at=datetime.now(timezone.utc),
    ))
    session.add(StoryRow(
        id="story-1",
        title="Test Story",
        dataset_id="ds-ref",
        chapters_json=json.dumps([{
            "id": "ch-1", "order": 0, "title": "Ch1", "narrative": "text",
            "map_state": {"center": [0, 0], "zoom": 2, "bearing": 0, "pitch": 0, "basemap": "streets"},
            "transition": "fly-to",
            "layer_config": {"dataset_id": "ds-ref", "colormap": "viridis", "opacity": 1},
        }]),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ))
    session.commit()
    session.close()

    resp = client.delete("/api/datasets/ds-ref")
    assert resp.status_code == 200
    data = resp.json()
    assert "story-1" in data["affected_stories"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ingestion && uv run pytest tests/test_datasets.py::test_delete_dataset_endpoint -v`
Expected: FAIL — no DELETE endpoint.

- [ ] **Step 3: Create `dataset_delete.py`**

```python
"""Cascading delete logic for datasets."""

import json
import logging

import httpx
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services.storage import StorageService
from src.services import vector_ingest

logger = logging.getLogger(__name__)


def find_affected_stories(session: Session, dataset_id: str) -> list[str]:
    """Return IDs of stories that reference this dataset."""
    affected = []
    for row in session.query(StoryRow).all():
        if row.dataset_id == dataset_id:
            affected.append(row.id)
            continue
        chapters = json.loads(row.chapters_json) if row.chapters_json else []
        for ch in chapters:
            lc = ch.get("layer_config") or {}
            if lc.get("dataset_id") == dataset_id:
                affected.append(row.id)
                break
    return affected


async def delete_stac_collection(collection_id: str) -> None:
    """Delete STAC items then collection. Best-effort — logs errors."""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(base_url=settings.stac_api_url, timeout=30.0) as client:
            items_resp = await client.get(f"/collections/{collection_id}/items")
            if items_resp.status_code == 200:
                for feature in items_resp.json().get("features", []):
                    item_id = feature["id"]
                    await client.delete(f"/collections/{collection_id}/items/{item_id}")
            await client.delete(f"/collections/{collection_id}")
    except Exception:
        logger.exception("Failed to delete STAC collection %s", collection_id)


def delete_vector_table(dataset_id: str) -> None:
    """Drop the vector table from PostgreSQL. Best-effort."""
    try:
        from sqlalchemy import create_engine, text
        settings = get_settings()
        table_name = vector_ingest.build_table_name(dataset_id)
        engine = create_engine(settings.postgres_dsn)
        with engine.connect() as conn:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}"'))
            conn.commit()
        engine.dispose()
    except Exception:
        logger.exception("Failed to drop vector table for %s", dataset_id)


async def delete_dataset(session: Session, dataset_id: str, storage: StorageService | None = None) -> dict:
    """Delete a dataset and all its artifacts. Returns response dict."""
    row = session.get(DatasetRow, dataset_id)
    if row is None:
        return None

    meta = json.loads(row.metadata_json) if row.metadata_json else {}
    affected = find_affected_stories(session, dataset_id)

    # Clean up STAC (raster)
    stac_collection_id = meta.get("stac_collection_id")
    if stac_collection_id:
        await delete_stac_collection(stac_collection_id)

    # Clean up vector table
    pg_table = meta.get("pg_table")
    if pg_table:
        delete_vector_table(dataset_id)

    # Clean up S3 objects (all files under datasets/{id}/)
    if storage is None:
        storage = StorageService()
    try:
        storage.delete_prefix(f"datasets/{dataset_id}/")
    except Exception:
        logger.exception("Failed to delete S3 objects for %s", dataset_id)

    # Delete the DB row
    session.delete(row)
    session.commit()

    return {"deleted": True, "affected_stories": affected}
```

- [ ] **Step 4: Add DELETE endpoint to `routes/datasets.py`**

Add to `datasets.py`:

```python
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService


@router.delete("/datasets/{dataset_id}")
async def delete_dataset_endpoint(dataset_id: str, request: Request):
    session = _get_session(request)
    try:
        # Build StorageService from app's S3 client when available (production).
        # In tests, pass storage=None — cleanup will be skipped gracefully.
        s3 = getattr(request.app.state, "s3", None)
        storage = StorageService(s3_client=s3) if s3 else None
        result = await delete_dataset(session, dataset_id, storage=storage)
        if result is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        return result
    finally:
        session.close()
```

- [ ] **Step 5: Run tests**

Run: `cd ingestion && uv run pytest tests/test_datasets.py -v`
Expected: All PASS. The STAC and S3 cleanup calls will fail silently in tests (no real services), but the DB operations will succeed.

- [ ] **Step 6: Run full test suite**

Run: `cd ingestion && uv run pytest -v`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```
feat: add DELETE /api/datasets/{id} with cascading cleanup
```

---

## Task 7: Frontend — Datasets page

**Files:**
- Create: `frontend/src/pages/DatasetsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Create `DatasetsPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { Header } from "../components/Header";
import { config } from "../config";
import type { Dataset } from "../types";

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DatasetWithStoryCount extends Dataset {
  story_count?: number;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetWithStoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${config.apiBase}/api/datasets`)
      .then((r) => r.json())
      .then((data) => {
        setDatasets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(
    async (ds: DatasetWithStoryCount) => {
      const storyWarning =
        ds.story_count && ds.story_count > 0
          ? `\n\nThis dataset is used in ${ds.story_count} story${ds.story_count > 1 ? "s" : ""}. Those chapters will no longer display.`
          : "";

      if (!window.confirm(`Delete "${ds.filename}"?${storyWarning}`)) return;

      setDeleting(ds.id);
      try {
        const resp = await fetch(
          `${config.apiBase}/api/datasets/${ds.id}`,
          { method: "DELETE" },
        );
        if (resp.ok) {
          setDatasets((prev) => prev.filter((d) => d.id !== ds.id));
        }
      } finally {
        setDeleting(null);
      }
    },
    [],
  );

  return (
    <Box minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4}>
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="gray.800">
            Datasets
          </Heading>
          <Link to="/">
            <Button size="sm" colorScheme="orange">
              Upload new
            </Button>
          </Link>
        </Flex>

        {loading ? (
          <Flex justify="center" py={12}>
            <Spinner size="lg" />
          </Flex>
        ) : datasets.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            py={12}
            gap={3}
            color="gray.500"
          >
            <Text>No datasets uploaded yet.</Text>
            <Link to="/">
              <Text color="brand.orange" fontWeight={600}>
                Upload your first file
              </Text>
            </Link>
          </Flex>
        ) : (
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Filename</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>Uploaded</Table.ColumnHeader>
                <Table.ColumnHeader>Size</Table.ColumnHeader>
                <Table.ColumnHeader w="80px" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {datasets.map((ds) => (
                <Table.Row key={ds.id}>
                  <Table.Cell>
                    <Link to={`/map/${ds.id}`}>
                      <Text
                        color="blue.600"
                        _hover={{ textDecoration: "underline" }}
                        fontWeight={500}
                      >
                        {ds.filename}
                      </Text>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Text
                      fontSize="xs"
                      fontWeight={600}
                      textTransform="uppercase"
                      color={
                        ds.dataset_type === "raster"
                          ? "purple.600"
                          : "teal.600"
                      }
                    >
                      {ds.dataset_type}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" color="gray.600">
                      {ds.created_at ? timeAgo(ds.created_at as unknown as string) : "\u2014"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" color="gray.600">
                      {formatBytes(ds.original_file_size)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      loading={deleting === ds.id}
                      onClick={() => handleDelete(ds)}
                    >
                      Delete
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Add route to `App.tsx`**

Add import:
```tsx
import DatasetsPage from "./pages/DatasetsPage";
```

Add route (before the catch-all or at the end of the route list):
```tsx
<Route path="/datasets" element={<DatasetsPage />} />
```

- [ ] **Step 3: Add nav link to `Header.tsx`**

Add a "Datasets" link to the Header component, after the logo/title section. Use React Router's `Link` component:

```tsx
<Link to="/datasets">
  <Text fontSize="sm" fontWeight={500} color="gray.600" _hover={{ color: "gray.800" }}>
    Datasets
  </Text>
</Link>
```

Import `Link` from `react-router-dom` at the top of the file.

- [ ] **Step 4: Start dev server and verify visually**

Run: `docker compose -f docker-compose.yml up -d --build frontend`

Navigate to `http://localhost:5185/datasets`. Take a screenshot to verify:
- Empty state shows correctly if no datasets
- Nav link appears in header
- If datasets exist, they render in the table

- [ ] **Step 5: Commit**

```
feat: add datasets management page with browse and delete
```

---

## Task 8: Integration verification

- [ ] **Step 1: Rebuild the full stack**

Run: `docker compose -f docker-compose.yml up -d --build`

- [ ] **Step 2: Upload a test file**

Navigate to `http://localhost:5185`, upload a GeoTIFF or GeoJSON file.

- [ ] **Step 3: Verify dataset appears on /datasets page**

Navigate to `http://localhost:5185/datasets`. Verify the uploaded file appears in the table with correct filename, type, date, and size.

- [ ] **Step 4: Verify delete works**

Click Delete, confirm the dialog, verify the row disappears and the dataset is no longer accessible at `/map/{id}`.

- [ ] **Step 5: Verify container restart persistence**

Restart the ingestion container:
```bash
docker compose -f docker-compose.yml restart ingestion
```
Navigate to `/datasets` — the dataset should still be listed (proving persistence works).

- [ ] **Step 6: Run full test suite**

Run: `cd ingestion && uv run pytest -v`
Expected: All tests pass.

- [ ] **Step 7: Final commit if any fixes needed**

```
fix: address integration issues from datasets management testing
```
