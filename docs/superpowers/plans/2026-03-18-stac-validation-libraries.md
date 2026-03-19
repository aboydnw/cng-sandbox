# STAC Validation Libraries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-rolled STAC dict construction with rio-stac, pystac, and geojson-pydantic for spec-compliant output and validation.

**Architecture:** Rewrite `stac_ingest.py` to use rio-stac for STAC item generation from COG files, pystac for typed Collection/Item objects with validation, and geojson-pydantic for geometry validation. Add GeoJSON structure validation to the vector upload path in `pipeline.py`. Update the `temporal_pipeline.py` call site to match the new signature.

**Tech Stack:** rio-stac, pystac, geojson-pydantic, rasterio (test fixtures)

**Spec:** `docs/superpowers/specs/2026-03-18-stac-validation-libraries-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `ingestion/pyproject.toml` | Modify | Add 3 new dependencies |
| `ingestion/src/services/stac_ingest.py` | Rewrite | STAC item/collection construction via rio-stac + pystac |
| `ingestion/src/services/temporal_pipeline.py` | Modify (line 138-145) | Drop `bbox` arg from `ingest_temporal_raster()` call |
| `ingestion/src/services/pipeline.py` | Modify (after line 181) | Add GeoJSON validation for vector uploads |
| `ingestion/tests/test_stac_ingest.py` | Rewrite | Tests for rio-stac/pystac STAC construction |
| `ingestion/tests/test_pipeline.py` | Modify | Add GeoJSON validation tests |

---

## Task 1: Add dependencies

**Files:**
- Modify: `ingestion/pyproject.toml:13-26`

- [ ] **Step 1: Add rio-stac, pystac, geojson-pydantic to dependencies**

In `ingestion/pyproject.toml`, add three lines to the `dependencies` list (after the existing `psycopg2-binary` entry, before the closing bracket):

```toml
    "rio-stac>=0.10.0",
    "pystac>=1.10.0",
    "geojson-pydantic>=1.1.0",
```

- [ ] **Step 2: Verify dependencies resolve**

Run from `ingestion/`:
```bash
cd /home/anthony/projects/cng-sandbox/ingestion && pip install -e ".[dev]"
```
Expected: installs without errors. Verify with:
```bash
python -c "import rio_stac; import pystac; import geojson_pydantic; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add ingestion/pyproject.toml
git commit -m "feat: add rio-stac, pystac, geojson-pydantic dependencies"
```

---

## Task 2: Rewrite stac_ingest.py — single raster path

**Files:**
- Rewrite: `ingestion/src/services/stac_ingest.py`
- Test: `ingestion/tests/test_stac_ingest.py`

- [ ] **Step 1: Write failing test for single raster STAC construction**

Note: Tests call `.validate()` to verify STAC spec compliance. This fetches schemas from `schemas.stacspec.org` and requires network access. The production code does NOT call `.validate()` — the Transaction API is the final validator. If tests run in an offline environment, remove the `.validate()` calls; the structural assertions are sufficient.

Replace the entire contents of `ingestion/tests/test_stac_ingest.py` with:

```python
import os
import tempfile

import numpy as np
import rasterio
from rasterio.transform import from_bounds

from geojson_pydantic import Polygon as GeoJsonPolygon


def _create_test_cog(path: str, bounds=(-10.0, -10.0, 10.0, 10.0), crs="EPSG:4326"):
    """Create a minimal 4x4 GeoTIFF for testing."""
    west, south, east, north = bounds
    transform = from_bounds(west, south, east, north, 4, 4)
    data = np.ones((1, 4, 4), dtype=np.uint8)
    with rasterio.open(
        path, "w", driver="GTiff", height=4, width=4,
        count=1, dtype="uint8", crs=crs, transform=transform,
    ) as dst:
        dst.write(data)


def test_ingest_raster_builds_valid_stac():
    from src.services.stac_ingest import build_stac_item, build_stac_collection

    with tempfile.TemporaryDirectory() as tmpdir:
        cog_path = os.path.join(tmpdir, "test.tif")
        _create_test_cog(cog_path)

        item = build_stac_item(
            cog_path=cog_path,
            dataset_id="abc-123",
            collection_id="sandbox-abc-123",
            item_id="abc-123-data",
            s3_href="s3://bucket/datasets/abc-123/converted/test.tif",
        )

        item.validate()
        item_dict = item.to_dict()

        assert item_dict["id"] == "abc-123-data"
        assert item_dict["collection"] == "sandbox-abc-123"
        assert item_dict["assets"]["data"]["href"] == "s3://bucket/datasets/abc-123/converted/test.tif"
        assert item_dict["assets"]["data"]["type"] == "image/tiff; application=geotiff; profile=cloud-optimized"
        assert len(item_dict["bbox"]) == 4

        collection = build_stac_collection(
            collection_id="sandbox-abc-123",
            description="User upload: test.tif",
            item=item,
        )

        collection.validate()
        col_dict = collection.to_dict()

        assert col_dict["id"] == "sandbox-abc-123"
        assert col_dict["extent"]["spatial"]["bbox"] == [list(item.bbox)]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_stac_ingest.py::test_ingest_raster_builds_valid_stac -v
