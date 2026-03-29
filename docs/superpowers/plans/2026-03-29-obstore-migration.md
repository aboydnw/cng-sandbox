# obstore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace boto3 with obstore for all S3/R2 object storage operations in the ingestion service.

**Architecture:** Drop-in swap of `StorageService` internals from boto3 to obstore. The class keeps its public interface; all callers remain unchanged. Tests switch from moto mocking to obstore's built-in `MemoryStore`.

**Tech Stack:** obstore (Rust-backed Python S3 client), pytest

**Spec:** `docs/superpowers/specs/2026-03-29-obstore-migration-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `ingestion/pyproject.toml` | Modify | Swap boto3→obstore, remove moto |
| `ingestion/src/services/storage.py` | Modify | Replace boto3 internals with obstore `S3Store` |
| `ingestion/src/services/temporal_pipeline.py` | Modify | Replace direct `storage.s3.*` calls with `StorageService` methods |
| `ingestion/src/routes/datasets.py` | Modify | Update `StorageService` constructor call |
| `ingestion/tests/test_storage.py` | Modify | Replace moto fixtures with `MemoryStore` |
| `ingestion/tests/test_pmtiles_ingest.py` | Modify | Replace moto fixtures with `MemoryStore` |
| `ingestion/tests/test_datasets.py` | Modify | Replace `FakeS3` with `MemoryStore`-backed `StorageService` |

---

### Task 1: Update dependencies

**Files:**
- Modify: `ingestion/pyproject.toml`

- [ ] **Step 1: Update pyproject.toml**

Replace `boto3` with `obstore` in dependencies and remove `moto[s3]` from dev dependencies:

```toml
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "python-multipart>=0.0.9",
    "sse-starlette>=2.0.0",
    "obstore>=0.5.0",
    "python-magic>=0.4.27",
    "httpx>=0.27.0",
    "pydantic-settings>=2.5.0",
    "geopandas>=1.0.0",
    "sqlalchemy>=2.0.0",
    "geoalchemy2>=0.15.0",
    "psycopg2-binary>=2.9.0",
    "rio-stac>=0.10.0",
    "pystac[validation]>=1.10.0",
    "geojson-pydantic>=1.1.0",
    "h5py>=3.10.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.24.0"]
```

- [ ] **Step 2: Sync the lock file**

Run: `cd ingestion && uv lock`

Expected: Lock file updates, obstore resolved, boto3 and moto removed.

- [ ] **Step 3: Commit**

```bash
git add ingestion/pyproject.toml ingestion/uv.lock
git commit -m "chore: replace boto3 with obstore in dependencies"
```

---

### Task 2: Rewrite StorageService

**Files:**
- Modify: `ingestion/src/services/storage.py`
- Test: `ingestion/tests/test_storage.py`

- [ ] **Step 1: Write failing tests for obstore-backed StorageService**

Replace the entire contents of `ingestion/tests/test_storage.py` with:

```python
import os
import tempfile

import obstore
import pytest
from obstore.store import MemoryStore

from src.services.storage import StorageService


@pytest.fixture
def storage():
    store = MemoryStore()
    return StorageService(store=store, bucket="test-bucket")


def test_upload_raw_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake tiff data")
        path = f.name
    try:
        key = storage.upload_raw(path, dataset_id="abc-123", filename="data.tif")
        assert key == "datasets/abc-123/raw/data.tif"
        result = obstore.get(storage.store, key)
        assert bytes(result.bytes()) == b"fake tiff data"
    finally:
        os.unlink(path)


def test_upload_converted_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake cog data")
        path = f.name
    try:
        key = storage.upload_converted(
            path, dataset_id="abc-123", filename="output.tif"
        )
        assert key == "datasets/abc-123/converted/output.tif"
        result = obstore.get(storage.store, key)
        assert bytes(result.bytes()) == b"fake cog data"
    finally:
        os.unlink(path)


