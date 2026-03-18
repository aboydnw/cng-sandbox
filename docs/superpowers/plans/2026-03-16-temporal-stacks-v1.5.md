# Temporal Stacks v1.5 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-file temporal upload, time slider, animation, and GIF/MP4 export to the CNG Sandbox for raster datasets.

**Architecture:** New `POST /api/upload-temporal` endpoint accepts up to 50 raster files. Backend converts each to COG, computes global min/max, registers one STAC collection with N datetime-stamped items. Frontend adds a compact TemporalControls bar with pre-load gating, playback, and client-side export.

**Tech Stack:** Python (FastAPI, rasterio, rasterio statistics), TypeScript (React, deck.gl, MapLibre), gif.js for GIF export, mp4-muxer for MP4 export.

**Spec:** `docs/superpowers/specs/2026-03-16-temporal-stacks-v1.5-design.md`

---

## File Structure

### Backend — New files
| File | Responsibility |
|------|---------------|
| `sandbox/ingestion/src/services/temporal_ordering.py` | Extract timestamps from filenames/metadata, sort files |
| `sandbox/ingestion/src/services/temporal_validation.py` | Cross-file validation (CRS, dims, bands, bounds) |
| `sandbox/ingestion/src/services/temporal_pipeline.py` | Orchestrate N-file temporal conversion pipeline |
| `sandbox/ingestion/tests/test_temporal_ordering.py` | Tests for timestamp extraction and sorting |
| `sandbox/ingestion/tests/test_temporal_validation.py` | Tests for cross-file checks |

### Backend — Modified files
| File | Changes |
|------|---------|
| `sandbox/ingestion/src/models.py` | Add `Timestep` model; extend `Job` with `progress_current`/`progress_total`; extend `Dataset` with `is_temporal`, `timesteps`, `raster_min`, `raster_max` |
| `sandbox/ingestion/src/services/stac_ingest.py` | Add `build_temporal_collection()`, `build_temporal_items()`, `ingest_temporal_raster()` |
| `sandbox/ingestion/src/routes/upload.py` | Add `POST /api/upload-temporal` endpoint |
| `sandbox/ingestion/src/routes/jobs.py` | Include `progress_current`/`progress_total` in SSE payload |

### Frontend — New files
| File | Responsibility |
|------|---------------|
| `sandbox/frontend/src/utils/temporal.ts` | Gap detection (cadence), timestamp formatting, sub-daily detection |
| `sandbox/frontend/src/utils/temporal.test.ts` | Tests for temporal utilities |
| `sandbox/frontend/src/hooks/useTemporalPreload.ts` | Tile pre-fetching for all timesteps, progress tracking |
| `sandbox/frontend/src/hooks/useTemporalAnimation.ts` | Playback loop: play/pause, speed, frame advance |
| `sandbox/frontend/src/hooks/useTemporalExport.ts` | GIF and MP4 canvas capture + encoding |
| `sandbox/frontend/src/components/TemporalControls.tsx` | Compact controls bar: slider, play/pause, speed, export buttons |

### Frontend — Modified files
| File | Changes |
|------|---------|
| `sandbox/frontend/src/types.ts` | Add `Timestep` interface; extend `Dataset` with temporal fields |
| `sandbox/frontend/src/components/FileUploader.tsx` | Multi-file/folder drop, file count display, route to temporal endpoint |
| `sandbox/frontend/src/hooks/useConversionJob.ts` | Add `startTemporalUpload()`; display temporal progress in stages |
| `sandbox/frontend/src/components/RasterMap.tsx` | Accept temporal props, build datetime+rescale tile URLs |
| `sandbox/frontend/src/pages/MapPage.tsx` | URL state for `?t=`, pass temporal props to RasterMap |
| `sandbox/frontend/src/components/CreditsPanel.tsx` | Show temporal metadata (timestep count, date range, gaps) |

---

## Chunk 1: Backend — Models + Utilities

### Task 1: Add Timestep model and extend Job/Dataset

**Files:**
- Modify: `sandbox/ingestion/src/models.py`
- Test: `sandbox/ingestion/tests/test_models.py`

- [ ] **Step 1: Write tests for new model fields**

In `sandbox/ingestion/tests/test_models.py`, add `Timestep` to the existing import line (e.g., `from src.models import ..., Timestep`), then add:

```python
def test_timestep_model():
    ts = Timestep(datetime="2018-01-01T00:00:00Z", index=0)
    assert ts.datetime == "2018-01-01T00:00:00Z"
    assert ts.index == 0


def test_job_temporal_progress_fields():
    job = Job(filename="test.tif")
    assert job.progress_current is None
    assert job.progress_total is None
    job.progress_current = 3
    job.progress_total = 10
    assert job.progress_current == 3


def test_dataset_temporal_fields_default():
    d = Dataset(
        id="x",
        filename="x.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
    )
    assert d.is_temporal is False
    assert d.timesteps == []
    assert d.raster_min is None
    assert d.raster_max is None


def test_dataset_temporal_fields_populated():
    d = Dataset(
        id="x",
        filename="sst",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
        is_temporal=True,
        timesteps=[
            Timestep(datetime="2018-01-01T00:00:00Z", index=0),
            Timestep(datetime="2019-01-01T00:00:00Z", index=1),
        ],
        raster_min=-2.5,
        raster_max=35.0,
    )
    assert d.is_temporal is True
    assert len(d.timesteps) == 2
    assert d.raster_min == -2.5
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sandbox/ingestion && uv run pytest tests/test_models.py -v`
Expected: FAIL — `Timestep` not found, `progress_current` not a field

- [ ] **Step 3: Implement model changes**

In `sandbox/ingestion/src/models.py`, add `Timestep` class and extend `Job` and `Dataset`:

```python
class Timestep(BaseModel):
    datetime: str    # ISO 8601 UTC
    index: int       # 0-based position in temporal order
```

Add to `Job`:
```python
    progress_current: int | None = None
    progress_total: int | None = None
```

Add to `Dataset`:
```python
    is_temporal: bool = False
    timesteps: list[Timestep] = []
    raster_min: float | None = None
    raster_max: float | None = None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sandbox/ingestion && uv run pytest tests/test_models.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/models.py sandbox/ingestion/tests/test_models.py
git commit -m "feat(models): add Timestep model and temporal fields to Job/Dataset"
```

---

### Task 2: Temporal ordering utility

**Files:**
- Create: `sandbox/ingestion/src/services/temporal_ordering.py`
- Create: `sandbox/ingestion/tests/test_temporal_ordering.py`

- [ ] **Step 1: Write tests for filename timestamp extraction**

Create `sandbox/ingestion/tests/test_temporal_ordering.py`:

```python
import pytest
from src.services.temporal_ordering import extract_timestamp_from_filename, order_files


def test_extract_year_only():
    assert extract_timestamp_from_filename("sst_2015.tif") == "2015-01-01T00:00:00Z"


def test_extract_year_month():
    assert extract_timestamp_from_filename("ndvi_2020-07.tif") == "2020-07-01T00:00:00Z"


def test_extract_full_date_dashes():
    assert extract_timestamp_from_filename("fire_2023-11-01.tif") == "2023-11-01T00:00:00Z"


def test_extract_full_date_compact():
    assert extract_timestamp_from_filename("fire_20231101.tif") == "2023-11-01T00:00:00Z"


def test_extract_date_underscores():
    assert extract_timestamp_from_filename("temp_2021_01_15.tif") == "2021-01-15T00:00:00Z"


def test_extract_no_date_returns_none():
    assert extract_timestamp_from_filename("data.tif") is None


def test_order_files_by_filename():
    files = ["sst_2018.tif", "sst_2015.tif", "sst_2020.tif"]
    result = order_files(files)
    assert [r.filename for r in result] == ["sst_2015.tif", "sst_2018.tif", "sst_2020.tif"]
    assert [r.datetime for r in result] == [
        "2015-01-01T00:00:00Z",
        "2018-01-01T00:00:00Z",
        "2020-01-01T00:00:00Z",
    ]
    assert [r.index for r in result] == [0, 1, 2]


def test_order_files_alphabetical_fallback():
    files = ["alpha.tif", "gamma.tif", "beta.tif"]
    result = order_files(files)
    assert [r.filename for r in result] == ["alpha.tif", "beta.tif", "gamma.tif"]
    # No temporal signal — datetimes should still be assigned (monotonic placeholders)
    assert all(r.datetime is not None for r in result)


def test_common_prefix():
    from src.services.temporal_ordering import common_filename_prefix
    assert common_filename_prefix(["sst_2014.tif", "sst_2015.tif", "sst_2016.tif"]) == "sst"
    assert common_filename_prefix(["a.tif", "b.tif"]) == "a"  # fallback to first filename stem
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sandbox/ingestion && uv run pytest tests/test_temporal_ordering.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement temporal_ordering.py**

> **Note:** The spec lists raster metadata (`TIFFTAG_DATETIME`, NetCDF `time` coordinate) as extraction priority 1. This is deferred — v1.5 implements filename regex (priority 2) and alphabetical fallback (priority 3) only. Metadata extraction can be added later without changing the interface.

Create `sandbox/ingestion/src/services/temporal_ordering.py`:

```python
"""Extract timestamps from filenames and sort files in temporal order."""