```
Expected: FAIL — `cannot import name 'build_stac_item' from 'src.services.stac_ingest'`

- [ ] **Step 3: Write the implementation — helper functions**

Replace the entire contents of `ingestion/src/services/stac_ingest.py` with:

```python
"""STAC collection/item construction and ingestion via Transaction API."""

from datetime import datetime, timezone

import httpx
import pystac
from geojson_pydantic import Polygon as GeoJsonPolygon
from rio_stac import create_stac_item

from src.config import get_settings


COG_MEDIA_TYPE = "image/tiff; application=geotiff; profile=cloud-optimized"


def build_stac_item(
    cog_path: str,
    dataset_id: str,
    collection_id: str,
    item_id: str,
    s3_href: str,
    input_datetime: datetime | None = None,
) -> pystac.Item:
    """Build a validated STAC item from a COG file using rio-stac."""
    item = create_stac_item(
        source=cog_path,
        id=item_id,
        collection=collection_id,
        asset_href=s3_href,
        asset_media_type=COG_MEDIA_TYPE,
        asset_roles=["data"],
        input_datetime=input_datetime or datetime.now(timezone.utc),
    )
    GeoJsonPolygon.model_validate(item.geometry)
    return item


def build_stac_collection(
    collection_id: str,
    description: str,
    item: pystac.Item | None = None,
    bbox: list[float] | None = None,
    temporal_start: str | None = None,
    temporal_end: str | None = None,
) -> pystac.Collection:
    """Build a validated STAC collection.

    For single-file datasets, pass `item` to derive extent from it.
    For temporal datasets, pass `bbox`, `temporal_start`, `temporal_end` explicitly.
    """
    if item is not None:
        spatial_bbox = list(item.bbox)
        dt = item.datetime or datetime.now(timezone.utc)
        interval = [[dt.isoformat(), None]]
    else:
        spatial_bbox = bbox
        interval = [[temporal_start, temporal_end]]

    collection = pystac.Collection(
        id=collection_id,
        description=description,
        extent=pystac.Extent(
            spatial=pystac.SpatialExtent(bboxes=[spatial_bbox]),
            temporal=pystac.TemporalExtent(intervals=interval),
        ),
        license="proprietary",
    )
    return collection


async def ingest_raster(dataset_id: str, cog_path: str, s3_href: str, filename: str) -> str:
    """Ingest a COG into eoAPI: create collection + item via Transaction API.

    Returns the tile URL template for the ingested item.
    """
    settings = get_settings()
    collection_id = f"sandbox-{dataset_id}"

    item = build_stac_item(
        cog_path=cog_path,
        dataset_id=dataset_id,
        collection_id=collection_id,
        item_id=f"{dataset_id}-data",
        s3_href=s3_href,
    )
    collection = build_stac_collection(
        collection_id=collection_id,
        description=f"User upload: {filename}",
        item=item,
    )

    async with httpx.AsyncClient(base_url=settings.stac_api_url, timeout=30.0) as client:
        resp = await client.post("/collections", json=collection.to_dict())
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(f"Failed to create STAC collection: {resp.status_code} {resp.text}")

        resp = await client.post(f"/collections/{collection_id}/items", json=item.to_dict())
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Failed to create STAC item: {resp.status_code} {resp.text}")

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url


