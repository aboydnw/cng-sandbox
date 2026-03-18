# CNG Report Card Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible "See what changed →" drawer to the sandbox map page that shows file size, data efficiency, portability, and capability stats for every converted dataset.

**Architecture:** Extend the backend `Dataset` model with 6 new fields captured during conversion; add a `ReportCard` React component that reads these fields plus live tile transfer bytes from the browser Performance API; wire everything into `MapPage` via a bottom drawer triggered from the header.

**Tech Stack:** Python (FastAPI, rasterio, geopandas), TypeScript (React 19, Chakra UI v3, PerformanceObserver API), pytest, vitest

---

## File map

**Backend — modify:**
- `sandbox/ingestion/src/models.py` — add 6 new optional fields to `Dataset`
- `sandbox/ingestion/src/services/pipeline.py` — add extraction helpers; wire fields into `run_pipeline`; modify `ingest_pmtiles` return type
- `sandbox/ingestion/src/services/pmtiles_ingest.py` — return `(tile_url, min_zoom, max_zoom, file_size)` tuple instead of just `tile_url`

**Backend — test:**
- `sandbox/ingestion/tests/test_pipeline.py` — add tests for `_extract_feature_stats`, `_extract_zoom_range_raster`
- `sandbox/ingestion/tests/test_pmtiles_ingest.py` — update callers for new return type; add `_read_pmtiles_zoom_range` unit tests

**Frontend — modify:**
- `sandbox/frontend/src/types.ts` — add 6 new optional fields to `Dataset` interface

**Frontend — create:**
- `sandbox/frontend/src/hooks/useTileTransferSize.ts` — PerformanceObserver hook that accumulates tile bytes
- `sandbox/frontend/src/components/ReportCard.tsx` — full drawer component

**Frontend — modify:**
- `sandbox/frontend/src/pages/MapPage.tsx` — add "See what changed →" button and `<ReportCard>` overlay

**Frontend — test:**
- `sandbox/frontend/src/hooks/useTileTransferSize.test.ts` — unit tests for the hook

---

## Chunk 1: Backend — new dataset fields

### Task 1: Extend Dataset model

**Files:**
- Modify: `sandbox/ingestion/src/models.py`

- [ ] **Step 1: Write the failing test**

Add to `sandbox/ingestion/tests/test_models.py`:

```python
def test_dataset_new_fields_default_none():
    d = Dataset(
        id="x",
        filename="x.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
    )
    assert d.original_file_size is None
    assert d.converted_file_size is None
    assert d.feature_count is None
    assert d.geometry_types is None
    assert d.min_zoom is None
    assert d.max_zoom is None
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd sandbox/ingestion && uv run pytest tests/test_models.py::test_dataset_new_fields_default_none -v
```

Expected: `FAILED` — `Dataset.__init__` has no such fields.

- [ ] **Step 3: Add the fields to `Dataset`**

In `sandbox/ingestion/src/models.py`, add to the `Dataset` class after `band_count`:

```python
original_file_size: int | None = None    # bytes, captured before conversion
converted_file_size: int | None = None   # bytes, output file in MinIO
feature_count: int | None = None         # vector only; None for raster
geometry_types: list[str] | None = None  # frequency-sorted; None for raster
min_zoom: int | None = None
max_zoom: int | None = None
```

- [ ] **Step 4: Run tests**

```bash
cd sandbox/ingestion && uv run pytest tests/test_models.py -v
```

Expected: all PASSED.

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/models.py sandbox/ingestion/tests/test_models.py
git commit -m "feat(backend): add report card fields to Dataset model"
```

---

### Task 2: Add extraction helpers to pipeline.py

**Files:**
- Modify: `sandbox/ingestion/src/services/pipeline.py`
- Modify: `sandbox/ingestion/tests/test_pipeline.py`

- [ ] **Step 1: Write failing tests for `_extract_feature_stats`**

Add to `sandbox/ingestion/tests/test_pipeline.py`:

```python
from src.services.pipeline import _extract_feature_stats, _extract_zoom_range_raster


def test_extract_feature_stats_single_type(polygon_parquet):
    count, types = _extract_feature_stats(polygon_parquet)
    assert count == 1
    assert types == ["Polygon"]


def test_extract_feature_stats_mixed_types(mixed_parquet):
    count, types = _extract_feature_stats(mixed_parquet)
    assert count == 2
    # Point appears once, Polygon appears once — order is by frequency (ties go either way)
    assert set(types) == {"Point", "Polygon"}