import os
import re
from dataclasses import dataclass


@dataclass
class OrderedFile:
    filename: str
    datetime: str  # ISO 8601 UTC
    index: int


# Patterns ordered most-specific to least-specific
_PATTERNS = [
    # YYYY-MM-DD or YYYYMMDD
    (re.compile(r"(\d{4})-(\d{2})-(\d{2})"), lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}T00:00:00Z"),
    (re.compile(r"(\d{4})(\d{2})(\d{2})(?!\d)"), lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}T00:00:00Z"),
    # YYYY_MM_DD
    (re.compile(r"(\d{4})_(\d{2})_(\d{2})"), lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}T00:00:00Z"),
    # YYYY-MM
    (re.compile(r"(\d{4})-(\d{2})(?!\d)"), lambda m: f"{m.group(1)}-{m.group(2)}-01T00:00:00Z"),
    # YYYY (must not be followed by more digits)
    (re.compile(r"(?<!\d)(\d{4})(?!\d)"), lambda m: f"{m.group(1)}-01-01T00:00:00Z"),
]


def extract_timestamp_from_filename(filename: str) -> str | None:
    stem = os.path.splitext(os.path.basename(filename))[0]
    for pattern, formatter in _PATTERNS:
        match = pattern.search(stem)
        if match:
            return formatter(match)
    return None


def order_files(filenames: list[str]) -> list[OrderedFile]:
    pairs = [(f, extract_timestamp_from_filename(f)) for f in filenames]
    has_timestamps = any(dt is not None for _, dt in pairs)

    if has_timestamps:
        # Sort by extracted datetime, then filename for ties
        pairs.sort(key=lambda p: (p[1] or "9999", p[0]))
    else:
        # Alphabetical fallback
        pairs.sort(key=lambda p: p[0])

    result = []
    for i, (filename, dt) in enumerate(pairs):
        if dt is None:
            # Assign monotonic placeholder datetime for files without temporal signal
            dt = f"1970-01-01T{i:02d}:00:00Z"
        result.append(OrderedFile(filename=filename, datetime=dt, index=i))
    return result


def common_filename_prefix(filenames: list[str]) -> str:
    if not filenames:
        return ""
    if len(filenames) == 1:
        return os.path.splitext(os.path.basename(filenames[0]))[0]

    stems = [os.path.splitext(os.path.basename(f))[0] for f in filenames]
    prefix = os.path.commonprefix(stems).rstrip("_- ")
    if not prefix:
        return os.path.splitext(os.path.basename(filenames[0]))[0]
    return prefix
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sandbox/ingestion && uv run pytest tests/test_temporal_ordering.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/temporal_ordering.py sandbox/ingestion/tests/test_temporal_ordering.py
git commit -m "feat(backend): add temporal ordering utility for filename timestamp extraction"
```

---

### Task 3: Cross-file validation utility

**Files:**
- Create: `sandbox/ingestion/src/services/temporal_validation.py`
- Create: `sandbox/ingestion/tests/test_temporal_validation.py`

- [ ] **Step 1: Write tests for cross-file validation**

Create `sandbox/ingestion/tests/test_temporal_validation.py`:

```python
import numpy as np
import pytest
from src.services import temporal_validation
from src.services.temporal_validation import validate_cross_file_compatibility, compute_global_stats


def _mock_cog_meta(crs="EPSG:4326", width=1000, height=1000, bands=1, bounds=(0, 0, 10, 10)):
    return {"crs": crs, "width": width, "height": height, "bands": bands, "bounds": bounds}


def test_compatible_files_pass(monkeypatch):
    call_count = 0
    def fake_read(path):
        return _mock_cog_meta()
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", fake_read)
    paths = ["/tmp/a.tif", "/tmp/b.tif", "/tmp/c.tif"]
    errors = validate_cross_file_compatibility(paths)
    assert errors == []


def test_mismatched_crs_fails(monkeypatch):
    metas = [_mock_cog_meta(crs="EPSG:4326"), _mock_cog_meta(crs="EPSG:32633")]
    calls = iter(metas)
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", lambda p: next(calls))
    errors = validate_cross_file_compatibility(["/tmp/a.tif", "/tmp/b.tif"])
    assert len(errors) == 1
    assert "CRS" in errors[0]


def test_mismatched_dimensions_fails(monkeypatch):
    metas = [_mock_cog_meta(width=1000, height=1000), _mock_cog_meta(width=500, height=500)]
    calls = iter(metas)
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", lambda p: next(calls))
    errors = validate_cross_file_compatibility(["/tmp/a.tif", "/tmp/b.tif"])
    assert len(errors) == 1
    assert "dimensions" in errors[0].lower()


def test_mismatched_band_count_fails(monkeypatch):
    metas = [_mock_cog_meta(bands=1), _mock_cog_meta(bands=3)]
    calls = iter(metas)
    monkeypatch.setattr(temporal_validation, "_read_cog_metadata", lambda p: next(calls))
    errors = validate_cross_file_compatibility(["/tmp/a.tif", "/tmp/b.tif"])
    assert len(errors) == 1
    assert "band" in errors[0].lower()