def test_upload_pmtiles(storage):
    with tempfile.NamedTemporaryFile(suffix=".pmtiles", delete=False) as f:
        f.write(b"fake pmtiles data")
        path = f.name
    try:
        key = storage.upload_pmtiles(path, dataset_id="abc-123")
        assert key == "datasets/abc-123/converted/data.pmtiles"
        result = obstore.get(storage.store, key)
        assert bytes(result.bytes()) == b"fake pmtiles data"
    finally:
        os.unlink(path)


def test_upload_file_with_explicit_key(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"timestep data")
        path = f.name
    try:
        storage.upload_file(path, "datasets/abc-123/timesteps/0/data.tif")
        result = obstore.get(
            storage.store, "datasets/abc-123/timesteps/0/data.tif"
        )
        assert bytes(result.bytes()) == b"timestep data"
    finally:
        os.unlink(path)


def test_delete_object(storage):
    obstore.put(storage.store, "datasets/ds-001/file.tif", b"data")
    storage.delete_object("datasets/ds-001/file.tif")
    with pytest.raises(FileNotFoundError):
        obstore.get(storage.store, "datasets/ds-001/file.tif")


def test_delete_prefix(storage):
    obstore.put(storage.store, "datasets/ds-001/file1.tif", b"a")
    obstore.put(storage.store, "datasets/ds-001/file2.tif", b"b")
    obstore.put(storage.store, "datasets/ds-002/other.tif", b"c")
    storage.delete_prefix("datasets/ds-001/")
    with pytest.raises(FileNotFoundError):
        obstore.get(storage.store, "datasets/ds-001/file1.tif")
    with pytest.raises(FileNotFoundError):
        obstore.get(storage.store, "datasets/ds-001/file2.tif")
    # ds-002 untouched
    result = obstore.get(storage.store, "datasets/ds-002/other.tif")
    assert bytes(result.bytes()) == b"c"


def test_get_s3_uri(storage):
    uri = storage.get_s3_uri("datasets/abc-123/converted/output.tif")
    assert uri == "s3://test-bucket/datasets/abc-123/converted/output.tif"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ingestion && uv run pytest tests/test_storage.py -v`

Expected: FAIL — `StorageService` still expects boto3 client, not obstore store.

- [ ] **Step 3: Rewrite storage.py**

Replace the entire contents of `ingestion/src/services/storage.py` with:

```python
"""S3 storage service for raw and converted files."""

from pathlib import Path

import obstore
from obstore.store import S3Store

from src.config import get_settings