def test_extract_feature_stats_empty(tmp_path):
    import geopandas as gpd
    gdf = gpd.GeoDataFrame({"name": []}, geometry=gpd.GeoSeries([], dtype="geometry"), crs="EPSG:4326")
    path = str(tmp_path / "empty.parquet")
    gdf.to_parquet(path)
    count, types = _extract_feature_stats(path)
    assert count == 0
    assert types == []
```

- [ ] **Step 2: Write failing test for `_extract_zoom_range_raster`**

```python
def test_extract_zoom_range_raster(tmp_path):
    import numpy as np
    import rasterio
    from rasterio.transform import from_bounds

    # Create a small test GeoTIFF covering 1 degree in WGS84
    transform = from_bounds(0, 0, 1, 1, 256, 256)
    path = str(tmp_path / "test.tif")
    with rasterio.open(
        path, "w", driver="GTiff",
        height=256, width=256, count=1,
        dtype=np.uint8, crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(np.zeros((1, 256, 256), dtype=np.uint8))

    min_zoom, max_zoom = _extract_zoom_range_raster(path)
    assert 0 <= min_zoom <= max_zoom <= 20
```

- [ ] **Step 3: Run to confirm tests fail**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pipeline.py -k "extract_feature_stats or extract_zoom_range_raster" -v
```

Expected: `ImportError` — functions don't exist yet.

- [ ] **Step 4: Implement the helpers in `pipeline.py`**

Add these functions to `sandbox/ingestion/src/services/pipeline.py` (after the existing `_extract_band_count` function):

```python
def _extract_feature_stats(parquet_path: str) -> tuple[int, list[str]]:
    """Return (feature_count, geometry_types) from a GeoParquet file.

    geometry_types is sorted by frequency, most common first.
    """
    import geopandas as gpd
    gdf = gpd.read_parquet(parquet_path)
    feature_count = len(gdf)
    if feature_count == 0:
        return 0, []
    geometry_types = gdf.geometry.geom_type.value_counts().index.tolist()
    return feature_count, geometry_types


def _extract_zoom_range_raster(cog_path: str) -> tuple[int, int]:
    """Derive min/max tile zoom from a COG's native resolution and overview count."""
    import math
    import rasterio
    from rasterio.crs import CRS
    from rasterio.warp import transform_bounds

    with rasterio.open(cog_path) as src:
        if src.crs and not src.crs.is_geographic:
            bounds = transform_bounds(src.crs, CRS.from_epsg(4326), *src.bounds)
        else:
            b = src.bounds
            bounds = (b.left, b.bottom, b.right, b.top)

        width_deg = bounds[2] - bounds[0]
        if width_deg <= 0 or src.width <= 0:
            return 0, 0

        native_pixel_deg = width_deg / src.width
        max_zoom = max(0, min(20, round(math.log2(360.0 / (native_pixel_deg * 256)))))
        n_overviews = len(src.overviews(1))
        min_zoom = max(0, max_zoom - n_overviews)
        return min_zoom, max_zoom
```

- [ ] **Step 5: Run tests**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pipeline.py -v
```

Expected: all PASSED.

- [ ] **Step 6: Commit**

```bash
git add sandbox/ingestion/src/services/pipeline.py sandbox/ingestion/tests/test_pipeline.py
git commit -m "feat(backend): add feature stats and zoom range extraction helpers"
```

---

### Task 3: Modify `ingest_pmtiles` to return zoom range

**Files:**
- Modify: `sandbox/ingestion/src/services/pmtiles_ingest.py`
- Modify: `sandbox/ingestion/tests/test_pmtiles_ingest.py`

- [ ] **Step 1: Update tests to expect tuple return**

In `sandbox/ingestion/tests/test_pmtiles_ingest.py`, update the fake tippecanoe to write a valid PMTiles header:

```python
def _write_fake_pmtiles(path: str, min_zoom: int = 0, max_zoom: int = 14) -> None:
    """Write a minimal valid PMTiles v3 header to a file."""
    header = bytearray(102)
    header[:7] = b"PMTiles"
    header[7] = 3
    header[100] = min_zoom
    header[101] = max_zoom
    with open(path, "wb") as f:
        f.write(bytes(header))
```

Replace **every** `fake_run` that writes `b"fake pmtiles"` with `_write_fake_pmtiles(output_path)`. This covers `test_ingest_pmtiles_calls_tippecanoe_with_required_flags` and `test_ingest_pmtiles_uploads_to_storage`. (`test_ingest_pmtiles_raises_on_tippecanoe_failure` doesn't write a file — no change needed.)

Update assertion in `test_ingest_pmtiles_calls_tippecanoe_with_required_flags`:

```python
tile_url, min_zoom, max_zoom, file_size = ingest_pmtiles("abc-123", polygon_parquet, _storage=mock_storage)
assert tile_url == "/pmtiles/datasets/abc-123/converted/data.pmtiles"
assert min_zoom == 0
assert max_zoom == 14
assert file_size == 102
```

Update `test_ingest_pmtiles_uploads_to_storage` — after replacing `fake_run`, update the body assertion:
```python
obj = mock_storage.s3.get_object(Bucket="test-bucket", Key="datasets/abc-123/converted/data.pmtiles")
assert len(obj["Body"].read()) == 102  # valid PMTiles header size
```

Add new tests:
```python
def test_ingest_pmtiles_returns_zoom_range_and_size(monkeypatch, polygon_parquet, mock_storage):
    """ingest_pmtiles returns (tile_url, min_zoom, max_zoom, file_size)."""
    def fake_run(cmd, **kwargs):
        output_flag = next(f for f in cmd if f.startswith("--output="))
        output_path = output_flag.split("=", 1)[1]
        _write_fake_pmtiles(output_path, min_zoom=3, max_zoom=12)
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    _, min_zoom, max_zoom, file_size = ingest_pmtiles("abc-123", polygon_parquet, _storage=mock_storage)
    assert min_zoom == 3
    assert max_zoom == 12
    assert file_size == 102


def test_read_pmtiles_zoom_range(tmp_path):
    """_read_pmtiles_zoom_range reads min/max zoom from a valid PMTiles header."""
    from src.services.pmtiles_ingest import _read_pmtiles_zoom_range
    header = bytearray(102)
    header[:7] = b"PMTiles"
    header[7] = 3
    header[100] = 2
    header[101] = 14
    path = str(tmp_path / "data.pmtiles")
    with open(path, "wb") as f:
        f.write(bytes(header))
    assert _read_pmtiles_zoom_range(path) == (2, 14)


def test_read_pmtiles_zoom_range_invalid_file(tmp_path):
    from src.services.pmtiles_ingest import _read_pmtiles_zoom_range
    path = str(tmp_path / "bad.pmtiles")
    with open(path, "wb") as f:
        f.write(b"NOTVALID")
    with pytest.raises(ValueError):
        _read_pmtiles_zoom_range(path)
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pmtiles_ingest.py -v
```

Expected: failures due to old return type and missing `_write_fake_pmtiles`.

- [ ] **Step 3: Update `ingest_pmtiles` to return zoom range**

In `sandbox/ingestion/src/services/pmtiles_ingest.py`, add `_read_pmtiles_zoom_range` as a module-level helper (do NOT import it from `pipeline.py` — that would create a circular import since `pipeline.py` imports `pmtiles_ingest`):

```python
def _read_pmtiles_zoom_range(pmtiles_path: str) -> tuple[int, int]:
    """Read min_zoom and max_zoom from a PMTiles v3 file header.

    PMTiles v3 spec: min_zoom at byte 100, max_zoom at byte 101.
    """
    with open(pmtiles_path, "rb") as f:
        header = f.read(102)
    if len(header) < 102 or header[:7] != b"PMTiles":
        raise ValueError(f"Not a valid PMTiles v3 file: {pmtiles_path}")
    return header[100], header[101]


def ingest_pmtiles(
    dataset_id: str,
    parquet_path: str,
    _storage: StorageService | None = None,
) -> tuple[str, int, int, int]:
    """Convert GeoParquet to PMTiles and upload to MinIO.

    Returns (tile_url, min_zoom, max_zoom, file_size_bytes).
    """
    storage = _storage or StorageService()
    # ... (all existing code unchanged until the upload call) ...

        storage.upload_pmtiles(pmtiles_path, dataset_id)
        min_zoom, max_zoom = _read_pmtiles_zoom_range(pmtiles_path)
        file_size = os.path.getsize(pmtiles_path)

    return get_pmtiles_tile_url(dataset_id), min_zoom, max_zoom, file_size
```

Note: `_read_pmtiles_zoom_range` is called INSIDE the `with tempfile.TemporaryDirectory()` block, before it's cleaned up.

- [ ] **Step 4: Run tests**

```bash
cd sandbox/ingestion && uv run pytest tests/test_pmtiles_ingest.py -v
```

Expected: all PASSED.

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/services/pmtiles_ingest.py sandbox/ingestion/tests/test_pmtiles_ingest.py
git commit -m "feat(backend): ingest_pmtiles returns zoom range and file size from PMTiles header"
```

---

### Task 4: Wire new fields into `run_pipeline`

**Files:**
- Modify: `sandbox/ingestion/src/services/pipeline.py`

- [ ] **Step 1: Update `run_pipeline` to capture and store all new fields**

In `sandbox/ingestion/src/services/pipeline.py`, update `run_pipeline` as follows.

After `job.status = JobStatus.SCANNING`, add:
```python
original_file_size = os.path.getsize(input_path)
```

Inside the `with tempfile.TemporaryDirectory() as tmpdir:` block, after validation passes, add extractions:

```python
# Raster converted_file_size: output_path IS the COG at this point
converted_file_size = os.path.getsize(output_path) if format_pair.dataset_type == DatasetType.RASTER else None

# Extract feature stats (vector only)
feature_count = None
geometry_types = None
if format_pair.dataset_type == DatasetType.VECTOR:
    feature_count, geometry_types = await asyncio.to_thread(
        _extract_feature_stats, output_path
    )

# Extract zoom range (vector PMTiles path sets these below via ingest_pmtiles)
min_zoom = None
max_zoom = None
```

Then update the `use_pmtiles` ingest branch to unpack the new return value including `converted_file_size`:

```python
if use_pmtiles:
    tile_url, min_zoom, max_zoom, converted_file_size = await asyncio.to_thread(
        pmtiles_ingest.ingest_pmtiles, job.dataset_id, output_path,
    )
else:
    tile_url = await asyncio.to_thread(
        vector_ingest.ingest_vector, job.dataset_id, output_path,
    )
    await _wait_for_tipg_collection(job.dataset_id)
```

For the raster path, add after `tile_url = await stac_ingest.ingest_raster(...)`:
```python
min_zoom, max_zoom = await asyncio.to_thread(
    _extract_zoom_range_raster, output_path
)
```

Finally, pass the new fields to `Dataset(...)`:
```python
dataset = Dataset(
    id=job.dataset_id,
    filename=job.filename,
    dataset_type=format_pair.dataset_type,
    format_pair=format_pair,
    tile_url=tile_url,
    bounds=bounds,
    band_count=band_count,
    original_file_size=original_file_size,
    converted_file_size=converted_file_size,
    feature_count=feature_count,
    geometry_types=geometry_types,
    min_zoom=min_zoom,
    max_zoom=max_zoom,
    stac_collection_id=f"sandbox-{job.dataset_id}" if format_pair.dataset_type == DatasetType.RASTER else None,
    pg_table=vector_ingest.build_table_name(job.dataset_id) if (
        format_pair.dataset_type == DatasetType.VECTOR and not use_pmtiles
    ) else None,
    validation_results=job.validation_results,
    credits=get_credits(format_pair, use_pmtiles=use_pmtiles),
    created_at=job.created_at,
)
```

- [ ] **Step 2: Run all backend tests**

```bash
cd sandbox/ingestion && uv run pytest -v
```

Expected: all PASSED.

- [ ] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/services/pipeline.py
git commit -m "feat(backend): wire file sizes, feature stats, and zoom range into pipeline"
```

---

## Chunk 2: Frontend — hook, component, and wiring

### Task 5: Extend TypeScript Dataset interface

**Files:**
- Modify: `sandbox/frontend/src/types.ts`

- [ ] **Step 1: Add new fields**

In `sandbox/frontend/src/types.ts`, add to the `Dataset` interface after `band_count`:

```typescript
original_file_size: number | null;
converted_file_size: number | null;
feature_count: number | null;
geometry_types: string[] | null;
min_zoom: number | null;
max_zoom: number | null;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd sandbox/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/src/types.ts
git commit -m "feat(frontend): add report card fields to Dataset type"
```

---

### Task 6: `useTileTransferSize` hook

**Files:**
- Create: `sandbox/frontend/src/hooks/useTileTransferSize.ts`
- Create: `sandbox/frontend/src/hooks/useTileTransferSize.test.ts`

- [ ] **Step 1: Write failing tests**

Create `sandbox/frontend/src/hooks/useTileTransferSize.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTileTransferSize } from "./useTileTransferSize";