def test_compute_global_stats(monkeypatch, tmp_path):
    # Create two fake rasters using numpy arrays
    import rasterio
    from rasterio.transform import from_bounds

    for i, (lo, hi) in enumerate([(0.0, 10.0), (5.0, 20.0)]):
        path = tmp_path / f"test_{i}.tif"
        data = np.linspace(lo, hi, 100).reshape(10, 10).astype(np.float32)
        transform = from_bounds(0, 0, 1, 1, 10, 10)
        with rasterio.open(path, "w", driver="GTiff", height=10, width=10, count=1, dtype="float32", transform=transform) as dst:
            dst.write(data, 1)

    rmin, rmax = compute_global_stats([str(tmp_path / "test_0.tif"), str(tmp_path / "test_1.tif")])
    assert rmin == pytest.approx(0.0, abs=0.1)
    assert rmax == pytest.approx(20.0, abs=0.1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sandbox/ingestion && uv run pytest tests/test_temporal_validation.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement temporal_validation.py**

Create `sandbox/ingestion/src/services/temporal_validation.py`:

```python
"""Cross-file validation for temporal stacks."""

import rasterio
from rasterio.warp import transform_bounds


def _read_cog_metadata(path: str) -> dict:
    with rasterio.open(path) as src:
        if src.crs and str(src.crs) != "EPSG:4326":
            bounds = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
        else:
            b = src.bounds
            bounds = (b.left, b.bottom, b.right, b.top)
        return {
            "crs": str(src.crs),
            "width": src.width,
            "height": src.height,
            "bands": src.count,
            "bounds": bounds,
        }


def validate_cross_file_compatibility(cog_paths: list[str]) -> list[str]:
    """Check that all COGs are spatially compatible.

    Returns a list of error strings. Empty list means all files are compatible.
    """
    if len(cog_paths) < 2:
        return []

    errors = []
    reference = _read_cog_metadata(cog_paths[0])
    ref_name = cog_paths[0].rsplit("/", 1)[-1]

    for path in cog_paths[1:]:
        name = path.rsplit("/", 1)[-1]
        meta = _read_cog_metadata(path)

        if meta["crs"] != reference["crs"]:
            errors.append(f"CRS mismatch: {name} has {meta['crs']}, expected {reference['crs']} (from {ref_name})")

        if meta["width"] != reference["width"] or meta["height"] != reference["height"]:
            errors.append(
                f"Pixel dimensions mismatch: {name} is {meta['width']}×{meta['height']}, "
                f"expected {reference['width']}×{reference['height']} (from {ref_name})"
            )

        if meta["bands"] != reference["bands"]:
            errors.append(f"Band count mismatch: {name} has {meta['bands']} bands, expected {reference['bands']} (from {ref_name})")

        # Bounds tolerance: 1e-4 degrees (~11m)
        for i, label in enumerate(["west", "south", "east", "north"]):
            if abs(meta["bounds"][i] - reference["bounds"][i]) > 1e-4:
                errors.append(f"Bounding box mismatch ({label}): {name} differs from {ref_name}")
                break

    return errors


def compute_global_stats(cog_paths: list[str]) -> tuple[float, float]:
    """Compute the global min and max pixel values across all COGs."""
    import numpy as np

    global_min = float("inf")
    global_max = float("-inf")

    for path in cog_paths:
        with rasterio.open(path) as src:
            for band_idx in range(1, src.count + 1):
                data = src.read(band_idx).astype(np.float64)
                # Filter out nodata values
                if src.nodata is not None:
                    valid = data[data != src.nodata]
                else:
                    valid = data.ravel()
                if valid.size > 0:
                    global_min = min(global_min, float(np.nanmin(valid)))
                    global_max = max(global_max, float(np.nanmax(valid)))

    return global_min, global_max
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sandbox/ingestion && uv run pytest tests/test_temporal_validation.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/temporal_validation.py sandbox/ingestion/tests/test_temporal_validation.py
git commit -m "feat(backend): add cross-file validation and global stats for temporal stacks"
```

---

## Chunk 2: Backend — Pipeline, STAC, Endpoint, SSE

### Task 4: Extend STAC ingest for temporal collections

**Files:**
- Modify: `sandbox/ingestion/src/services/stac_ingest.py`
- Modify: `sandbox/ingestion/tests/test_stac_ingest.py`

- [ ] **Step 1: Write tests for temporal STAC functions**

Add to `sandbox/ingestion/tests/test_stac_ingest.py`:

```python
from src.services.stac_ingest import build_temporal_collection, build_temporal_item


def test_build_temporal_collection():
    col = build_temporal_collection(
        dataset_id="abc123",
        filename="sst",
        bbox=[-180, -90, 180, 90],
        datetime_start="2015-01-01T00:00:00Z",
        datetime_end="2023-01-01T00:00:00Z",
    )
    assert col["id"] == "sandbox-abc123"
    assert col["extent"]["temporal"]["interval"] == [["2015-01-01T00:00:00Z", "2023-01-01T00:00:00Z"]]


def test_build_temporal_item():
    item = build_temporal_item(
        dataset_id="abc123",
        index=3,
        s3_href="s3://bucket/datasets/abc123/timesteps/3/data.tif",
        bbox=[-180, -90, 180, 90],
        datetime_str="2018-01-01T00:00:00Z",
    )
    assert item["id"] == "abc123-3"
    assert item["collection"] == "sandbox-abc123"
    assert item["properties"]["datetime"] == "2018-01-01T00:00:00Z"
    assert item["assets"]["data"]["href"] == "s3://bucket/datasets/abc123/timesteps/3/data.tif"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sandbox/ingestion && uv run pytest tests/test_stac_ingest.py -v -k temporal`
Expected: FAIL — functions not found

- [ ] **Step 3: Implement temporal STAC functions**

Add to `sandbox/ingestion/src/services/stac_ingest.py`:

```python
def build_temporal_collection(
    dataset_id: str,
    filename: str,
    bbox: list[float],
    datetime_start: str,
    datetime_end: str,
) -> dict:
    """Build a STAC collection for a temporal dataset with full temporal extent."""
    return {
        "type": "Collection",
        "id": f"sandbox-{dataset_id}",
        "stac_version": "1.0.0",
        "description": f"Temporal upload: {filename}",
        "links": [],
        "license": "proprietary",
        "extent": {
            "spatial": {"bbox": [bbox]},
            "temporal": {"interval": [[datetime_start, datetime_end]]},
        },
    }


def build_temporal_item(
    dataset_id: str,
    index: int,
    s3_href: str,
    bbox: list[float],
    datetime_str: str,
) -> dict:
    """Build a STAC item for one timestep in a temporal dataset."""
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
        "id": f"{dataset_id}-{index}",
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


async def ingest_temporal_raster(
    dataset_id: str,
    cog_paths: list[str],
    s3_hrefs: list[str],
    filename: str,
    bbox: list[float],
    datetimes: list[str],
) -> str:
    """Ingest a temporal stack: one collection + N items.

    Returns the tile URL template (without datetime parameter — caller appends it).
    """
    settings = get_settings()
    collection = build_temporal_collection(
        dataset_id, filename, bbox, datetimes[0], datetimes[-1],
    )

    async with httpx.AsyncClient(base_url=settings.stac_api_url, timeout=30.0) as client:
        resp = await client.post("/collections", json=collection)
        if resp.status_code not in (200, 201, 409):
            raise RuntimeError(f"Failed to create STAC collection: {resp.status_code} {resp.text}")

        collection_id = f"sandbox-{dataset_id}"
        for i, (s3_href, dt) in enumerate(zip(s3_hrefs, datetimes)):
            item = build_temporal_item(dataset_id, i, s3_href, bbox, dt)
            resp = await client.post(f"/collections/{collection_id}/items", json=item)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Failed to create STAC item {i}: {resp.status_code} {resp.text}")

    tile_url = (
        f"{settings.public_raster_tiler_url}/collections/{collection_id}"
        f"/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?assets=data"
    )
    return tile_url
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sandbox/ingestion && uv run pytest tests/test_stac_ingest.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/stac_ingest.py sandbox/ingestion/tests/test_stac_ingest.py
git commit -m "feat(backend): add temporal STAC collection and item registration"
```

---

### Task 5: Temporal pipeline orchestrator

**Files:**
- Create: `sandbox/ingestion/src/services/temporal_pipeline.py`

- [ ] **Step 1: Implement `run_temporal_pipeline`**

Create `sandbox/ingestion/src/services/temporal_pipeline.py`:

```python
"""Pipeline orchestrator for temporal (multi-file) raster uploads."""

import asyncio
import os
import tempfile

from src.config import get_settings
from src.models import (
    Dataset, DatasetType, FormatPair, Job, JobStatus, Timestep, ValidationCheck,
)
from src.services.detector import detect_format, validate_magic_bytes
from src.services.storage import StorageService
from src.services import stac_ingest
from src.services.temporal_ordering import order_files, common_filename_prefix
from src.services.temporal_validation import validate_cross_file_compatibility, compute_global_stats
from src.services.pipeline import (
    _import_and_convert, _import_and_validate, _extract_bounds,
    _extract_band_count, _extract_zoom_range_raster, get_credits,
)


async def run_temporal_pipeline(
    job: Job,
    input_paths: list[str],
    filenames: list[str],
    datasets_store: dict,
) -> None:
    """Execute the temporal conversion pipeline for N raster files.

    Updates job status in-place. Catches all exceptions and sets FAILED.
    """
    storage = StorageService()
    cog_paths: list[str] = []
    s3_hrefs: list[str] = []
    uploaded_keys: list[str] = []
    last_validation_results: list[ValidationCheck] = []

    try:
        # Determine temporal order from filenames
        ordered = order_files(filenames)
        job.progress_total = len(ordered)

        # Map original filenames to input paths
        name_to_path = dict(zip(filenames, input_paths))

        with tempfile.TemporaryDirectory() as tmpdir:
            # Stage 1–3: Scan, convert, validate each file
            for entry in ordered:
                input_path = name_to_path[entry.filename]
                job.progress_current = entry.index + 1

                # Scan
                job.status = JobStatus.SCANNING
                format_pair = detect_format(entry.filename)
                if format_pair.dataset_type != DatasetType.RASTER:
                    raise ValueError(f"Temporal uploads only support raster files. {entry.filename} is vector.")
                validate_magic_bytes(input_path, format_pair)

                # Upload raw
                storage.upload_raw(input_path, job.dataset_id, entry.filename)

                # Convert
                job.status = JobStatus.CONVERTING
                job.format_pair = format_pair
                out_filename = os.path.splitext(entry.filename)[0] + ".tif"
                output_path = os.path.join(tmpdir, f"timestep_{entry.index}_{out_filename}")

                await asyncio.to_thread(_import_and_convert, format_pair, input_path, output_path)
                cog_paths.append(output_path)

                # Validate
                job.status = JobStatus.VALIDATING
                check_results = await asyncio.to_thread(_import_and_validate, format_pair, input_path, output_path)
                last_validation_results = [
                    ValidationCheck(name=c.name, passed=c.passed, detail=c.detail)
                    for c in check_results
                ]
                failed = [c for c in check_results if not c.passed]
                if failed:
                    job.status = JobStatus.FAILED
                    job.error = f"Validation failed for {entry.filename}: {len(failed)} check(s) failed"
                    job.validation_results = last_validation_results
                    return

            # Cross-file validation
            job.status = JobStatus.VALIDATING
            cross_errors = await asyncio.to_thread(validate_cross_file_compatibility, cog_paths)
            if cross_errors:
                job.status = JobStatus.FAILED
                job.error = f"Cross-file validation failed: {cross_errors[0]}"
                return

            # Compute global raster stats
            raster_min, raster_max = await asyncio.to_thread(compute_global_stats, cog_paths)

            # Extract metadata from first COG (shared across all timesteps)
            bounds = await asyncio.to_thread(_extract_bounds, cog_paths[0], DatasetType.RASTER)
            band_count = await asyncio.to_thread(_extract_band_count, cog_paths[0])
            min_zoom, max_zoom = await asyncio.to_thread(_extract_zoom_range_raster, cog_paths[0])

            # Stage 4: Ingest — upload all COGs, register STAC
            job.status = JobStatus.INGESTING

            for i, (cog_path, entry) in enumerate(zip(cog_paths, ordered)):
                out_filename = os.path.basename(cog_path)
                key = storage.upload_converted(
                    cog_path, job.dataset_id, f"timesteps/{entry.index}/{out_filename}",
                )
                uploaded_keys.append(key)
                s3_hrefs.append(storage.get_s3_uri(key))

            datetimes = [entry.datetime for entry in ordered]
            display_name = common_filename_prefix(filenames)

            tile_url = await stac_ingest.ingest_temporal_raster(
                dataset_id=job.dataset_id,
                cog_paths=cog_paths,
                s3_hrefs=s3_hrefs,
                filename=display_name,
                bbox=bounds,
                datetimes=datetimes,
            )

            # Stage 5: Ready (still inside tmpdir context)
            job.status = JobStatus.READY
            job.validation_results = last_validation_results

            original_total_size = sum(os.path.getsize(name_to_path[e.filename]) for e in ordered)

            dataset = Dataset(
                id=job.dataset_id,
                filename=display_name,
                dataset_type=DatasetType.RASTER,
                format_pair=format_pair,
                tile_url=tile_url,
                bounds=bounds,
                band_count=band_count,
                original_file_size=original_total_size,
                min_zoom=min_zoom,
                max_zoom=max_zoom,
                stac_collection_id=f"sandbox-{job.dataset_id}",
                validation_results=job.validation_results,
                credits=get_credits(format_pair),
                created_at=job.created_at,
                is_temporal=True,
                timesteps=[Timestep(datetime=e.datetime, index=e.index) for e in ordered],
                raster_min=raster_min,
                raster_max=raster_max,
            )
            datasets_store[job.dataset_id] = dataset

    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        # Cleanup: remove uploaded COGs from MinIO on failure
        try:
            for key in uploaded_keys:
                storage.client.remove_object(storage.bucket, key)
        except Exception:
            pass  # best-effort cleanup
```

- [ ] **Step 2: Verify the module imports correctly**

Run: `cd sandbox/ingestion && uv run python -c "from src.services.temporal_pipeline import run_temporal_pipeline; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/services/temporal_pipeline.py
git commit -m "feat(backend): add temporal pipeline orchestrator for multi-file raster uploads"
```

---

### Task 6: Upload temporal endpoint + SSE progress

**Files:**
- Modify: `sandbox/ingestion/src/routes/upload.py`
- Modify: `sandbox/ingestion/src/routes/jobs.py`

- [ ] **Step 1: Add the temporal upload endpoint**

In `sandbox/ingestion/src/routes/upload.py`, add:

```python
from src.services.temporal_pipeline import run_temporal_pipeline

RASTER_EXTENSIONS = {".tif", ".tiff", ".nc", ".nc4"}
MAX_TEMPORAL_FILES = 50


@router.post("/upload-temporal")
@limiter.limit("5/hour")
async def upload_temporal(
    request: Request,
    files: list[UploadFile],
    background_tasks: BackgroundTasks,
):
    """Accept multiple raster files and start the temporal conversion pipeline."""
    settings = get_settings()

    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Temporal upload requires at least 2 files.")
    if len(files) > MAX_TEMPORAL_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_TEMPORAL_FILES} files per temporal upload.")

    # Validate all files are raster formats
    for f in files:
        if not f.filename:
            raise HTTPException(status_code=400, detail="All files must have filenames.")
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in RASTER_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Temporal uploads only support raster files. {f.filename} ({ext}) is not supported.",
            )

    # Save all files to temp
    tmp_paths = []
    filenames = []
    try:
        for f in files:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(f.filename)[1])
            size = 0
            while chunk := await f.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    # Cleanup already-saved files
                    for p in tmp_paths:
                        os.unlink(p)
                    os.unlink(tmp.name)
                    raise HTTPException(
                        status_code=413,
                        detail=f"{f.filename} is too large. Maximum size per file is {settings.max_upload_bytes // (1024*1024)} MB.",
                    )
                tmp.write(chunk)
            tmp.close()
            tmp_paths.append(tmp.name)
            filenames.append(f.filename)
    except HTTPException:
        raise
    except Exception:
        for p in tmp_paths:
            if os.path.exists(p):
                os.unlink(p)
        raise

    job = Job(filename=filenames[0])
    jobs[job.id] = job

    background_tasks.add_task(_run_temporal_and_cleanup, job, tmp_paths, filenames)
    return {"job_id": job.id, "dataset_id": job.dataset_id}


async def _run_temporal_and_cleanup(job: Job, input_paths: list[str], filenames: list[str]):
    """Run the temporal pipeline, then clean up all temp files."""
    try:
        await run_temporal_pipeline(job, input_paths, filenames, datasets)
    finally:
        for path in input_paths:
            if os.path.exists(path):
                os.unlink(path)
```

- [ ] **Step 2: Extend SSE payload with progress fields**

In `sandbox/ingestion/src/routes/jobs.py`, modify the `event_generator` function. Change the SSE data dict construction to include temporal progress:

```python
                data = {
                    "status": job.status.value,
                    "validation_results": [v.model_dump() for v in job.validation_results],
                }
                if job.error:
                    data["error"] = job.error
                if job.dataset_id:
                    data["dataset_id"] = job.dataset_id
                if job.progress_current is not None:
                    data["progress_current"] = job.progress_current
                if job.progress_total is not None:
                    data["progress_total"] = job.progress_total
```

Also change the loop condition to emit updates when progress changes (not just status).

Change the `last_status` initialization from `last_status = None` to:

```python
                last_status = (None, None)
```

Then replace the `if job.status != last_status:` check with:

```python
                current_snapshot = (job.status, job.progress_current)
                if current_snapshot != last_status:
                    last_status = current_snapshot
```

- [ ] **Step 3: Run existing tests to verify nothing is broken**

Run: `cd sandbox/ingestion && uv run pytest -v`
Expected: All existing tests still PASS

- [ ] **Step 4: Commit**

```bash
git add sandbox/ingestion/src/routes/upload.py sandbox/ingestion/src/routes/jobs.py
git commit -m "feat(backend): add /api/upload-temporal endpoint and extend SSE with progress fields"
```

---

## Chunk 3: Frontend — Types, Upload, Temporal Controls

### Task 7: Extend frontend types

**Files:**
- Modify: `sandbox/frontend/src/types.ts`

- [ ] **Step 1: Add Timestep interface and extend Dataset**

In `sandbox/frontend/src/types.ts`, add:

```typescript
export interface Timestep {
  datetime: string;
  index: number;
}
```

Add these fields to the `Dataset` interface:

```typescript
  is_temporal: boolean;
  timesteps: Timestep[];
  raster_min: number | null;
  raster_max: number | null;
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/types.ts
git commit -m "feat(frontend): add Timestep type and temporal fields to Dataset"
```

---

### Task 8: FileUploader multi-file support

**Files:**
- Modify: `sandbox/frontend/src/components/FileUploader.tsx`
- Modify: `sandbox/frontend/src/hooks/useConversionJob.ts`

- [ ] **Step 1: Add `startTemporalUpload` to useConversionJob**

In `sandbox/frontend/src/hooks/useConversionJob.ts`, add after `startUrlFetch`:

```typescript
  const startTemporalUpload = useCallback(
    async (files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const resp = await fetch(`${config.apiBase}/api/upload-temporal`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({ detail: "Upload failed" }));
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: detail.detail || "Upload failed",
          stages: updateStages("failed", detail.detail),
        }));
        return;
      }

      const { job_id, dataset_id } = await resp.json();
      datasetIdRef.current = dataset_id;
      setState((prev) => ({
        ...prev,
        jobId: job_id,
        datasetId: null,
        status: "pending",
        error: null,
        stages: buildInitialStages(),
      }));
      connectSSE(job_id);
    },
    [connectSSE],
  );
```

Update the return statement:
```typescript
  return { state, startUpload, startUrlFetch, startTemporalUpload };
```

- [ ] **Step 2: Update FileUploader for multi-file support**

In `sandbox/frontend/src/components/FileUploader.tsx`:

Add a new prop to `FileUploaderProps`:
```typescript
  onFilesSelected: (files: File[]) => void;
```

Add raster extension constant:
```typescript
const RASTER_EXTENSIONS = [".tif", ".tiff", ".nc"];
```

Modify the drop handler to detect multi-file drops. When multiple raster files are detected, call `onFilesSelected` instead of `onFileSelected`. Support folder drops via `webkitGetAsEntry()`:

```typescript
  const extractFilesFromEntry = useCallback(
    async (entry: FileSystemEntry): Promise<File[]> => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          (entry as FileSystemFileEntry).file((f) => resolve([f]));
        });
      }
      if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const entries: FileSystemEntry[] = await new Promise((resolve) =>
          reader.readEntries((e) => resolve(e))
        );
        const nested = await Promise.all(entries.map(extractFilesFromEntry));
        return nested.flat();
      }
      return [];
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      // Try folder drop first via webkitGetAsEntry
      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry?.())
        .filter((entry): entry is FileSystemEntry => entry !== null);

      let allFiles: File[];
      if (entries.length > 0 && entries.some((e) => e.isDirectory)) {
        allFiles = (await Promise.all(entries.map(extractFilesFromEntry))).flat();
      } else {
        allFiles = Array.from(e.dataTransfer.files);
      }

      // Filter to supported formats
      const rasterFiles = allFiles.filter((f) => {
        const ext = getExtension(f.name);
        return RASTER_EXTENSIONS.includes(ext);
      });

      if (rasterFiles.length > 1) {
        setError(null);
        onFilesSelected(rasterFiles);
        return;
      }

      // Fall back to single-file handling
      const file = allFiles[0];
      if (file) handleFile(file);
    },
    [handleFile, onFilesSelected, extractFilesFromEntry],
  );
```

Also update the `<input>` element to support multi-file selection:
```typescript
  <input
    ref={inputRef}
    type="file"
    accept={ALLOWED_EXTENSIONS.join(",")}
    multiple
    style={{ display: "none" }}
    onChange={(e) => {
      const fileList = Array.from(e.target.files ?? []);
      const rasterFiles = fileList.filter((f) =>
        RASTER_EXTENSIONS.includes(getExtension(f.name))
      );
      if (rasterFiles.length > 1) {
        setError(null);
        onFilesSelected(rasterFiles);
      } else if (fileList[0]) {
        handleFile(fileList[0]);
      }
    }}
  />
```

- [ ] **Step 3: Wire up in UploadPage**

In `sandbox/frontend/src/pages/UploadPage.tsx`:

1. Update the `useConversionJob` destructuring to include the new function:
```typescript
  const { state, startUpload, startUrlFetch, startTemporalUpload } = useConversionJob();
```

2. Update `FileUploader` to pass the new `onFilesSelected` prop:
```typescript
  <FileUploader
    onFileSelected={startUpload}
    onFilesSelected={startTemporalUpload}
    onUrlSubmitted={startUrlFetch}
    disabled={isProcessing}
  />
```

- [ ] **Step 4: Verify build succeeds**

Run: `cd sandbox/frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/components/FileUploader.tsx sandbox/frontend/src/hooks/useConversionJob.ts sandbox/frontend/src/pages/UploadPage.tsx
git commit -m "feat(frontend): add multi-file upload support for temporal stacks"
```

---

### Task 9: Temporal utility functions

**Files:**
- Create: `sandbox/frontend/src/utils/temporal.ts`
- Create: `sandbox/frontend/src/utils/temporal.test.ts`

- [ ] **Step 1: Write tests for temporal utilities**

Create `sandbox/frontend/src/utils/temporal.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  detectCadence,
  findGaps,
  isSubDaily,
  formatTimestepLabel,
} from "./temporal";

describe("detectCadence", () => {
  it("detects annual cadence", () => {
    const dts = ["2015-01-01T00:00:00Z", "2016-01-01T00:00:00Z", "2017-01-01T00:00:00Z"];
    expect(detectCadence(dts)).toBe("annual");
  });

  it("detects monthly cadence", () => {
    const dts = ["2020-01-01T00:00:00Z", "2020-02-01T00:00:00Z", "2020-03-01T00:00:00Z"];
    expect(detectCadence(dts)).toBe("monthly");
  });

  it("returns irregular for mixed intervals", () => {
    const dts = ["2020-01-01T00:00:00Z", "2020-03-15T00:00:00Z", "2020-11-20T00:00:00Z"];
    expect(detectCadence(dts)).toBe("irregular");
  });
});

describe("findGaps", () => {
  it("finds missing years in annual data", () => {
    const dts = ["2015-01-01T00:00:00Z", "2017-01-01T00:00:00Z", "2019-01-01T00:00:00Z"];
    const gaps = findGaps(dts);
    expect(gaps).toEqual(["2016-01-01T00:00:00Z", "2018-01-01T00:00:00Z"]);
  });

  it("returns empty for complete data", () => {
    const dts = ["2015-01-01T00:00:00Z", "2016-01-01T00:00:00Z", "2017-01-01T00:00:00Z"];
    expect(findGaps(dts)).toEqual([]);
  });

  it("returns empty for irregular data", () => {
    const dts = ["2020-01-01T00:00:00Z", "2020-03-15T00:00:00Z", "2020-11-20T00:00:00Z"];
    expect(findGaps(dts)).toEqual([]);
  });

  it("finds missing months in monthly data", () => {
    const dts = ["2020-01-01T00:00:00Z", "2020-03-01T00:00:00Z", "2020-04-01T00:00:00Z"];
    const gaps = findGaps(dts);
    expect(gaps).toEqual(["2020-02-01T00:00:00Z"]);
  });
});

describe("isSubDaily", () => {
  it("returns true for hourly data", () => {
    const dts = ["2021-07-15T00:00:00Z", "2021-07-15T01:00:00Z", "2021-07-15T02:00:00Z"];
    expect(isSubDaily(dts)).toBe(true);
  });

  it("returns false for annual data", () => {
    const dts = ["2015-01-01T00:00:00Z", "2016-01-01T00:00:00Z"];
    expect(isSubDaily(dts)).toBe(false);
  });
});

describe("formatTimestepLabel", () => {
  it("formats annual as year only", () => {
    expect(formatTimestepLabel("2018-01-01T00:00:00Z", "annual")).toBe("2018");
  });

  it("formats monthly as Mon YYYY", () => {
    expect(formatTimestepLabel("2020-07-01T00:00:00Z", "monthly")).toBe("Jul 2020");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sandbox/frontend && npx vitest run src/utils/temporal.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement temporal utilities**

Create `sandbox/frontend/src/utils/temporal.ts`:

```typescript
type Cadence = "annual" | "monthly" | "daily" | "hourly" | "irregular";

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const MS_MONTH = 28 * MS_DAY;
const MS_YEAR = 365 * MS_DAY;

export function detectCadence(datetimes: string[]): Cadence {
  if (datetimes.length < 2) return "irregular";

  const sorted = [...datetimes].sort();
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime());
  }

  const median = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)];

  if (median >= MS_YEAR * 0.9 && median <= MS_YEAR * 1.1) return "annual";
  if (median >= MS_MONTH * 0.9 && median <= MS_MONTH * 1.5) return "monthly";
  if (median >= MS_DAY * 0.9 && median <= MS_DAY * 1.1) return "daily";
  if (median >= MS_HOUR * 0.9 && median <= MS_HOUR * 1.1) return "hourly";
  return "irregular";
}