class StorageService:
    def __init__(self, store=None, bucket: str | None = None):
        settings = get_settings()
        self.bucket = bucket or settings.s3_bucket
        if store is None:
            store = S3Store(
                bucket=self.bucket,
                access_key_id=settings.aws_access_key_id or None,
                secret_access_key=settings.aws_secret_access_key or None,
                endpoint=settings.s3_endpoint or None,
                region=settings.s3_region,
                virtual_hosted_style_request="false",
            )
        self.store = store

    def _upload(self, file_path: str, key: str) -> None:
        """Read a local file and put it to object storage."""
        data = Path(file_path).read_bytes()
        obstore.put(self.store, key, data)

    def upload_raw(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a raw input file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/raw/{filename}"
        self._upload(file_path, key)
        return key

    def upload_converted(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a converted output file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/converted/{filename}"
        self._upload(file_path, key)
        return key

    def upload_pmtiles(self, local_path: str, dataset_id: str) -> str:
        """Upload a .pmtiles file to S3. Returns the storage key."""
        key = f"datasets/{dataset_id}/converted/data.pmtiles"
        self._upload(local_path, key)
        return key

    def upload_file(self, file_path: str, key: str) -> None:
        """Upload a local file to an explicit key."""
        self._upload(file_path, key)

    def get_s3_uri(self, key: str) -> str:
        """Return the s3:// URI for a key."""
        return f"s3://{self.bucket}/{key}"

    def delete_object(self, key: str) -> None:
        """Delete a single object from storage."""
        obstore.delete(self.store, key)

    def delete_prefix(self, prefix: str) -> None:
        """Delete all objects under a given prefix."""
        keys = []
        for chunk in obstore.list(self.store, prefix=prefix):
            for item in chunk:
                keys.append(item["path"])
        if keys:
            obstore.delete(self.store, keys)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ingestion && uv run pytest tests/test_storage.py -v`

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/services/storage.py ingestion/tests/test_storage.py
git commit -m "feat: rewrite StorageService to use obstore instead of boto3"
```

---

### Task 3: Fix temporal_pipeline.py direct storage access

**Files:**
- Modify: `ingestion/src/services/temporal_pipeline.py:155-165` (timestep upload loop)
- Modify: `ingestion/src/services/temporal_pipeline.py:222-226` (`_cleanup_uploaded`)

- [ ] **Step 1: Replace direct `storage.s3.upload_file` with `storage.upload_file`**

In `ingestion/src/services/temporal_pipeline.py`, replace line 162:

```python
                storage.s3.upload_file(cog_path, storage.bucket, key)
```

with:

```python
                storage.upload_file(cog_path, key)
```

- [ ] **Step 2: Replace direct `storage.s3.delete_object` in `_cleanup_uploaded`**

In the same file, replace lines 222-226:

```python
def _cleanup_uploaded(storage: StorageService, keys: list[str]) -> None:
    """Best-effort removal of already-uploaded S3 objects."""
    for key in keys:
        with contextlib.suppress(Exception):
            storage.s3.delete_object(Bucket=storage.bucket, Key=key)
```

with:

```python
def _cleanup_uploaded(storage: StorageService, keys: list[str]) -> None:
    """Best-effort removal of already-uploaded S3 objects."""
    for key in keys:
        with contextlib.suppress(Exception):
            storage.delete_object(key)
```

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/services/temporal_pipeline.py
git commit -m "refactor: use StorageService methods instead of direct s3 access"
```

---

### Task 4: Fix datasets.py StorageService construction

**Files:**
- Modify: `ingestion/src/routes/datasets.py:87-88`

- [ ] **Step 1: Update constructor call**

In `ingestion/src/routes/datasets.py`, replace lines 87-88:

```python
        s3 = getattr(request.app.state, "s3", None)
        storage = StorageService(s3_client=s3) if s3 else None
```

with:

```python
        storage = StorageService()
```

Note: `app.state.s3` is never set anywhere in the codebase, so this was always falling through to `StorageService()` with default config. We're removing the dead conditional.

- [ ] **Step 2: Commit**

```bash
git add ingestion/src/routes/datasets.py
git commit -m "refactor: simplify StorageService construction in datasets route"
```

---

### Task 5: Update test_pmtiles_ingest.py

**Files:**
- Modify: `ingestion/tests/test_pmtiles_ingest.py`

- [ ] **Step 1: Rewrite the mock_storage fixture and upload verification**

In `ingestion/tests/test_pmtiles_ingest.py`, replace the imports (lines 1-10):

```python
import subprocess

import boto3
import geopandas as gpd
import pytest
from moto import mock_aws
from shapely.geometry import Polygon

from src.services.pmtiles_ingest import get_pmtiles_tile_url, ingest_pmtiles
from src.services.storage import StorageService
```

with:

```python
import subprocess

import geopandas as gpd
import obstore
import pytest
from obstore.store import MemoryStore
from shapely.geometry import Polygon

from src.services.pmtiles_ingest import get_pmtiles_tile_url, ingest_pmtiles
from src.services.storage import StorageService
```

Then replace the `mock_storage` fixture (lines 29-34):

```python
@pytest.fixture
def mock_storage():
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="test-bucket")
        yield StorageService(s3_client=s3, bucket="test-bucket")
```

with:

```python
@pytest.fixture
def mock_storage():
    store = MemoryStore()
    return StorageService(store=store, bucket="test-bucket")
```

Then replace the upload verification in `test_ingest_pmtiles_uploads_to_storage` (lines 110-115):

```python
    # Verify the file was uploaded to S3
    obj = mock_storage.s3.get_object(
        Bucket="test-bucket",
        Key="datasets/abc-123/converted/data.pmtiles",
    )
    assert len(obj["Body"].read()) == 102  # valid PMTiles header size
```

with:

```python
    # Verify the file was uploaded to storage
    result = obstore.get(
        mock_storage.store, "datasets/abc-123/converted/data.pmtiles"
    )
    assert len(bytes(result.bytes())) == 102  # valid PMTiles header size
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd ingestion && uv run pytest tests/test_pmtiles_ingest.py -v`

Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add ingestion/tests/test_pmtiles_ingest.py
git commit -m "test: migrate test_pmtiles_ingest from moto to obstore MemoryStore"
```

---

### Task 6: Update test_datasets.py

**Files:**
- Modify: `ingestion/tests/test_datasets.py:152-183`

- [ ] **Step 1: Rewrite the FakeS3-based tests**

In `ingestion/tests/test_datasets.py`, replace `test_storage_delete_object` and `test_storage_delete_prefix` (lines 152-183):

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

with:

```python
def test_storage_delete_object():
    import obstore
    from obstore.store import MemoryStore

    from src.services.storage import StorageService

    store = MemoryStore()
    storage = StorageService(store=store, bucket="test-bucket")
    obstore.put(store, "datasets/ds-001/converted/data.tif", b"data")
    storage.delete_object("datasets/ds-001/converted/data.tif")
    with pytest.raises(FileNotFoundError):
        obstore.get(store, "datasets/ds-001/converted/data.tif")


def test_storage_delete_prefix():
    import obstore
    from obstore.store import MemoryStore

    from src.services.storage import StorageService

    store = MemoryStore()
    storage = StorageService(store=store, bucket="test-bucket")
    obstore.put(store, "datasets/ds-001/file1", b"a")
    obstore.put(store, "datasets/ds-001/file2", b"b")
    storage.delete_prefix("datasets/ds-001/")
    with pytest.raises(FileNotFoundError):
        obstore.get(store, "datasets/ds-001/file1")
    with pytest.raises(FileNotFoundError):
        obstore.get(store, "datasets/ds-001/file2")
```

Also add `import pytest` to the top of the file if not already present (it is not currently imported in this file).

- [ ] **Step 2: Run the full test suite**

Run: `cd ingestion && uv run pytest -v`

Expected: All tests PASS. No remaining imports of `boto3` or `moto`.

- [ ] **Step 3: Verify no boto3/moto references remain**

Run: `grep -r "boto3\|from moto\|import moto" ingestion/src/ ingestion/tests/`

Expected: No output (zero matches).

- [ ] **Step 4: Commit**

```bash
git add ingestion/tests/test_datasets.py
git commit -m "test: migrate test_datasets from FakeS3 to obstore MemoryStore"
```

---

### Task 7: Docker integration verification

- [ ] **Step 1: Rebuild the ingestion container**

Run: `docker compose -f docker-compose.yml build ingestion`

Expected: Build succeeds, obstore installs without errors.

- [ ] **Step 2: Start the full stack**

Run: `docker compose -f docker-compose.yml up -d`

Expected: All containers healthy.

- [ ] **Step 3: Upload a test file and verify tiles serve**

Upload a GeoTIFF through the frontend at `http://localhost:5185` and verify:
- The upload completes successfully (SSE stream reaches "ready")
- Tiles render on the map

- [ ] **Step 4: Final commit (if any fixups needed)**

If any fixes were needed during integration testing, commit them with an appropriate message.