function makeEntry(name: string, transferSize: number): PerformanceResourceTiming {
  return { name, transferSize, entryType: "resource" } as unknown as PerformanceResourceTiming;
}

describe("useTileTransferSize", () => {
  let observerCallback: PerformanceObserverCallback;
  let mockDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // jsdom sets window.location.origin to "http://localhost" by default.
    // Entry URLs in these tests use that prefix, so the hook's prefix filter works
    // without any explicit stub.
    mockDisconnect = vi.fn();
    vi.stubGlobal(
      "PerformanceObserver",
      vi.fn().mockImplementation((cb: PerformanceObserverCallback) => {
        observerCallback = cb;
        return { observe: vi.fn(), disconnect: mockDisconnect };
      })
    );
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when no matching entries exist yet", () => {
    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    expect(result.current).toBeNull();
  });

  it("sums transferSize for entries matching the prefix", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      makeEntry("http://localhost/pmtiles/datasets/abc/data.pmtiles", 1024),
      makeEntry("http://localhost/pmtiles/datasets/abc/data.pmtiles", 512),
      makeEntry("http://localhost/raster/tiles/0/0/0.png", 2048),
    ]);
    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    expect(result.current).toBe(1536);
  });

  it("updates when the observer fires with new entries", () => {
    vi.spyOn(performance, "getEntriesByType")
      .mockReturnValueOnce([makeEntry("http://localhost/pmtiles/x", 100)])
      .mockReturnValueOnce([
        makeEntry("http://localhost/pmtiles/x", 100),
        makeEntry("http://localhost/pmtiles/x", 200),
      ]);

    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    expect(result.current).toBe(100);

    act(() => {
      observerCallback({ getEntries: () => [] } as unknown as PerformanceObserverEntryList, {} as PerformanceObserver);
    });
    expect(result.current).toBe(300);
  });

  it("returns 0 (not null) when entries exist but all have transferSize 0 (Timing-Allow-Origin not set)", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      makeEntry("http://localhost/pmtiles/x", 0),
    ]);
    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    // entries exist but report 0 bytes → 0, not null (null = no entries at all)
    expect(result.current).toBe(0);
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = renderHook(() => useTileTransferSize("/pmtiles/"));
    unmount();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd sandbox/frontend && npx vitest run src/hooks/useTileTransferSize.test.ts