function addCalendarStep(date: Date, cadence: Cadence): Date {
  const d = new Date(date);
  switch (cadence) {
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "hourly":
      d.setUTCHours(d.getUTCHours() + 1);
      break;
    default:
      break;
  }
  return d;
}

export function findGaps(datetimes: string[]): string[] {
  const cadence = detectCadence(datetimes);
  if (cadence === "irregular") return [];

  const sorted = [...datetimes].sort();
  const gaps: string[] = [];
  const existing = new Set(sorted);

  for (let i = 1; i < sorted.length; i++) {
    let expected = addCalendarStep(new Date(sorted[i - 1]), cadence);
    const currTime = new Date(sorted[i]).getTime();

    while (expected.getTime() < currTime - MS_HOUR) {
      const iso = expected.toISOString().replace(".000Z", "Z");
      if (!existing.has(iso)) {
        gaps.push(iso);
      }
      expected = addCalendarStep(expected, cadence);
    }
  }

  return gaps;
}

export function isSubDaily(datetimes: string[]): boolean {
  if (datetimes.length < 2) return false;
  const sorted = [...datetimes].sort();
  const diff = new Date(sorted[1]).getTime() - new Date(sorted[0]).getTime();
  return diff < MS_DAY;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTimestepLabel(datetime: string, cadence: Cadence): string {
  const d = new Date(datetime);
  switch (cadence) {
    case "annual":
      return String(d.getUTCFullYear());
    case "monthly":
      return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    case "daily":
      return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    case "hourly": {
      const hour = d.getUTCHours().toString().padStart(2, "0");
      return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()} · ${hour}:00 UTC`;
    }
    default:
      return d.toISOString().slice(0, 10);
  }
}

export function formatDateRange(datetimes: string[], cadence: Cadence): string {
  if (datetimes.length === 0) return "";
  const sorted = [...datetimes].sort();
  const start = formatTimestepLabel(sorted[0], cadence);
  const end = formatTimestepLabel(sorted[sorted.length - 1], cadence);
  return `${start} – ${end}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sandbox/frontend && npx vitest run src/utils/temporal.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/utils/temporal.ts sandbox/frontend/src/utils/temporal.test.ts
git commit -m "feat(frontend): add temporal utility functions for cadence detection and formatting"
```

---

### Task 10: TemporalControls component

**Files:**
- Create: `sandbox/frontend/src/components/TemporalControls.tsx`

> **Deferred from v1.5 initial implementation:** Sub-daily adaptive navigation (date picker + hour slider per spec US-05) and gap tick marks on the slider (spec US-06) are not included in this component. The single linear slider handles all cadences for now. These can be added as follow-up tasks once the core temporal flow is working end-to-end.

- [ ] **Step 1: Implement the TemporalControls component**

Create `sandbox/frontend/src/components/TemporalControls.tsx`:

```typescript
import { Box, Flex, Text } from "@chakra-ui/react";
import type { Timestep } from "../types";

interface TemporalControlsProps {
  timesteps: Timestep[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  preloadProgress: { current: number; total: number } | null;
  label: string;
  onExportGif: () => void;
  onExportMp4: () => void;
  isExporting: boolean;
}

const SPEEDS = [0.5, 1, 2];

export function TemporalControls({
  timesteps,
  activeIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
  preloadProgress,
  label,
  onExportGif,
  onExportMp4,
  isExporting,
}: TemporalControlsProps) {
  const isLoading = preloadProgress !== null && preloadProgress.current < preloadProgress.total;
  const disabled = isLoading || isExporting;

  return (
    <Box position="absolute" bottom={4} left="50%" transform="translateX(-50%)" zIndex={10}>
      {/* Timestamp pill */}
      <Flex justify="center" mb={2}>
        <Box
          bg="#2d1b10"
          color="white"
          px={3}
          py={1}
          borderRadius="12px"
          fontSize="13px"
          fontWeight={600}
        >
          {label}
        </Box>
      </Flex>

      {/* Controls bar */}
      <Box
        bg="white"
        borderRadius="10px"
        boxShadow="0 2px 12px rgba(0,0,0,0.12)"
        px={4}
        py={2.5}
        w="420px"
        maxW="calc(100vw - 32px)"
      >
        {/* Pre-load progress */}
        {isLoading && (
          <Flex align="center" gap={2} mb={2}>
            <Box flex={1} h="3px" bg="#f0ebe5" borderRadius="2px" overflow="hidden">
              <Box
                h="100%"
                bg="brand.orange"
                borderRadius="2px"
                w={`${(preloadProgress.current / preloadProgress.total) * 100}%`}
                transition="width 0.3s"
              />
            </Box>
            <Text fontSize="11px" color="#888" whiteSpace="nowrap">
              Loading {preloadProgress.current} of {preloadProgress.total}…
            </Text>
          </Flex>
        )}

        {/* Main controls */}
        <Flex align="center" gap={2.5} opacity={disabled ? 0.4 : 1}>
          {/* Play/pause */}
          <Box
            as="button"
            onClick={onTogglePlay}
            disabled={disabled}
            bg={disabled ? "#ccc" : "brand.orange"}
            color="white"
            borderRadius="50%"
            w="28px"
            h="28px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor={disabled ? "not-allowed" : "pointer"}
            flexShrink={0}
            fontSize="12px"
            border="none"
          >
            {isPlaying ? "⏸" : "▶"}
          </Box>

          {/* Slider */}
          <Box flex={1}>
            <input
              type="range"
              min={0}
              max={timesteps.length - 1}
              value={activeIndex}
              onChange={(e) => onIndexChange(Number(e.target.value))}
              disabled={disabled}
              style={{ width: "100%", accentColor: "#CF3F02" }}
            />
          </Box>

          {/* Speed buttons */}
          <Flex gap="1px" flexShrink={0}>
            {SPEEDS.map((s) => (
              <Box
                key={s}
                as="button"
                onClick={() => onSpeedChange(s)}
                disabled={disabled}
                border="1px solid"
                borderColor={s === speed ? "brand.orange" : "#e8e3dd"}
                bg={s === speed ? "#fef6f1" : "white"}
                borderRadius="3px"
                px="5px"
                py="2px"
                fontSize="9px"
                color={s === speed ? "brand.orange" : "#888"}
                fontWeight={s === speed ? 600 : 400}
                cursor={disabled ? "not-allowed" : "pointer"}
              >
                {s}×
              </Box>
            ))}
          </Flex>

          {/* Divider */}
          <Box w="1px" h="20px" bg="#e8e3dd" flexShrink={0} />

          {/* Export buttons */}
          <Box
            as="button"
            onClick={onExportGif}
            disabled={disabled}
            border="1px solid #e8e3dd"
            bg="white"
            borderRadius="4px"
            px={2}
            py={1}
            fontSize="10px"
            color="#2d1b10"
            fontWeight={500}
            cursor={disabled ? "not-allowed" : "pointer"}
            flexShrink={0}
          >
            GIF
          </Box>
          <Box
            as="button"
            onClick={onExportMp4}
            disabled={disabled}
            border="1px solid #e8e3dd"
            bg="white"
            borderRadius="4px"
            px={2}
            py={1}
            fontSize="10px"
            color="#2d1b10"
            fontWeight={500}
            cursor={disabled ? "not-allowed" : "pointer"}
            flexShrink={0}
          >
            MP4
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd sandbox/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/src/components/TemporalControls.tsx
git commit -m "feat(frontend): add TemporalControls component with slider, playback, and export buttons"
```

---

## Chunk 4: Frontend — Preload, Animation, Export, Integration

### Task 11: Tile pre-loading hook

**Files:**
- Create: `sandbox/frontend/src/hooks/useTemporalPreload.ts`

- [ ] **Step 1: Implement useTemporalPreload**

Create `sandbox/frontend/src/hooks/useTemporalPreload.ts`:

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import type { Timestep } from "../types";

interface PreloadState {
  progress: { current: number; total: number } | null;
  isReady: boolean;
}

export function useTemporalPreload(
  tileUrlTemplate: string,
  timesteps: Timestep[],
  viewState: { zoom: number; longitude: number; latitude: number },
) {
  const [state, setState] = useState<PreloadState>({
    progress: null,
    isReady: false,
  });
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, boolean>>(new Map());

  const preload = useCallback(async () => {
    // Cancel any in-progress preload
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    cacheRef.current.clear();
    setState({ progress: { current: 0, total: timesteps.length }, isReady: false });

    // Build representative tile URLs for the center of the current viewport
    const z = Math.round(viewState.zoom);
    const x = Math.floor(((viewState.longitude + 180) / 360) * Math.pow(2, z));
    const latRad = (viewState.latitude * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z),
    );

    let loaded = 0;

    for (const ts of timesteps) {
      if (controller.signal.aborted) return;

      const url = tileUrlTemplate
        .replace("{z}", String(z))
        .replace("{x}", String(x))
        .replace("{y}", String(y))
        + `&datetime=${ts.datetime}`;

      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (resp.ok) {
          cacheRef.current.set(ts.datetime, true);
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      loaded++;
      setState({
        progress: { current: loaded, total: timesteps.length },
        isReady: false,
      });
    }

    if (!controller.signal.aborted) {
      setState({ progress: null, isReady: true });
    }
  }, [tileUrlTemplate, timesteps, viewState.zoom, viewState.longitude, viewState.latitude]);

  useEffect(() => {
    if (timesteps.length > 0) {
      preload();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [preload]);

  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/hooks/useTemporalPreload.ts
git commit -m "feat(frontend): add useTemporalPreload hook for tile pre-fetching"
```

---

### Task 12: Animation playback hook

**Files:**
- Create: `sandbox/frontend/src/hooks/useTemporalAnimation.ts`

- [ ] **Step 1: Implement useTemporalAnimation**

Create `sandbox/frontend/src/hooks/useTemporalAnimation.ts`:

```typescript
import { useState, useRef, useCallback, useEffect } from "react";

const SPEED_MS: Record<number, number> = {
  0.5: 1600,
  1: 800,
  2: 400,
};

interface AnimationState {
  isPlaying: boolean;
  speed: number;
  activeIndex: number;
}

export function useTemporalAnimation(
  totalFrames: number,
  gapIndices: Set<number>,
  isReady: boolean,
  initialIndex: number = 0,
) {
  const [state, setState] = useState<AnimationState>({
    isPlaying: false,
    speed: 1,
    activeIndex: initialIndex,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceFrame = useCallback(() => {
    setState((prev) => {
      let next = prev.activeIndex + 1;
      if (next >= totalFrames) next = 0;
      // Skip gaps
      while (gapIndices.has(next) && next < totalFrames) {
        next++;
        if (next >= totalFrames) next = 0;
      }
      return { ...prev, activeIndex: next };
    });
  }, [totalFrames, gapIndices]);

  const togglePlay = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setActiveIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, activeIndex: index, isPlaying: false }));
  }, []);

  // Start/stop interval based on play state
  useEffect(() => {
    clearTimer();
    if (state.isPlaying && isReady) {
      timerRef.current = setInterval(advanceFrame, SPEED_MS[state.speed] ?? 800);
    }
    return clearTimer;
  }, [state.isPlaying, state.speed, isReady, advanceFrame, clearTimer]);

  // Stop playing if not ready
  useEffect(() => {
    if (!isReady && state.isPlaying) {
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, [isReady, state.isPlaying]);

  return {
    ...state,
    togglePlay,
    setSpeed,
    setActiveIndex,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/hooks/useTemporalAnimation.ts
git commit -m "feat(frontend): add useTemporalAnimation hook for playback control"
```

---

### Task 13: GIF and MP4 export hook

**Files:**
- Create: `sandbox/frontend/src/hooks/useTemporalExport.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd sandbox/frontend && npm install gif.js mp4-muxer`
Run: `cd sandbox/frontend && npm install -D @types/gif.js`

Add a `postinstall` script to `sandbox/frontend/package.json` to copy the gif.js worker to the public directory (so it survives `npm install`):

```json
"scripts": {
  "postinstall": "cp node_modules/gif.js/dist/gif.worker.js public/gif.worker.js"
}
```

Then run `npm install` to trigger the copy (or run the copy manually for now):
Run: `cd sandbox/frontend && cp node_modules/gif.js/dist/gif.worker.js public/gif.worker.js`

Note: `gif.js` may not have types. If `@types/gif.js` doesn't exist, create a minimal declaration in `sandbox/frontend/src/gif.js.d.ts`:

```typescript
declare module "gif.js" {
  export default class GIF {
    constructor(options: Record<string, unknown>);
    addFrame(canvas: HTMLCanvasElement, options?: { delay?: number }): void;
    on(event: string, callback: (blob: Blob) => void): void;
    render(): void;
  }
}
```

- [ ] **Step 2: Implement useTemporalExport**

Create `sandbox/frontend/src/hooks/useTemporalExport.ts`:

```typescript
import { useState, useCallback, useRef } from "react";
import type { Timestep } from "../types";

interface ExportState {
  isExporting: boolean;
  format: "gif" | "mp4" | null;
  progress: { current: number; total: number } | null;
}

export function useTemporalExport(
  deckRef: React.RefObject<{ deck?: { canvas?: HTMLCanvasElement } } | null>,
  timesteps: Timestep[],
  gapIndices: Set<number>,
  speedMs: number,
) {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
    progress: null,
  });
  const setActiveIndexRef = useRef<((i: number) => void) | null>(null);

  const captureFrame = useCallback(async (index: number): Promise<HTMLCanvasElement | null> => {
    if (setActiveIndexRef.current) {
      setActiveIndexRef.current(index);
    }
    // Wait for render
    await new Promise((r) => setTimeout(r, 200));

    const canvas = deckRef.current?.deck?.canvas;
    if (!canvas) return null;

    // Clone canvas to avoid mutations
    const clone = document.createElement("canvas");
    clone.width = canvas.width;
    clone.height = canvas.height;
    const ctx = clone.getContext("2d");
    ctx?.drawImage(canvas, 0, 0);
    return clone;
  }, [deckRef]);

  const exportGif = useCallback(async (setActiveIndex: (i: number) => void) => {
    const GIF = (await import("gif.js")).default;
    setActiveIndexRef.current = setActiveIndex;

    const validTimesteps = timesteps.filter((_, i) => !gapIndices.has(i));
    setState({ isExporting: true, format: "gif", progress: { current: 0, total: validTimesteps.length } });

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: "/gif.worker.js",
    });

    for (let i = 0; i < validTimesteps.length; i++) {
      const canvas = await captureFrame(validTimesteps[i].index);
      if (canvas) {
        gif.addFrame(canvas, { delay: speedMs });
      }
      setState((prev) => ({
        ...prev,
        progress: { current: i + 1, total: validTimesteps.length },
      }));
    }

    gif.on("finished", (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "animation.gif";
      a.click();
      URL.revokeObjectURL(url);
      setState({ isExporting: false, format: null, progress: null });
    });

    gif.render();
  }, [timesteps, gapIndices, speedMs, captureFrame]);

  const exportMp4 = useCallback(async (setActiveIndex: (i: number) => void) => {
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    setActiveIndexRef.current = setActiveIndex;

    const validTimesteps = timesteps.filter((_, i) => !gapIndices.has(i));
    setState({ isExporting: true, format: "mp4", progress: { current: 0, total: validTimesteps.length } });

    const canvas = deckRef.current?.deck?.canvas;
    if (!canvas) {
      setState({ isExporting: false, format: null, progress: null });
      return;
    }

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",
        width: canvas.width,
        height: canvas.height,
      },
      fastStart: "in-memory",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
      error: console.error,
    });

    encoder.configure({
      codec: "avc1.42001f",
      width: canvas.width,
      height: canvas.height,
      bitrate: 2_000_000,
      framerate: 1000 / speedMs,
    });

    for (let i = 0; i < validTimesteps.length; i++) {
      const frame = await captureFrame(validTimesteps[i].index);
      if (frame) {
        const videoFrame = new VideoFrame(frame, {
          timestamp: i * speedMs * 1000, // microseconds
        });
        encoder.encode(videoFrame);
        videoFrame.close();
      }
      setState((prev) => ({
        ...prev,
        progress: { current: i + 1, total: validTimesteps.length },
      }));
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const buffer = (muxer.target as ArrayBufferTarget).buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "animation.mp4";
    a.click();
    URL.revokeObjectURL(url);

    setState({ isExporting: false, format: null, progress: null });
  }, [timesteps, gapIndices, speedMs, deckRef, captureFrame]);

  return { ...state, exportGif, exportMp4 };
}
```

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/src/hooks/useTemporalExport.ts
git commit -m "feat(frontend): add useTemporalExport hook for GIF and MP4 client-side export"
```

---

### Task 14: Integrate temporal mode into RasterMap and MapPage

**Files:**
- Modify: `sandbox/frontend/src/components/RasterMap.tsx`
- Modify: `sandbox/frontend/src/pages/MapPage.tsx`
- Modify: `sandbox/frontend/src/components/CreditsPanel.tsx`

- [ ] **Step 1: Add temporal mode to RasterMap**

In `sandbox/frontend/src/components/RasterMap.tsx`:

Add imports:
```typescript
import { TemporalControls } from "./TemporalControls";
import { useTemporalPreload } from "../hooks/useTemporalPreload";
import { useTemporalAnimation } from "../hooks/useTemporalAnimation";
import { useTemporalExport } from "../hooks/useTemporalExport";
import { detectCadence, findGaps, formatTimestepLabel } from "../utils/temporal";
```

After the existing state declarations, add temporal logic when `dataset.is_temporal`:

```typescript
  // Temporal state
  const deckRef = useRef(null);
  const [viewState, setViewState] = useState(initialViewState);

  const cadence = useMemo(
    () => dataset.is_temporal ? detectCadence(dataset.timesteps.map((t) => t.datetime)) : "irregular",
    [dataset],
  );

  // gaps computed in gapDatetimes below (used by CreditsPanel)

  // Map gap datetimes back to indices in the full timeline
  // Note: gaps from findGaps are *missing* timesteps not present in the array,
  // so gapIndices here is empty for the timesteps[] array itself.
  // Gap-skipping in animation operates on the slider position, not array indices.
  // For now, gaps are visual-only (label shows "(no data)") and animation skips
  // positions where no timestep data exists.
  // Compute gap datetimes for display in CreditsPanel
  const gapDatetimes = useMemo(
    () => dataset.is_temporal ? findGaps(dataset.timesteps.map((t) => t.datetime)) : [],
    [dataset],
  );

  // Note: Animation gap-skipping and export gap-exclusion (US-06) require mapping
  // gap datetimes to slider positions on a full expected timeline. This is deferred —
  // the current implementation plays through all uploaded timesteps sequentially.
  // The hooks accept gapIndices for forward-compatibility but it's always empty for now.
  const gapIndices = useMemo(() => new Set<number>(), []);

  const preloadState = useTemporalPreload(
    dataset.is_temporal ? tileUrl : "",
    dataset.is_temporal ? dataset.timesteps : [],
    viewState,
  );

  const animation = useTemporalAnimation(
    dataset.timesteps?.length ?? 0,
    gapIndices,
    preloadState.isReady,
    initialTimestep ?? 0,
  );

  const speedMs = { 0.5: 1600, 1: 800, 2: 400 }[animation.speed] ?? 800;
  const exportHook = useTemporalExport(deckRef, dataset.timesteps ?? [], gapIndices, speedMs);
```

Modify `tileUrl` to include `datetime` and `rescale` for temporal datasets:

```typescript
  const tileUrl = useMemo(() => {
    let base = dataset.tile_url;
    if (!isSingleBand) return base;
    const separator = base.includes("?") ? "&" : "?";
    let url = `${base}${separator}colormap_name=${colormapName}`;
    if (dataset.is_temporal && dataset.raster_min != null && dataset.raster_max != null) {
      url += `&rescale=${dataset.raster_min},${dataset.raster_max}`;
    }
    return url;
  }, [dataset, colormapName, isSingleBand]);

  const activeTileUrl = useMemo(() => {
    if (!dataset.is_temporal || !dataset.timesteps.length) return tileUrl;
    const ts = dataset.timesteps[animation.activeIndex];
    if (!ts) return tileUrl;
    return `${tileUrl}&datetime=${ts.datetime}`;
  }, [tileUrl, dataset, animation.activeIndex]);
```

Use `activeTileUrl` in the layer instead of `tileUrl`:

```typescript
  const layer = useMemo(() => {
    return createCOGLayer({
      id: "raster-layer",
      tileUrl: dataset.is_temporal ? activeTileUrl : tileUrl,
      opacity,
    });
  }, [activeTileUrl, tileUrl, dataset.is_temporal, opacity]);
```

Add `onViewStateChange` to DeckGL and pass `ref`:

```typescript
      <DeckGL
        ref={deckRef}
        initialViewState={initialViewState}
        controller
        layers={[layer]}
        views={new MapView({ repeat: true })}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
      >
```

Add TemporalControls after the existing map overlay controls (inside the parent `<Box>`):

```typescript
      {dataset.is_temporal && (
        <TemporalControls
          timesteps={dataset.timesteps}
          activeIndex={animation.activeIndex}
          onIndexChange={animation.setActiveIndex}
          isPlaying={animation.isPlaying}
          onTogglePlay={animation.togglePlay}
          speed={animation.speed}
          onSpeedChange={animation.setSpeed}
          preloadProgress={preloadState.progress}
          label={
            dataset.timesteps[animation.activeIndex]
              ? formatTimestepLabel(dataset.timesteps[animation.activeIndex].datetime, cadence)
              : ""
          }
          onExportGif={() => exportHook.exportGif(animation.setActiveIndex)}
          onExportMp4={() => exportHook.exportMp4(animation.setActiveIndex)}
          isExporting={exportHook.isExporting}
        />
      )}
```

- [ ] **Step 2: Add URL state for temporal datasets in MapPage**

In `sandbox/frontend/src/pages/MapPage.tsx`:

Read `?t=` from URL on load and pass to RasterMap. Add `useSearchParams`:

```typescript
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
```

Inside the component, after dataset is loaded:

```typescript
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTimestep = Number(searchParams.get("t") ?? 0);
```

Pass to RasterMap:

```typescript
  <RasterMap
    dataset={dataset}
    initialTimestep={initialTimestep}
    onTimestepChange={(index) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("t", String(index));
        return next;
      }, { replace: true });
    }}
  />
```

Update `RasterMap` props to accept `initialTimestep` and `onTimestepChange`:

```typescript
interface RasterMapProps {
  dataset: Dataset;
  initialTimestep?: number;
  onTimestepChange?: (index: number) => void;
}
```

In the animation hook initialization, pass `initialTimestep` as the fourth argument to `useTemporalAnimation` (the `initialIndex` parameter was already added in Task 12).

Add a `useEffect` to sync animation index changes to the URL:

```typescript
  useEffect(() => {
    if (dataset.is_temporal && onTimestepChange) {
      onTimestepChange(animation.activeIndex);
    }
  }, [animation.activeIndex, dataset.is_temporal, onTimestepChange]);
```

- [ ] **Step 3: Add temporal metadata to CreditsPanel**

In `sandbox/frontend/src/components/CreditsPanel.tsx`:

Add imports:
```typescript
import { detectCadence, formatDateRange } from "../utils/temporal";
```

Add a `gapCount` prop to the component (passed from RasterMap as `gapDatetimes.length`):
```typescript
  gapCount?: number;
```

After the validation section, add a temporal metadata section:

```typescript
      {dataset.is_temporal && dataset.timesteps.length > 0 && (
        <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
          <Text
            fontSize="11px"
            textTransform="uppercase"
            letterSpacing="1px"
            color="brand.textSecondary"
            fontWeight={600}
            mb={2}
          >
            Temporal
          </Text>
          <Text color="brand.brown" fontSize="13px" fontWeight={600}>
            {gapCount > 0
              ? `${dataset.timesteps.length} of ${dataset.timesteps.length + gapCount} timesteps available`
              : `${dataset.timesteps.length} timesteps`}
            {" · "}
            {formatDateRange(
              dataset.timesteps.map((t) => t.datetime),
              detectCadence(dataset.timesteps.map((t) => t.datetime)),
            )}
          </Text>
        </Box>
      )}
```

- [ ] **Step 4: Verify build**

Run: `cd sandbox/frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/components/RasterMap.tsx sandbox/frontend/src/pages/MapPage.tsx sandbox/frontend/src/components/CreditsPanel.tsx
git commit -m "feat(frontend): integrate temporal controls, URL state, and credits metadata"
```

---

### Task 15: SSE progress display for temporal uploads

**Files:**
- Modify: `sandbox/frontend/src/hooks/useConversionJob.ts`
- Modify: `sandbox/frontend/src/components/ProgressTracker.tsx`

- [ ] **Step 1: Extend SSE handler to read progress fields**

In `sandbox/frontend/src/hooks/useConversionJob.ts`, extend the SSE data type:

```typescript
      let data: { status: JobStatus; error?: string; progress_current?: number; progress_total?: number };
```

Update `ConversionJobState` in `types.ts` to include:
```typescript
  progressCurrent: number | null;
  progressTotal: number | null;
```

Update the `updateStages` function to accept progress and modify the active stage detail:

```typescript
function updateStages(status: JobStatus, error?: string, progressCurrent?: number, progressTotal?: number): StageInfo[] {
  const idx = STATUS_ORDER.indexOf(status);
  return STAGE_NAMES.map((name, i) => {
    if (status === "failed") {
      if (i < idx) return { name, status: "done" as const };
      if (i === idx || (idx === -1 && i === 0))
        return { name, status: "error" as const, detail: error };
      return { name, status: "pending" as const };
    }
    if (i < idx) return { name, status: "done" as const };
    if (i === idx) {
      const detail = progressCurrent && progressTotal
        ? `${progressCurrent} of ${progressTotal}`
        : undefined;
      return { name, status: "active" as const, detail };
    }
    return { name, status: "pending" as const };
  });
}
```

Pass the progress fields through the SSE handler:

```typescript
      setState((prev) => ({
        ...prev,
        status,
        error,
        progressCurrent: data.progress_current ?? null,
        progressTotal: data.progress_total ?? null,
        datasetId: status === "ready" ? datasetIdRef.current : prev.datasetId,
        stages: updateStages(status, error ?? undefined, data.progress_current, data.progress_total),
      }));
```

- [ ] **Step 2: Update ProgressTracker to display the detail**

In `sandbox/frontend/src/components/ProgressTracker.tsx`, if a stage has a `detail` string and is active, display it (e.g., "Converting · 3 of 10"):

```typescript
  {stage.detail && stage.status === "active" && (
    <Text fontSize="11px" color="brand.textSecondary"> · {stage.detail}</Text>
  )}
```

(Exact placement depends on existing ProgressTracker markup — append to the stage name display.)

- [ ] **Step 3: Verify build**

Run: `cd sandbox/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add sandbox/frontend/src/hooks/useConversionJob.ts sandbox/frontend/src/components/ProgressTracker.tsx sandbox/frontend/src/types.ts
git commit -m "feat(frontend): display temporal progress (N of M) in SSE progress tracker"
```

---

### Task 16: End-to-end smoke test

- [ ] **Step 1: Build the library and start the stack**

```bash
cd /home/anthony/projects/map-app-builder
npm run build
docker compose -f sandbox/docker-compose.yml up -d --build
```

- [ ] **Step 2: Test single-file upload still works (regression)**

Open http://localhost:5185, upload a single GeoTIFF, verify map renders.

- [ ] **Step 3: Test temporal upload**

Generate 3 small temporal GeoTIFFs for testing:

```bash
cd /tmp && python3 -c "
import numpy as np, rasterio
from rasterio.transform import from_bounds
for year in [2015, 2016, 2017]:
    data = (np.random.rand(100, 100) * 100).astype('float32')
    transform = from_bounds(-10, -10, 10, 10, 100, 100)
    with rasterio.open(f'sst_{year}.tif', 'w', driver='GTiff', height=100, width=100,
                       count=1, dtype='float32', crs='EPSG:4326', transform=transform) as dst:
        dst.write(data, 1)
"
```

Drop all 3 files (`sst_2015.tif`, `sst_2016.tif`, `sst_2017.tif`) onto the upload zone. Verify:
- SSE progress shows "Converting 1 of 3…"
- Map page loads with TemporalControls visible
- Time slider scrubs between timesteps
- Play/pause works
- Timestamp pill shows correct year
- URL updates with `?t=` parameter
- Credits sidebar shows temporal metadata

- [ ] **Step 4: Commit any fixes discovered during smoke test**