async def ingest_temporal_raster(
    dataset_id: str,
    cog_paths: list[str],
    s3_hrefs: list[str],
    filename: str,
    datetimes: list[str],
) -> str:
    """Ingest a temporal stack: one collection + N items.

    Returns the tile URL template (without datetime parameter — caller appends it).
    """
    settings = get_settings()
    collection_id = f"sandbox-{dataset_id}"

    items: list[pystac.Item] = []
    for i, (cog_path, s3_href, dt) in enumerate(zip(cog_paths, s3_hrefs, datetimes)):
        item = build_stac_item(
            cog_path=cog_path,
            dataset_id=dataset_id,
            collection_id=collection_id,
            item_id=f"{dataset_id}-{i}",
            s3_href=s3_href,
            input_datetime=datetime.fromisoformat(dt),
        )
        items.append(item)

    collection = build_stac_collection(
        collection_id=collection_id,
        description=f"Temporal upload: {filename}",
        bbox=list(items[0].bbox),
        temporal_start=datetimes[0],
        temporal_end=datetimes[-1],
    )

    async with httpx.AsyncClient(base_url=settings.stac_api_url, timeout=30.0) as client:
        resp = await client.post("/collections", json=collection.to_dict())
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(f"Failed to create STAC collection: {resp.status_code} {resp.text}")

        for i, item in enumerate(items):
            resp = await client.post(f"/collections/{collection_id}/items", json=item.to_dict())
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Failed to create STAC item {i}: {resp.status_code} {resp.text}")

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_stac_ingest.py::test_ingest_raster_builds_valid_stac -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/services/stac_ingest.py ingestion/tests/test_stac_ingest.py
git commit -m "feat: rewrite stac_ingest with rio-stac and pystac"
```

---

## Task 3: Add temporal STAC test

**Files:**
- Test: `ingestion/tests/test_stac_ingest.py`

- [ ] **Step 1: Write failing test for temporal STAC construction**

Append to `ingestion/tests/test_stac_ingest.py`:

```python
def test_ingest_temporal_builds_valid_stac():
    from src.services.stac_ingest import build_stac_item, build_stac_collection
    from datetime import datetime

    with tempfile.TemporaryDirectory() as tmpdir:
        cog_paths = []
        datetimes = ["2015-01-01T00:00:00Z", "2016-01-01T00:00:00Z", "2017-01-01T00:00:00Z"]

        for i in range(3):
            path = os.path.join(tmpdir, f"timestep_{i}.tif")
            _create_test_cog(path, bounds=(-180, -90, 180, 90))
            cog_paths.append(path)

        items = []
        for i, (cog_path, dt) in enumerate(zip(cog_paths, datetimes)):
            item = build_stac_item(
                cog_path=cog_path,
                dataset_id="abc123",
                collection_id="sandbox-abc123",
                item_id=f"abc123-{i}",
                s3_href=f"s3://bucket/datasets/abc123/timesteps/{i}/data.tif",
                input_datetime=datetime.fromisoformat(dt),
            )
            item.validate()
            items.append(item)

        assert items[0].datetime.year == 2015
        assert items[2].datetime.year == 2017

        collection = build_stac_collection(
            collection_id="sandbox-abc123",
            description="Temporal upload: sst",
            bbox=list(items[0].bbox),
            temporal_start=datetimes[0],
            temporal_end=datetimes[-1],
        )
        collection.validate()

        col_dict = collection.to_dict()
        assert col_dict["extent"]["temporal"]["interval"] == [["2015-01-01T00:00:00Z", "2017-01-01T00:00:00Z"]]
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_stac_ingest.py::test_ingest_temporal_builds_valid_stac -v
```
Expected: PASS (implementation already exists from Task 2)

- [ ] **Step 3: Commit**

```bash
git add ingestion/tests/test_stac_ingest.py
git commit -m "test: add temporal STAC construction test"
```

---

## Task 4: Add geometry validation test

**Files:**
- Test: `ingestion/tests/test_stac_ingest.py`

- [ ] **Step 1: Write test for geojson-pydantic geometry validation**

Append to `ingestion/tests/test_stac_ingest.py`:

```python
def test_geometry_is_valid_geojson():
    from src.services.stac_ingest import build_stac_item

    with tempfile.TemporaryDirectory() as tmpdir:
        cog_path = os.path.join(tmpdir, "test.tif")
        _create_test_cog(cog_path, bounds=(-122.5, 37.5, -122.0, 38.0), crs="EPSG:4326")

        item = build_stac_item(
            cog_path=cog_path,
            dataset_id="geo-test",
            collection_id="sandbox-geo-test",
            item_id="geo-test-data",
            s3_href="s3://bucket/test.tif",
        )

        # Geometry validation happens inside build_stac_item via geojson-pydantic.
        # Verify the geometry has expected structure.
        geom = item.geometry
        assert geom["type"] == "Polygon"
        assert len(geom["coordinates"]) == 1
        ring = geom["coordinates"][0]
        assert ring[0] == ring[-1]  # closed ring

        # Verify bbox is reasonable for San Francisco area
        assert -123 < item.bbox[0] < -121
        assert 37 < item.bbox[1] < 39
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_stac_ingest.py::test_geometry_is_valid_geojson -v
```
Expected: PASS

- [ ] **Step 3: Run all stac_ingest tests together**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_stac_ingest.py -v
```
Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add ingestion/tests/test_stac_ingest.py
git commit -m "test: add geometry validation test for stac_ingest"
```

---

## Task 5: Update temporal_pipeline.py call site

**Files:**
- Modify: `ingestion/src/services/temporal_pipeline.py:138-145`

- [ ] **Step 1: Drop bbox arg from ingest_temporal_raster call**

In `ingestion/src/services/temporal_pipeline.py`, change lines 138-145 from:

```python
            tile_url = await stac_ingest.ingest_temporal_raster(
                dataset_id=job.dataset_id,
                cog_paths=cog_paths,
                s3_hrefs=s3_hrefs,
                filename=display_name,
                bbox=bounds,
                datetimes=datetimes,
            )