```

Expected: `Cannot find module './useTileTransferSize'`.

- [ ] **Step 3: Implement the hook**

Create `sandbox/frontend/src/hooks/useTileTransferSize.ts`:

```typescript
import { useState, useEffect } from "react";

/**
 * Accumulates tile bytes fetched since mount by observing PerformanceResourceTiming
 * entries whose URL starts with the given prefix.
 *
 * Returns:
 *   null  — no matching tile requests have been made yet (normal on page load)
 *   0     — tile requests exist but all report transferSize=0 (Timing-Allow-Origin not set)
 *   > 0   — bytes fetched so far
 */
export function useTileTransferSize(tileUrlPrefix: string): number | null {
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    const prefix = window.location.origin + tileUrlPrefix;

    const getTotal = (): number | null => {
      const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
        .filter((e) => e.name.startsWith(prefix));
      if (entries.length === 0) return null;  // no tile requests yet
      return entries.reduce((sum, e) => sum + e.transferSize, 0);
    };

    setBytes(getTotal());

    const observer = new PerformanceObserver(() => {
      setBytes(getTotal());
    });
    observer.observe({ type: "resource", buffered: true });

    return () => observer.disconnect();
  }, [tileUrlPrefix]);

  return bytes;
}
```

- [ ] **Step 4: Run tests**

```bash
cd sandbox/frontend && npx vitest run src/hooks/useTileTransferSize.test.ts
```

Expected: all PASSED.

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/hooks/useTileTransferSize.ts sandbox/frontend/src/hooks/useTileTransferSize.test.ts
git commit -m "feat(frontend): add useTileTransferSize hook"
```

