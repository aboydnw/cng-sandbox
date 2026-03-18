# Band Metadata Detection & Band Selector Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract band metadata (names, color interpretation, dtype) from raster datasets and surface it in the frontend with an adaptive band selector for multi-band datasets.

**Architecture:** Backend extracts band metadata via rasterio during the existing post-conversion step and stores it on the Dataset model. Frontend adapts the map controls panel based on band count and color interpretation — single-band shows colormap, multi-band shows band selector with optional single-band + colormap mode via titiler's `bidx` parameter.

**Tech Stack:** Python/rasterio (backend), React/TypeScript/Chakra UI (frontend), titiler-pgstac `bidx` query param

**Spec:** `docs/superpowers/specs/2026-03-17-band-metadata-design.md`

---

## Chunk 1: Backend — Band metadata extraction

### Task 1: Add band metadata fields to Dataset model

**Files:**
- Modify: `sandbox/ingestion/src/models.py:79-102`

- [ ] **Step 1: Add fields to Dataset model**

Add three new optional fields after `band_count` (line 86):

```python
band_names: list[str] | None = None        # raster only; from src.descriptions
color_interpretation: list[str] | None = None  # raster only; from src.colorinterp
dtype: str | None = None                    # raster only; from src.dtypes[0]
```

- [ ] **Step 2: Run existing tests to verify no breakage**

Run: `cd sandbox/ingestion && uv run pytest tests/test_models.py tests/test_pipeline.py -v`
Expected: All existing tests pass (new fields are optional with None defaults).

- [ ] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/models.py
git commit -m "feat(models): add band_names, color_interpretation, dtype to Dataset"
```

### Task 2: Extract band metadata in pipeline

**Files:**
- Modify: `sandbox/ingestion/src/services/pipeline.py:64-68,173-176,225-247`
- Test: `sandbox/ingestion/tests/test_pipeline.py`

- [ ] **Step 1: Write test for _extract_band_metadata**

Add to `sandbox/ingestion/tests/test_pipeline.py`:

```python
import numpy as np
import rasterio
from rasterio.transform import from_bounds

from src.services.pipeline import _extract_band_metadata


@pytest.fixture
def single_band_tif(tmp_path):
    path = str(tmp_path / "single.tif")
    data = np.random.rand(64, 64).astype("float32")
    transform = from_bounds(-180, -90, 180, 90, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64,
        count=1, dtype="float32", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data, 1)
        dst.set_band_description(1, "Precipitation")
    return path


@pytest.fixture
def rgb_tif(tmp_path):
    path = str(tmp_path / "rgb.tif")
    data = np.random.randint(0, 255, (3, 64, 64), dtype="uint8")
    transform = from_bounds(-180, -90, 180, 90, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64,
        count=3, dtype="uint8", crs="EPSG:4326", transform=transform,
        photometric="RGB",
    ) as dst:
        dst.write(data)
    return path