```

To:

```python
            tile_url = await stac_ingest.ingest_temporal_raster(
                dataset_id=job.dataset_id,
                cog_paths=cog_paths,
                s3_hrefs=s3_hrefs,
                filename=display_name,
                datetimes=datetimes,
            )
```

Note: The `bounds` variable is still used on line 161 for the `Dataset` record — do NOT remove its computation on line 118.

- [ ] **Step 2: Run existing tests to verify nothing breaks**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/services/temporal_pipeline.py
git commit -m "refactor: drop bbox arg from ingest_temporal_raster call"
```

---

## Task 6: Add GeoJSON validation to pipeline.py

**Files:**
- Modify: `ingestion/src/services/pipeline.py` (after line 181)
- Test: `ingestion/tests/test_pipeline.py`

- [ ] **Step 1: Write failing test for invalid GeoJSON rejection**

Append to `ingestion/tests/test_pipeline.py` (the file already imports `pytest` on line 3 — do NOT add a duplicate import):

```python
from src.services.pipeline import validate_geojson_structure
from src.models import FormatPair


def test_invalid_geojson_rejected():
    # Missing "type" field entirely
    bad_bytes = b'{"features": []}'
    with pytest.raises(ValueError, match="Invalid GeoJSON"):
        validate_geojson_structure(bad_bytes)

    # Not a FeatureCollection
    bad_bytes2 = b'{"type": "Point", "coordinates": [0, 0]}'
    with pytest.raises(ValueError, match="Invalid GeoJSON"):
        validate_geojson_structure(bad_bytes2)


def test_valid_geojson_accepted():
    good_bytes = b'{"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}, "properties": {}}]}'
    validate_geojson_structure(good_bytes)  # should not raise
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_pipeline.py::test_invalid_geojson_rejected tests/test_pipeline.py::test_valid_geojson_accepted -v
```
Expected: FAIL — `cannot import name 'validate_geojson_structure'`

- [ ] **Step 3: Add validate_geojson_structure function to pipeline.py**

Add this function to `ingestion/src/services/pipeline.py`, after the existing imports (around line 20, before `run_pipeline`):

```python
def validate_geojson_structure(raw_bytes: bytes) -> None:
    """Validate that raw bytes are a well-formed GeoJSON FeatureCollection.

    Raises ValueError with a descriptive message if validation fails.
    """
    from geojson_pydantic import FeatureCollection
    from pydantic import ValidationError

    try:
        FeatureCollection.model_validate_json(raw_bytes)
    except ValidationError as e:
        raise ValueError(f"Invalid GeoJSON structure: {e}") from e
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest tests/test_pipeline.py::test_invalid_geojson_rejected tests/test_pipeline.py::test_valid_geojson_accepted -v
```
Expected: PASS

- [ ] **Step 5: Wire validation into run_pipeline**

In `ingestion/src/services/pipeline.py`, after line 181 (the `return` inside the `if failed:` block) and before line 183 (`# Extract bounds for auto-zoom`), add:

```python
            # Validate GeoJSON structure for vector uploads
            if format_pair == FormatPair.GEOJSON_TO_GEOPARQUET:
                from pathlib import Path
                try:
                    validate_geojson_structure(Path(input_path).read_bytes())
                except ValueError as e:
                    job.status = JobStatus.FAILED
                    job.error = str(e)
                    return
```

- [ ] **Step 6: Run all tests**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v
```
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add ingestion/src/services/pipeline.py ingestion/tests/test_pipeline.py
git commit -m "feat: add GeoJSON structure validation to vector upload path"
```

---

## Task 7: Final integration verification

- [ ] **Step 1: Run full test suite**

```bash
cd /home/anthony/projects/cng-sandbox/ingestion && uv run pytest -v
```
Expected: all tests pass, no regressions

- [ ] **Step 2: Rebuild and start the Docker stack**

```bash
cd /home/anthony/projects/cng-sandbox && docker compose -f docker-compose.yml build ingestion && docker compose -f docker-compose.yml up -d ingestion
```
Expected: container starts and becomes healthy

- [ ] **Step 3: Verify health endpoint**

```bash
curl -s http://localhost:8000/api/health | python -m json.tool
```
Expected: `{"status": "healthy"}` (or similar)

- [ ] **Step 4: Commit any remaining changes**

If any adjustments were needed during integration, commit them:
```bash
git add -A && git commit -m "fix: integration adjustments for stac library migration"
```