---

### Task 7: ReportCard component

**Files:**
- Create: `sandbox/frontend/src/components/ReportCard.tsx`

The component is self-contained. It imports `useTileTransferSize`, reads `dataset` props, and renders the drawer.

- [ ] **Step 1: Create `ReportCard.tsx`**

Create `sandbox/frontend/src/components/ReportCard.tsx`:

```typescript
import { Box, Flex, Text, Tooltip } from "@chakra-ui/react";
import type { Dataset } from "../types";
import { useTileTransferSize } from "../hooks/useTileTransferSize";

interface ReportCardProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
}

// --- Formatting helpers ---

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDownloadTime(bytes: number): string {
  const seconds = bytes / 1_500_000;
  if (seconds < 60) return `~${Math.ceil(seconds)} sec`;
  return `~${Math.ceil(seconds / 60)} min`;
}

function formatGeometryLabel(types: string[]): string {
  // types is pre-sorted by frequency (most common first) by the backend
  if (types.length === 0) return "features";
  return types.slice(0, 2).join(" / ") + " features";
}

function getTileUrlPrefix(tileUrl: string): string {
  // "/pmtiles/datasets/..." → "/pmtiles/"
  // "/raster/..." → "/raster/"
  const parts = tileUrl.split("/");
  return "/" + parts[1] + "/";
}

// --- Transformation bar ---

function getTransformationSteps(dataset: Dataset): { from: string; steps: string; to: string } {
  const isPmtiles = dataset.tile_url.startsWith("/pmtiles/");
  switch (dataset.format_pair) {
    case "geotiff-to-cog":
      return { from: ".tif  GeoTIFF", steps: "rio-cogeo", to: ".tif  COG" };
    case "netcdf-to-cog":
      return { from: ".nc  NetCDF", steps: "xarray → rio-cogeo", to: ".tif  COG" };
    case "shapefile-to-geoparquet":
      return isPmtiles
        ? { from: ".shp  Shapefile", steps: "GeoPandas → tippecanoe", to: ".pmtiles  PMTiles" }
        : { from: ".shp  Shapefile", steps: "GeoPandas → PostGIS", to: "MVT  tiles via tipg" };
    case "geojson-to-geoparquet":
      return isPmtiles
        ? { from: ".geojson  GeoJSON", steps: "GeoPandas → tippecanoe", to: ".pmtiles  PMTiles" }
        : { from: ".geojson  GeoJSON", steps: "GeoPandas → PostGIS", to: "MVT  tiles via tipg" };
    default:
      return { from: dataset.format_pair, steps: "→", to: "cloud-native" };
  }
}

// --- Null-safe display helper ---

// Chakra v3 uses compound Tooltip API (Tooltip.Root / Tooltip.Trigger / Tooltip.Content)
function NullStat({ message = "Not available for datasets converted before this feature launched" }: { message?: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Text as="span" color="brand.textSecondary" fontSize="12px" cursor="default">—</Text>
      </Tooltip.Trigger>
      <Tooltip.Content>{message}</Tooltip.Content>
    </Tooltip.Root>
  );
}

// --- Stat Cards ---

function FileSizeCard({ dataset }: { dataset: Dataset }) {
  const orig = dataset.original_file_size;
  const conv = dataset.converted_file_size;
  const pct = orig && conv ? Math.round((1 - conv / orig) * 100) : null;
  const hasFeatures = dataset.feature_count !== null && dataset.geometry_types !== null;

  return (
    <Box bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border" p={4}>
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3}>
        File size
      </Text>
      {orig !== null && conv !== null ? (
        <>
          <Box mb={2}>
            <Flex justify="space-between" fontSize="11px" color="brand.textSecondary" mb={1}>
              <span>Original</span><span>{formatBytes(orig)}</span>
            </Flex>
            <Box h="6px" bg="brand.bgSubtle" borderRadius="3px">
              <Box h="100%" w="100%" bg="#d4cfc9" borderRadius="3px" />
            </Box>
          </Box>
          <Box mb={3}>
            <Flex justify="space-between" fontSize="11px" color="brand.orange" mb={1} fontWeight={600}>
              <span>Converted</span><span>{formatBytes(conv)}</span>
            </Flex>
            <Box h="6px" bg="#fde8d8" borderRadius="3px">
              <Box h="100%" w={`${Math.max(1, (conv / orig) * 100)}%`} bg="brand.orange" borderRadius="3px" />
            </Box>
          </Box>
          {pct !== null && pct > 0 && (
            <Text fontSize="13px" fontWeight={700} color="brand.brown">{pct}% smaller</Text>
          )}
        </>
      ) : (
        <NullStat />
      )}
      {hasFeatures && (
        <Box borderTop="1px solid" borderColor="brand.border" pt={3} mt={3}>
          <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={1}>
            {formatGeometryLabel(dataset.geometry_types!)}
          </Text>
          <Text fontSize="13px" fontWeight={700} color="brand.brown">
            {dataset.feature_count!.toLocaleString()}{" "}
            <Text as="span" color="brand.success" fontWeight={400} fontSize="12px">✓ all preserved</Text>
          </Text>
          <Text fontSize="11px" color="brand.textSecondary" mt={1}>Attributes, geometry, and CRS intact</Text>
        </Box>
      )}
    </Box>
  );
}

function DataFetchedCard({ dataset, tileUrlPrefix }: { dataset: Dataset; tileUrlPrefix: string }) {
  const fetched = useTileTransferSize(tileUrlPrefix);
  const conv = dataset.converted_file_size;
  const isRaster = dataset.dataset_type === "raster";
  // null = no tile requests yet (show 0 B + Live badge, will update as tiles load)
  // 0    = requests made but transferSize is 0 (Timing-Allow-Origin not set)
  // >0   = working correctly
  const displayBytes = fetched ?? 0;
  const unavailable = fetched === 0;  // entries exist but transferSize is 0

  return (
    <Box bg="white" borderRadius="8px" border="2px solid" borderColor="brand.orange" p={4} position="relative">
      {!unavailable && (
        <Box
          position="absolute" top="-10px" left="14px"
          bg="brand.orange" color="white"
          fontSize="10px" fontWeight={700} textTransform="uppercase" letterSpacing="1px"
          px={2} py="2px" borderRadius="10px"
        >
          Live
        </Box>
      )}
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3} mt={1}>
        Data fetched since page load
      </Text>
      {unavailable ? (
        <NullStat message="Byte tracking requires server configuration — contact your admin." />
      ) : (
        <>
          <Text fontSize="28px" fontWeight={700} color="brand.orange" mb={1}>
            {formatBytes(displayBytes)}
          </Text>
          <Text fontSize="12px" color="brand.textSecondary" mb={3}>loaded so far</Text>
          {conv !== null && (
            <Box bg="brand.bgSubtle" borderRadius="6px" p={3}>
              <Flex justify="space-between" mb={1}>
                <Text fontSize="11px" color="brand.textSecondary">Full file</Text>
                <Text fontSize="11px" fontWeight={600} color="brand.textSecondary">{formatBytes(conv)}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text fontSize="11px" color="brand.orange" fontWeight={600}>Fetched</Text>
                <Text fontSize="11px" fontWeight={700} color="brand.orange">{formatBytes(displayBytes)}</Text>
              </Flex>
            </Box>
          )}
          <Text fontSize="11px" color="brand.textSecondary" mt={3}>
            {isRaster
              ? "Only the tiles you look at are rendered and fetched."
              : "Only the tiles you look at are ever fetched — pan or zoom to see this grow."}
          </Text>
        </>
      )}
    </Box>
  );
}

function ShareCard({ dataset }: { dataset: Dataset }) {
  const orig = dataset.original_file_size;
  return (
    <Box bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border" p={4}>
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3}>
        To share this map
      </Text>
      <Box mb={3} pb={3} borderBottom="1px solid" borderColor="brand.border">
        <Text fontSize="11px" color="brand.textSecondary" mb={2}>Before</Text>
        {orig !== null ? (
          <Text fontSize="12px" color="brand.textSecondary" lineHeight="1.6">
            Email a {formatBytes(orig)} file.<br />
            <Text as="span" color="red.500" fontWeight={600}>{formatDownloadTime(orig)} to download on 4G (est.)</Text><br />
            Recipient needs ArcGIS or QGIS to open it.
          </Text>
        ) : (
          <NullStat />
        )}
      </Box>
      <Box>
        <Text fontSize="11px" color="brand.orange" fontWeight={600} mb={2}>Now</Text>
        <Text fontSize="12px" color="brand.brown" fontWeight={600} lineHeight="1.6">
          Send a URL.<br />
          <Text as="span" color="brand.success">Opens in any browser.</Text><br />
          No software required.<br />
          No proprietary license.
        </Text>
      </Box>
    </Box>
  );
}

function CapabilitiesCard({ dataset }: { dataset: Dataset }) {
  const isVector = dataset.dataset_type === "vector";
  const items = [
    "Shareable URL — anyone can view",
    "Zoom to any scale, no pixelation",
    isVector ? "Click features to inspect attributes" : "Click pixels to inspect values",
    "Embed in any webpage",
    "No proprietary license or specialized GIS server required",
  ];
  return (
    <Box bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border" p={4}>
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3}>
        Now possible
      </Text>
      <Flex direction="column" gap={2} mb={3}>
        {items.map((item) => (
          <Flex key={item} gap={2} align="flex-start">
            <Text color="brand.success" fontWeight={700} fontSize="12px">✓</Text>
            <Text fontSize="12px" color="brand.brown">{item}</Text>
          </Flex>
        ))}
      </Flex>
      {dataset.min_zoom !== null && dataset.max_zoom !== null && (
        <Box borderTop="1px solid" borderColor="brand.border" pt={3}>
          <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={1}>
            Zoom range
          </Text>
          <Text fontSize="13px" fontWeight={700} color="brand.brown">
            z{dataset.min_zoom}–z{dataset.max_zoom}{" "}
            <Text as="span" fontWeight={400} color="brand.textSecondary" fontSize="11px">auto-selected</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
}

// --- Main component ---

export function ReportCard({ dataset, isOpen, onClose }: ReportCardProps) {
  const tileUrlPrefix = getTileUrlPrefix(dataset.tile_url);
  const { from, steps, to } = getTransformationSteps(dataset);

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={100}
      bg="brand.bgSubtle"
      borderTop="1px solid"
      borderColor="brand.border"
      maxH="70vh"
      overflowY="auto"
      boxShadow="0 -4px 24px rgba(0,0,0,0.10)"
    >
      <Box maxW="1400px" mx="auto" px={8} py={6}>
        {/* Header */}
        <Flex justify="space-between" align="flex-start" mb={6}>
          <Box>
            <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={1}>
              Your data, transformed
            </Text>
            <Text fontSize="18px" fontWeight={700} color="brand.brown">{dataset.filename}</Text>
          </Box>
          <Text
            fontSize="20px" color="brand.textSecondary" cursor="pointer" lineHeight="1"
            onClick={onClose} aria-label="Close report card"
            _hover={{ color: "brand.brown" }}
          >
            ✕
          </Text>
        </Flex>

        {/* Transformation bar */}
        <Flex
          align="center" gap={3} mb={6} p={4}
          bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border"
        >
          <Box textAlign="center" minW="120px">
            <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" mb={1}>Was</Text>
            <Box bg="brand.bgSubtle" borderRadius="4px" px={3} py={1} display="inline-block">
              <Text fontSize="13px" fontWeight={700} color="brand.textSecondary">{from}</Text>
            </Box>
          </Box>
          <Box flex={1} display="flex" alignItems="center" gap={2}>
            <Box flex={1} h="2px" bgGradient="to-r" gradientFrom="brand.border" gradientTo="brand.orange" />
            <Text fontSize="11px" color="brand.orange" fontWeight={600} whiteSpace="nowrap">→ {steps} →</Text>
            <Box flex={1} h="2px" bg="brand.orange" />
          </Box>
          <Box textAlign="center" minW="120px">
            <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" mb={1}>Is now</Text>
            <Box bg="brand.orange" borderRadius="4px" px={3} py={1} display="inline-block">
              <Text fontSize="13px" fontWeight={700} color="white">{to}</Text>
            </Box>
          </Box>
        </Flex>

        {/* Stat cards */}
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap={4}
          mb={6}
        >
          <FileSizeCard dataset={dataset} />
          <DataFetchedCard dataset={dataset} tileUrlPrefix={tileUrlPrefix} />
          <ShareCard dataset={dataset} />
          <CapabilitiesCard dataset={dataset} />
        </Box>

        {/* Footer */}
        <Text fontSize="12px" color="brand.textSecondary" textAlign="center">
          Converted using open source tools maintained by Development Seed and the community.
        </Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd sandbox/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/src/components/ReportCard.tsx
git commit -m "feat(frontend): add ReportCard drawer component"
```