@pytest.fixture
def no_description_tif(tmp_path):
    path = str(tmp_path / "nodesc.tif")
    data = np.random.rand(2, 64, 64).astype("float32")
    transform = from_bounds(-180, -90, 180, 90, 64, 64)
    with rasterio.open(
        path, "w", driver="GTiff", width=64, height=64,
        count=2, dtype="float32", crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(data)
    return path


def test_extract_band_metadata_single_band(single_band_tif):
    meta = _extract_band_metadata(single_band_tif)
    assert meta.band_count == 1
    assert meta.band_names == ["Precipitation"]
    assert meta.dtype == "float32"
    assert len(meta.color_interpretation) == 1


def test_extract_band_metadata_rgb(rgb_tif):
    meta = _extract_band_metadata(rgb_tif)
    assert meta.band_count == 3
    assert meta.color_interpretation == ["red", "green", "blue"]
    assert meta.dtype == "uint8"


def test_extract_band_metadata_fallback_names(no_description_tif):
    meta = _extract_band_metadata(no_description_tif)
    assert meta.band_count == 2
    assert meta.band_names == ["Band 1", "Band 2"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sandbox/ingestion && uv run pytest tests/test_pipeline.py::test_extract_band_metadata_single_band -v`
Expected: FAIL with `cannot import name '_extract_band_metadata'`

- [ ] **Step 3: Implement _extract_band_metadata**

In `sandbox/ingestion/src/services/pipeline.py`, replace `_extract_band_count` (lines 64-68) with:

```python
from dataclasses import dataclass


@dataclass
class BandMetadata:
    band_count: int
    band_names: list[str]
    color_interpretation: list[str]
    dtype: str


def _extract_band_metadata(output_path: str) -> BandMetadata:
    """Extract band count, names, color interpretation, and dtype from a raster."""
    import rasterio
    with rasterio.open(output_path) as src:
        band_names = [
            desc if desc else f"Band {i + 1}"
            for i, desc in enumerate(src.descriptions)
        ]
        color_interp = [ci.name for ci in src.colorinterp]
        return BandMetadata(
            band_count=src.count,
            band_names=band_names,
            color_interpretation=color_interp,
            dtype=str(src.dtypes[0]),
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sandbox/ingestion && uv run pytest tests/test_pipeline.py -v -k band_metadata`
Expected: All 3 tests pass.

- [ ] **Step 5: Wire _extract_band_metadata into the main pipeline**

In `sandbox/ingestion/src/services/pipeline.py`, update the pipeline (around lines 173-176) to replace `_extract_band_count` usage:

```python
# Replace:
band_count = None
if format_pair.dataset_type == DatasetType.RASTER:
    band_count = await asyncio.to_thread(_extract_band_count, output_path)

# With:
band_meta = None
if format_pair.dataset_type == DatasetType.RASTER:
    band_meta = await asyncio.to_thread(_extract_band_metadata, output_path)
```

Then update the Dataset constructor (around line 225) to use the new metadata:

```python
band_count=band_meta.band_count if band_meta else None,
band_names=band_meta.band_names if band_meta else None,
color_interpretation=band_meta.color_interpretation if band_meta else None,
dtype=band_meta.dtype if band_meta else None,
```

- [ ] **Step 6: Run all pipeline tests**

Run: `cd sandbox/ingestion && uv run pytest tests/test_pipeline.py -v`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add sandbox/ingestion/src/services/pipeline.py sandbox/ingestion/tests/test_pipeline.py
git commit -m "feat(pipeline): extract band metadata (names, color interp, dtype)"
```

### Task 3: Wire band metadata into temporal pipeline

**Files:**
- Modify: `sandbox/ingestion/src/services/temporal_pipeline.py:119,155-175`

- [ ] **Step 1: Update temporal pipeline to use _extract_band_metadata**

In `sandbox/ingestion/src/services/temporal_pipeline.py`:

1. Update the import: replace `_extract_band_count` with `_extract_band_metadata` in the import from `pipeline.py`.

2. Replace the `_extract_band_count` call (around line 119):
```python
# Replace:
band_count = await asyncio.to_thread(_extract_band_count, first_cog)

# With:
band_meta = await asyncio.to_thread(_extract_band_metadata, first_cog)
```

3. Update the Dataset constructor (around line 155) to pass the new fields:
```python
band_count=band_meta.band_count,
band_names=band_meta.band_names,
color_interpretation=band_meta.color_interpretation,
dtype=band_meta.dtype,
```

- [ ] **Step 2: Run existing temporal tests**

Run: `cd sandbox/ingestion && uv run pytest tests/ -v -k temporal`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add sandbox/ingestion/src/services/temporal_pipeline.py
git commit -m "feat(temporal): pass band metadata to Dataset constructor"
```

### Task 4: Add advisory band metadata check to validation skill

**Files:**
- Modify: `skills/geo-conversions/geotiff-to-cog/scripts/validate.py`

- [ ] **Step 1: Add check_band_metadata function**

Add after `check_band_count` (around line 82):

```python
def check_band_metadata(input_path: str, output_path: str) -> CheckResult:
    """Advisory: report band descriptions and color interpretation."""
    with rasterio.open(output_path) as dst:
        names = [d if d else f"Band {i+1}" for i, d in enumerate(dst.descriptions)]
        interp = [ci.name for ci in dst.colorinterp]
        detail = f"{dst.count} band(s): {', '.join(names)} | color interp: {', '.join(interp)} | dtype: {dst.dtypes[0]}"
        return CheckResult("Band metadata", True, detail)
```

- [ ] **Step 2: Add it to run_checks**

Find the `run_checks` function and add `check_band_metadata` to the list of checks. It's advisory (always passes), so ordering doesn't matter.

- [ ] **Step 3: Commit**

```bash
git add skills/geo-conversions/geotiff-to-cog/scripts/validate.py
git commit -m "feat(skill): add advisory band metadata check to geotiff-to-cog"
```

---

## Chunk 2: Frontend — Types, CreditsPanel, and RasterMap band selector

### Task 5: Add band metadata fields to frontend Dataset type

**Files:**
- Modify: `sandbox/frontend/src/types.ts:29-53`

- [ ] **Step 1: Add fields to Dataset interface**

Add after `band_count` (line 36):

```typescript
band_names: string[] | null;
color_interpretation: string[] | null;
dtype: string | null;
```

- [ ] **Step 2: Update test fixtures**

Update the `rasterDataset` fixture in `sandbox/frontend/tests/CreditsPanel.test.tsx` and any other test files that define a `Dataset` object. Add the three new fields with appropriate values:

For the existing `rasterDataset` (single-band):
```typescript
band_names: ["Precipitation"],
color_interpretation: ["gray"],
dtype: "float32",
```

Also check and update `sandbox/frontend/tests/RasterMap.test.tsx` if it has a Dataset fixture.

- [ ] **Step 3: Run frontend tests**

Run: `cd sandbox/frontend && npx vitest run`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add sandbox/frontend/src/types.ts sandbox/frontend/tests/
git commit -m "feat(frontend): add band metadata fields to Dataset type"
```

### Task 6: Add raster metadata section to CreditsPanel

**Files:**
- Modify: `sandbox/frontend/src/components/CreditsPanel.tsx:82-105`
- Test: `sandbox/frontend/tests/CreditsPanel.test.tsx`

- [ ] **Step 1: Write tests for raster metadata display**

Add to `sandbox/frontend/tests/CreditsPanel.test.tsx`:

```typescript
const rgbDataset: Dataset = {
  ...rasterDataset,
  band_count: 3,
  band_names: ["Red", "Green", "Blue"],
  color_interpretation: ["red", "green", "blue"],
  dtype: "uint8",
};

it("shows raster metadata for single-band dataset", () => {
  renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
  expect(screen.getByText(/single-band/i)).toBeTruthy();
  expect(screen.getByText(/float32/i)).toBeTruthy();
});

it("shows RGB label for 3-band RGB dataset", () => {
  renderWithProviders(<CreditsPanel dataset={rgbDataset} />);
  expect(screen.getByText(/3-band rgb/i)).toBeTruthy();
});

it("does not show raster section for vector dataset", () => {
  const vectorDataset: Dataset = {
    ...rasterDataset,
    dataset_type: "vector",
    band_count: null,
    band_names: null,
    color_interpretation: null,
    dtype: null,
  };
  renderWithProviders(<CreditsPanel dataset={vectorDataset} />);
  expect(screen.queryByText(/band/i)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sandbox/frontend && npx vitest run tests/CreditsPanel.test.tsx`
Expected: FAIL — "single-band" text not found.

- [ ] **Step 3: Implement raster metadata section**

In `sandbox/frontend/src/components/CreditsPanel.tsx`, add a helper function and a new section before the Temporal section (around line 82):

```typescript
function formatBandLabel(dataset: Dataset): string | null {
  if (dataset.dataset_type !== "raster" || dataset.band_count == null) return null;
  const ci = dataset.color_interpretation ?? [];
  const isRgb = ci.length >= 3 && ci[0] === "red" && ci[1] === "green" && ci[2] === "blue";

  if (dataset.band_count === 1) {
    return `Single-band ${dataset.dtype ?? ""}`.trim();
  }
  if (isRgb && dataset.band_count === 3) {
    return "3-band RGB";
  }
  if (isRgb) {
    const extra = (dataset.band_names ?? []).slice(3).join(", ");
    return `${dataset.band_count}-band RGB${extra ? ` + ${extra}` : ""}`;
  }
  return `${dataset.band_count}-band`;
}
```

Then add the section in the JSX:

```tsx
{dataset.dataset_type === "raster" && dataset.band_count != null && (
  <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
    <Text
      fontSize="11px"
      textTransform="uppercase"
      letterSpacing="1px"
      color="brand.textSecondary"
      fontWeight={600}
      mb={2}
    >
      Raster
    </Text>
    <Text color="brand.brown" fontSize="13px" fontWeight={600}>
      {formatBandLabel(dataset)}
    </Text>
  </Box>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sandbox/frontend && npx vitest run tests/CreditsPanel.test.tsx`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/src/components/CreditsPanel.tsx sandbox/frontend/tests/CreditsPanel.test.tsx
git commit -m "feat(CreditsPanel): show raster band metadata section"
```

### Task 7: Add band selector and bidx URL support to RasterMap

**Files:**
- Modify: `sandbox/frontend/src/components/RasterMap.tsx`

This is the core frontend change. The component needs new state for the selected band, and the `tileUrl` memo needs a third case for `bidx`.

- [ ] **Step 1: Add band selector state and derive helper values**

Add new state after `colormapName` (line 32):

```typescript
// "rgb" means show default composite; a number means show that band (0-indexed)
const [selectedBand, setSelectedBand] = useState<"rgb" | number>("rgb");
```

Add derived values after `isSingleBand` (line 34):

```typescript
const isMultiBand = (dataset.band_count ?? 0) > 1;
const ci = dataset.color_interpretation ?? [];
const hasRgb = ci.length >= 3 && ci[0] === "red" && ci[1] === "green" && ci[2] === "blue";

// Bands available for individual selection (exclude alpha)
const selectableBands = (dataset.band_names ?? [])
  .map((name, i) => ({ name, index: i }))
  .filter((_, i) => ci[i] !== "alpha");

// For non-RGB multi-band, default to band 0 instead of "rgb"
const effectiveBand = isMultiBand && !hasRgb && selectedBand === "rgb" ? 0 : selectedBand;

// Whether we're showing a single band (with colormap) vs composite
const showingColormap = isSingleBand || (isMultiBand && effectiveBand !== "rgb");
```

- [ ] **Step 2: Update tileUrl memo to handle bidx**

Replace the existing `tileUrl` memo (lines 36-45):

```typescript
const tileUrl = useMemo(() => {
  const base = dataset.tile_url;
  const separator = base.includes("?") ? "&" : "?";

  if (isSingleBand) {
    // Single-band: always apply colormap
    let url = `${base}${separator}colormap_name=${colormapName}`;
    if (dataset.is_temporal && dataset.raster_min != null && dataset.raster_max != null) {
      url += `&rescale=${dataset.raster_min},${dataset.raster_max}`;
    }
    return url;
  }

  if (isMultiBand && typeof effectiveBand === "number") {
    // Multi-band, specific band selected: bidx is 1-indexed
    return `${base}${separator}bidx=${effectiveBand + 1}&colormap_name=${colormapName}`;
  }

  // Multi-band RGB composite: no colormap, no bidx
  return base;
}, [dataset, colormapName, isSingleBand, isMultiBand, effectiveBand]);
```

- [ ] **Step 3: Update layer ID to include band selection**

Update the layer memo to include `effectiveBand` in the ID for cache busting:

```typescript
const layer = useMemo(() => {
  return createCOGLayer({
    id: `raster-layer-${colormapName}-${effectiveBand}`,
    tileUrl: effectiveTileUrl,
    opacity,
  });
}, [effectiveTileUrl, opacity, colormapName, effectiveBand]);
```

- [ ] **Step 4: Update controls panel — replace conditional colormap with band selector + colormap**

Replace the controls `<Flex>` block (lines 160-203) with:

```tsx
<Flex
  position="absolute"
  bottom={3}
  right={3}
  bg="white"
  borderRadius="6px"
  shadow="sm"
  p={2}
  direction="column"
  gap={2}
>
  {isMultiBand && (
    <Box>
      <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
        Band
      </Text>
      <NativeSelect.Root size="xs">
        <NativeSelect.Field
          value={String(effectiveBand)}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const val = e.target.value;
            setSelectedBand(val === "rgb" ? "rgb" : Number(val));
          }}
        >
          {hasRgb && <option value="rgb">RGB</option>}
          {selectableBands.map((b) => (
            <option key={b.index} value={String(b.index)}>{b.name}</option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Box>
  )}
  {showingColormap && (
    <Box>
      <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
        Colormap
      </Text>
      <NativeSelect.Root size="xs">
        <NativeSelect.Field
          value={colormapName}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setColormapName(e.target.value)}
        >
          {COLORMAP_NAMES.map((cm) => (
            <option key={cm} value={cm}>{cm}</option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Box>
  )}
  <Box>
    <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
      Opacity
    </Text>
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={opacity}
      onChange={(e) => setOpacity(Number(e.target.value))}
      style={{ width: 80, accentColor: "#CF3F02" }}
    />
  </Box>
</Flex>
```

- [ ] **Step 5: Update legend visibility**

Replace the legend conditional (lines 146-158):

```tsx
{showingColormap && (
  <Box position="absolute" bottom={3} left={3}>
    <MapLegend
      layers={[{
        type: "continuous" as const,
        id: "raster",
        title: dataset.filename,
        domain,
        colors,
      }]}
    />
  </Box>
)}
```

- [ ] **Step 6: Run frontend tests and type check**

Run: `cd sandbox/frontend && npx vitest run && cd ../.. && npm run lint`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add sandbox/frontend/src/components/RasterMap.tsx
git commit -m "feat(RasterMap): band selector with bidx URL support for multi-band datasets"
```

### Task 8: Build, deploy, and verify with screenshots

**Files:** None (integration verification)

- [ ] **Step 1: Build the library and rebuild Docker containers**

```bash
npm run build
docker compose -f sandbox/docker-compose.yml build frontend ingestion
docker compose -f sandbox/docker-compose.yml up -d frontend ingestion
```

- [ ] **Step 2: Upload a test raster and verify band metadata in CreditsPanel**

Navigate to the sandbox, upload a file. Verify that:
- Single-band: Shows "Single-band float32" in CreditsPanel, colormap selector visible, legend visible
- Multi-band RGB: Shows "3-band RGB" in CreditsPanel, band selector visible with "RGB" default, no colormap/legend when RGB selected

- [ ] **Step 3: Test band selector on multi-band dataset**

For the NE1_HR_LC.tif (3-band RGB) dataset:
- Verify "RGB" is the default selection — map shows normal RGB colors
- Switch to "Red" band — verify tiles reload with viridis colormap applied, legend appears
- Switch colormap to "magma" — verify tiles reload with new colormap
- Switch back to "RGB" — verify colormap selector and legend hide, tiles show RGB composite

- [ ] **Step 4: Take screenshots for verification**

Take screenshots of both single-band and multi-band views to verify.

- [ ] **Step 5: Commit any final fixes**

If any issues found during verification, fix and commit.