---

### Task 8: Wire into MapPage

**Files:**
- Modify: `sandbox/frontend/src/pages/MapPage.tsx`

- [ ] **Step 1: Update MapPage**

In `sandbox/frontend/src/pages/MapPage.tsx`:

1. Add import at the top (do not add a duplicate `useState` — it is already imported; only add the `ReportCard` import):
```typescript
import { ReportCard } from "../components/ReportCard";
```

2. Add state inside the component (after the existing state declarations):
```typescript
const [reportCardOpen, setReportCardOpen] = useState(false);
```

3. Add the "See what changed" button to the header (after `<ShareButton />`):
```typescript
{/* Gate on tile_url: the dataset record exists as soon as the job starts,
    but tile_url is only set after conversion completes. Hiding the button
    until then avoids opening an incomplete report card mid-processing. */}
{dataset.tile_url && (
  <Button
    variant="ghost"
    color="brand.orange"
    size="sm"
    fontWeight={600}
    borderRadius="4px"
    onClick={() => setReportCardOpen(true)}
  >
    See what changed →
  </Button>
)}
```

4. Add `<ReportCard>` at the end, just before the closing `</Box>` of the root element:
```typescript
<ReportCard
  dataset={dataset}
  isOpen={reportCardOpen}
  onClose={() => setReportCardOpen(false)}
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd sandbox/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all frontend tests**

```bash
cd sandbox/frontend && npx vitest run
```

Expected: all PASSED.

- [ ] **Step 4: Commit**

```bash
git add sandbox/frontend/src/pages/MapPage.tsx
git commit -m "feat(frontend): wire ReportCard drawer into MapPage"
```

---

## Smoke test

After all tasks complete, verify the full stack works end-to-end:

- [ ] Build the library and start the sandbox:

```bash
npm run build && docker compose -f sandbox/docker-compose.yml up -d --build
```

- [ ] Upload a Shapefile or GeoJSON at `http://localhost:5185`
- [ ] After conversion completes, click "See what changed →" in the header
- [ ] Verify the drawer shows: file size bar, feature count, data-fetched stat, portability cards, zoom range
- [ ] Pan/zoom the map, close and reopen the drawer — verify "Data fetched" has increased
- [ ] Upload a GeoTIFF — verify the drawer hides the feature count section and shows raster-appropriate copy
