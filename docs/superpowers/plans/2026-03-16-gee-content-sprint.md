# GEE Content Sprint Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Position the CNG Sandbox for GEE users ahead of the April 27, 2026 quota tier rollout — adding GEE-origin detection, a 2 GB file size limit, contextual callouts in the credits panel and expiry page, a "Coming from GEE?" link on the upload page, and a new `/from-gee` landing page.

**Architecture:** Backend detects GEE-origin from filename patterns and stores a `gee_origin` boolean on the Dataset model. The frontend reads this flag to conditionally render GEE-specific callouts in the credits panel and expiry page. The `/from-gee` route is a new static React page registered in the router.

**Tech Stack:** Python/FastAPI (backend), React 19/TypeScript/Chakra UI v3 (frontend), Vitest (frontend tests), pytest/uv (backend tests)

**Spec:** `docs/superpowers/specs/2026-03-16-gee-positioning-design.md`

**Note:** This plan covers the Content Sprint only. The v1.75 "Catalog Your Exports" milestone is a separate plan, blocked on v1.5 (temporal stacks) shipping first.

---

## File Map

### Created
- `sandbox/frontend/src/pages/FromGeePage.tsx` — new `/from-gee` landing page component

### Modified
- `sandbox/ingestion/src/config.py` — raise `max_upload_bytes` default to 2 GB
- `sandbox/ingestion/src/routes/upload.py` — update oversized-file error message
- `sandbox/ingestion/src/services/detector.py` — add `detect_gee_origin(filename)` function
- `sandbox/ingestion/src/models.py` — add `gee_origin: bool = False` to `Dataset`
- `sandbox/ingestion/src/services/pipeline.py` — call `detect_gee_origin` and set on Dataset
- `sandbox/frontend/src/types.ts` — add `gee_origin?: boolean` to `Dataset` interface
- `sandbox/frontend/src/App.tsx` — add `/from-gee` route
- `sandbox/frontend/src/components/CreditsPanel.tsx` — add "Coming from GEE?" section
- `sandbox/frontend/src/pages/MapPage.tsx` — pass `gee_origin` state when navigating to `/expired/:id`
- `sandbox/frontend/src/pages/ExpiredPage.tsx` — show conditional GEE copy from router state
- `sandbox/frontend/src/pages/UploadPage.tsx` — add "Coming from GEE?" callout below FileUploader

### Test files (existing, to be extended)
- `sandbox/ingestion/tests/test_detector.py` — add GEE detection tests
- `sandbox/ingestion/tests/test_models.py` — add `gee_origin` field test
- `sandbox/frontend/tests/CreditsPanel.test.tsx` — add GEE callout tests
- `sandbox/frontend/src/components/ReportCard.test.tsx` *(not modified)*

### Test files (new)
- `sandbox/frontend/tests/ExpiredPage.test.tsx` — test GEE copy conditional on router state
- `sandbox/frontend/tests/FromGeePage.test.tsx` — smoke test for landing page

---

## Chunk 1: Backend — GEE Detection and File Size

### Task 1: Add `detect_gee_origin` to detector service

**Files:**
- Modify: `sandbox/ingestion/src/services/detector.py`
- Test: `sandbox/ingestion/tests/test_detector.py`

- [ ] **Step 1: Write failing tests for `detect_gee_origin`**

Open `sandbox/ingestion/tests/test_detector.py` and add:

```python
import pytest
from src.services.detector import detect_gee_origin


def test_detects_gee_tile_pattern():
    assert detect_gee_origin("image-0000000000-0000000001.tif") is True


def test_detects_gee_tile_pattern_tiff_extension():
    assert detect_gee_origin("ndvi-0000000000-0000000000.tiff") is True


def test_detects_gee_date_pattern():
    assert detect_gee_origin("landcover_20230601.tif") is True


def test_detects_gee_date_pattern_with_prefix():
    assert detect_gee_origin("sentinel2_ndvi_20231201.tif") is True


def test_detects_ee_export_prefix():
    assert detect_gee_origin("ee-export-result.tif") is True


def test_detects_ee_underscore_export_prefix():
    assert detect_gee_origin("ee_export_mosaic.tif") is True


def test_does_not_flag_normal_geotiff():
    assert detect_gee_origin("elevation_model.tif") is False


def test_does_not_flag_shapefile():
    assert detect_gee_origin("boundaries.shp") is False


def test_does_not_flag_geojson():
    assert detect_gee_origin("parcels.geojson") is False


def test_handles_path_with_directories():
    # Only the basename should be checked, not the full path
    assert detect_gee_origin("/tmp/uploads/image-0000000000-0000000001.tif") is True


def test_case_insensitive_extension():
    assert detect_gee_origin("image-0000000000-0000000000.TIF") is True
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/ingestion
uv run pytest tests/test_detector.py -k "gee_origin" -v
```

Expected: `ImportError` or `AttributeError` — `detect_gee_origin` does not exist yet.

- [ ] **Step 3: Implement `detect_gee_origin` in `detector.py`**

Add to `sandbox/ingestion/src/services/detector.py` (after the existing imports, before `_MIME_WHITELIST`):

```python
import re

_GEE_TILE_PATTERN = re.compile(r".+-\d{10}-\d{10}\.(tif|tiff)$", re.IGNORECASE)
_GEE_DATE_PATTERN = re.compile(r".+_\d{8}\.(tif|tiff)$", re.IGNORECASE)
_GEE_PREFIX_PATTERN = re.compile(r"^ee[-_]export", re.IGNORECASE)


def detect_gee_origin(filename: str) -> bool:
    """Return True if the filename matches a known GEE export naming pattern."""
    name = os.path.basename(filename)
    return bool(
        _GEE_TILE_PATTERN.match(name)
        or _GEE_DATE_PATTERN.match(name)
        or _GEE_PREFIX_PATTERN.match(name)
    )
```

Note: `os` is already imported at the top of `detector.py`.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/ingestion
uv run pytest tests/test_detector.py -k "gee_origin" -v
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Run the full detector test suite to confirm no regressions**

```bash
uv run pytest tests/test_detector.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add sandbox/ingestion/src/services/detector.py sandbox/ingestion/tests/test_detector.py
git commit -m "feat(ingestion): add detect_gee_origin filename pattern matcher"
```

---

### Task 2: Add `gee_origin` field to Dataset model

**Files:**
- Modify: `sandbox/ingestion/src/models.py`
- Test: `sandbox/ingestion/tests/test_models.py`

- [ ] **Step 1: Write a failing test for the new field**

Open `sandbox/ingestion/tests/test_models.py`. Check what's already imported at module scope (Dataset, DatasetType, FormatPair, datetime) and add these two functions using those imports — do not re-import inside the functions:

```python
def test_dataset_gee_origin_defaults_false():
    dataset = Dataset(
        id="test-id",
        filename="test.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="http://example.com/tiles",
        created_at=datetime.now(timezone.utc),
    )
    assert dataset.gee_origin is False


def test_dataset_gee_origin_can_be_set_true():
    dataset = Dataset(
        id="test-id",
        filename="ee-export.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="http://example.com/tiles",
        gee_origin=True,
        created_at=datetime.now(timezone.utc),
    )
    assert dataset.gee_origin is True
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/ingestion
uv run pytest tests/test_models.py -k "gee_origin" -v
```

Expected: `ValidationError` or `AttributeError` — field does not exist yet.

- [ ] **Step 3: Add `gee_origin` to the Dataset model**

In `sandbox/ingestion/src/models.py`, add this line to the `Dataset` class after `credits`:

```python
    credits: list[dict] = []
    gee_origin: bool = False  # heuristic: filename matched a known GEE export pattern
    created_at: datetime
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
uv run pytest tests/test_models.py -k "gee_origin" -v
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full model test suite**

```bash
uv run pytest tests/test_models.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add sandbox/ingestion/src/models.py sandbox/ingestion/tests/test_models.py
git commit -m "feat(ingestion): add gee_origin field to Dataset model"
```

---

### Task 3: Wire `detect_gee_origin` into the pipeline

**Files:**
- Modify: `sandbox/ingestion/src/services/pipeline.py`

The pipeline builds a `Dataset` object after conversion. Read `pipeline.py` in full to find the `Dataset(...)` constructor call, then add `gee_origin=detect_gee_origin(job.filename)` as a kwarg.

- [ ] **Step 1: Find where Dataset is constructed in pipeline.py**

```bash
grep -n "Dataset(" /home/anthony/projects/map-app-builder/sandbox/ingestion/src/services/pipeline.py
```

Note the line number.

- [ ] **Step 2: Add the import at the top of pipeline.py**

In the existing import line:
```python
from src.services.detector import detect_format, validate_magic_bytes
```

Change to:
```python
from src.services.detector import detect_format, detect_gee_origin, validate_magic_bytes
```

- [ ] **Step 3: Add `gee_origin` to the Dataset constructor call**

At the `Dataset(...)` constructor call found in Step 1, add:

```python
gee_origin=detect_gee_origin(job.filename),
```

alongside the other kwargs.

- [ ] **Step 4: Verify gee_origin is set correctly**

Add a targeted test in `sandbox/ingestion/tests/test_pipeline.py` or `tests/test_integration.py` — look at the existing test that creates a Job with a real or mocked filename, then check `gee_origin` on the resulting Dataset. For example:

```python
def test_pipeline_sets_gee_origin_true_for_gee_filename(monkeypatch, ...):
    # Use whatever fixture the file already uses to run the pipeline with a .tif
    # Change job.filename to "image-0000000000-0000000001.tif" before calling run_pipeline
    # Assert: datasets[job.dataset_id].gee_origin is True
```

Read the existing test file first to follow its setup pattern exactly.

- [ ] **Step 5: Run the pipeline tests to confirm no regressions**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/ingestion
uv run pytest tests/test_pipeline.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
uv run pytest -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add sandbox/ingestion/src/services/pipeline.py
git commit -m "feat(ingestion): set gee_origin on dataset from filename detection"
```

---

### Task 4: Raise file size limit to 2 GB

**Files:**
- Modify: `sandbox/ingestion/src/config.py`
- Modify: `sandbox/ingestion/src/routes/upload.py`

- [ ] **Step 1: Update the default in config.py**

In `sandbox/ingestion/src/config.py`, change line 29:

```python
    max_upload_bytes: int = 2_147_483_648  # 2 GB
```

- [ ] **Step 2: Update the error message in upload.py**

Both the `/upload` endpoint (line ~49) and the `/convert-url` endpoint (line ~96) raise a 413 with the same template. Update the `detail` message in both:

```python
detail=f"File too large. Maximum size is {settings.max_upload_bytes // (1024 * 1024)} MB. GEE may split large exports into tiles — upload each tile separately.",
```

Both occurrences use `settings.max_upload_bytes // (1024*1024)` to calculate the MB display — this will auto-update to 2048 MB once the config changes, but the suffix text needs to be added to both raise sites.

- [ ] **Step 3: Verify the change with an existing test**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/ingestion
uv run pytest tests/test_convert_url.py -v
```

Expected: all tests PASS. (The existing test for oversized uploads should still pass since it mocks the limit — if it hardcodes 1 GB in the test, update it to 2 GB.)

- [ ] **Step 4: Run the full test suite**

```bash
uv run pytest -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/config.py sandbox/ingestion/src/routes/upload.py
git commit -m "feat(ingestion): raise upload limit to 2 GB, improve oversized error message"
```

---

## Chunk 2: Frontend — Types, Callouts, and Landing Page

### Task 5: Add `gee_origin` to the frontend Dataset type

**Files:**
- Modify: `sandbox/frontend/src/types.ts`

- [ ] **Step 1: Add the field to the Dataset interface**

In `sandbox/frontend/src/types.ts`, add `gee_origin` to the `Dataset` interface after `credits`:

```typescript
  credits: Credit[];
  gee_origin?: boolean;
  created_at: string;
```

It's optional (`?`) because existing datasets in memory won't have this field.

- [ ] **Step 2: Run the frontend type-check**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/src/types.ts
git commit -m "feat(frontend): add gee_origin to Dataset type"
```

---

### Task 6: Credits panel — "Coming from GEE?" callout

**Files:**
- Modify: `sandbox/frontend/src/components/CreditsPanel.tsx`
- Test: `sandbox/frontend/tests/CreditsPanel.test.tsx`

- [ ] **Step 1: Write failing tests for the GEE callout**

Open `sandbox/frontend/tests/CreditsPanel.test.tsx`. The existing file uses a `rasterDataset` constant. You need to:

**a)** Add `geoparquet_file_size: null` to the existing `rasterDataset` constant (it's a required field in the `Dataset` type that was added after the test was written):

```typescript
const rasterDataset: Dataset = {
  // ...existing fields...
  converted_file_size: 2621440,
  geoparquet_file_size: null,   // add this line
  feature_count: null,
  // ...rest of fields...
};
```

**b)** Add a `makeDataset` helper after the `rasterDataset` constant that allows partial overrides:

```typescript
function makeDataset(overrides: Partial<Dataset>): Dataset {
  return { ...rasterDataset, ...overrides };
}
```

**c)** Add the GEE callout tests inside the existing `describe("CreditsPanel", ...)` block:

```typescript
  describe("GEE callout", () => {
    it("shows Coming from GEE section when gee_origin is true", () => {
      renderWithProviders(<CreditsPanel dataset={makeDataset({ gee_origin: true })} />);
      expect(screen.getByText(/coming from gee/i)).toBeTruthy();
    });

    it("does not show Coming from GEE section when gee_origin is false", () => {
      renderWithProviders(<CreditsPanel dataset={makeDataset({ gee_origin: false })} />);
      expect(screen.queryByText(/coming from gee/i)).toBeNull();
    });

    it("does not show Coming from GEE section when gee_origin is undefined", () => {
      renderWithProviders(<CreditsPanel dataset={makeDataset({})} />);
      expect(screen.queryByText(/coming from gee/i)).toBeNull();
    });

    it("links to /from-gee for the full concept map", () => {
      renderWithProviders(<CreditsPanel dataset={makeDataset({ gee_origin: true })} />);
      const link = screen.getByText(/gee → cng concept map/i).closest("a");
      expect(link).toHaveAttribute("href", "/from-gee");
    });
  });
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/frontend
npx vitest run tests/CreditsPanel.test.tsx
```

Expected: new tests FAIL (element not found).

- [ ] **Step 3: Add the GEE callout section to CreditsPanel.tsx**

In `sandbox/frontend/src/components/CreditsPanel.tsx`, add the following block **before** the "What's next" section (i.e., before the `<Box mb={4} pb={4}` block containing "Turn this into a story"):

```tsx
      {dataset.gee_origin && (
        <Box mb={4} pb={4} borderBottom="1px solid" borderColor="#f0eeeb">
          <Text
            fontSize="11px"
            textTransform="uppercase"
            letterSpacing="1px"
            color="brand.textSecondary"
            fontWeight={600}
            mb={2}
          >
            Coming from GEE?
          </Text>
          <Text fontSize="13px" color="brand.brown" mb={2} lineHeight={1.5}>
            In GEE, you'd visualize this with{" "}
            <Box as="code" fontSize="12px" bg="brand.bgSubtle" px={1} borderRadius="2px">
              Map.addLayer(image)
            </Box>
            . Here, TiTiler serves the same tiles via HTTP — no EECU cost per view.
          </Text>
          <Link
            href="/from-gee"
            color="brand.orange"
            fontSize="12px"
            fontWeight={500}
          >
            See the full GEE → CNG concept map →
          </Link>
        </Box>
      )}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/CreditsPanel.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Run the full frontend test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add sandbox/frontend/src/components/CreditsPanel.tsx sandbox/frontend/tests/CreditsPanel.test.tsx
git commit -m "feat(frontend): add GEE callout section to CreditsPanel"
```

---

### Task 7: Expiry page — GEE-specific copy

**Files:**
- Modify: `sandbox/frontend/src/pages/MapPage.tsx`
- Modify: `sandbox/frontend/src/pages/ExpiredPage.tsx`
- Create: `sandbox/frontend/tests/ExpiredPage.test.tsx`

- [ ] **Step 1: Write failing tests for ExpiredPage**

Create `sandbox/frontend/tests/ExpiredPage.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExpiredPage from "../src/pages/ExpiredPage";

function renderExpiredPage(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/expired/test-id", state }]}>
      <Routes>
        <Route path="/expired/:id" element={<ExpiredPage />} />
      </Routes>
    </MemoryRouter>
  );
}

it("shows standard copy when no gee_origin state", () => {
  renderExpiredPage();
  expect(screen.getByText(/this map has expired/i)).toBeInTheDocument();
  expect(screen.queryByText(/cog on s3/i)).not.toBeInTheDocument();
});

it("shows GEE cost copy when gee_origin is true", () => {
  renderExpiredPage({ gee_origin: true });
  expect(screen.getByText(/cog on s3/i)).toBeInTheDocument();
});

it("does not show GEE cost copy when gee_origin is false", () => {
  renderExpiredPage({ gee_origin: false });
  expect(screen.queryByText(/cog on s3/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/frontend
npx vitest run tests/ExpiredPage.test.tsx
```

Expected: GEE-specific tests FAIL.

- [ ] **Step 3: Update ExpiredPage.tsx to read router state**

In `sandbox/frontend/src/pages/ExpiredPage.tsx`, add `useLocation` import and the conditional GEE copy:

```tsx
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";

export default function ExpiredPage() {
  const location = useLocation();
  const geeOrigin = (location.state as { gee_origin?: boolean } | null)?.gee_origin;

  return (
    <Box minH="100vh" bg="white">
      <Header />
      <Flex
        direction="column"
        align="center"
        justify="center"
        h="calc(100vh - 56px)"
        px={8}
      >
        <Flex
          align="center"
          justify="center"
          w="56px"
          h="56px"
          bg="brand.bgSubtle"
          borderRadius="full"
          mb={5}
          fontSize="24px"
        >
          ⏳
        </Flex>
        <Text color="brand.brown" fontSize="20px" fontWeight={700} mb={2}>
          This map has expired
        </Text>
        <Text
          color="brand.textSecondary"
          fontSize="14px"
          mb={geeOrigin ? 3 : 7}
          maxW="340px"
          textAlign="center"
          lineHeight={1.5}
        >
          Sandbox maps are available for 30 days. Re-upload your data or talk to
          us about a permanent solution.
        </Text>
        {geeOrigin && (
          <Text
            color="brand.textSecondary"
            fontSize="13px"
            mb={7}
            maxW="380px"
            textAlign="center"
            lineHeight={1.5}
          >
            Hosting this data as a COG on S3 costs approximately $0.02/month for
            a 1 GB file — and serves tiles with no compute cost per view.
          </Text>
        )}
        <Flex gap={3}>
          <Button
            bg="brand.orange"
            color="white"
            fontWeight={600}
            borderRadius="4px"
            _hover={{ bg: "brand.orangeHover" }}
            asChild
          >
            <Link to="/">Upload again</Link>
          </Button>
          <Button
            bg="brand.bgSubtle"
            color="brand.brown"
            fontWeight={500}
            borderRadius="4px"
            asChild
          >
            <a
              href="https://developmentseed.org/contact"
              target="_blank"
              rel="noopener noreferrer"
            >
              Talk to Dev Seed
            </a>
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 4: Update MapPage.tsx to pass `gee_origin` state when navigating to expired**

`MapPage.tsx` has two `navigate('/expired/:id')` calls inside `fetchDataset()`:
1. The **404 case** (line ~27): `navigate(\`/expired/${id}\`, { replace: true })` — fires when API returns 404, no dataset is available. **Leave this unchanged.**
2. The **expiry check** (line ~36): inside `if (new Date() > expiry)` — fires when the dataset loaded but is past 30 days. **Update this one only:**

```tsx
// Inside if (new Date() > expiry):
navigate(`/expired/${id}`, { replace: true, state: { gee_origin: data.gee_origin } });
```

Note: the variable holding the fetched dataset JSON at that point in the code is `data` (from `const data: Dataset = await resp.json()`). Use `data.gee_origin`, not `dataset.gee_origin` (the state variable is set later).

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run tests/ExpiredPage.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Run full frontend test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add sandbox/frontend/src/pages/ExpiredPage.tsx sandbox/frontend/src/pages/MapPage.tsx sandbox/frontend/tests/ExpiredPage.test.tsx
git commit -m "feat(frontend): show GEE cost copy on expiry page when gee_origin is set"
```

---

### Task 8: Upload page — "Coming from GEE?" callout

**Files:**
- Modify: `sandbox/frontend/src/pages/UploadPage.tsx`
- Create: `sandbox/frontend/tests/UploadPage.test.tsx`

- [ ] **Step 1: Write a failing test**

Create `sandbox/frontend/tests/UploadPage.test.tsx`. `UploadPage` uses `useConversionJob` internally, so mock it. The component starts in the non-processing state (jobId is null), so `FileUploader` and the callout render by default.

```typescript
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import UploadPage from "../src/pages/UploadPage";

vi.mock("../src/hooks/useConversionJob", () => ({
  useConversionJob: () => ({
    state: { jobId: null, status: "pending", datasetId: null, error: null, stages: [] },
    startUpload: vi.fn(),
    startUrlFetch: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <UploadPage />
      </MemoryRouter>
    </ChakraProvider>
  );
}

it("shows Coming from GEE callout on upload page", () => {
  renderPage();
  expect(screen.getByText(/coming from gee/i)).toBeTruthy();
});

it("Coming from GEE callout links to /from-gee", () => {
  renderPage();
  // The link text is "Start here →", not "Coming from GEE?"
  const link = screen.getByText(/start here/i).closest("a");
  expect(link).toHaveAttribute("href", "/from-gee");
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/frontend
npx vitest run tests/UploadPage.test.tsx
```

Expected: both tests FAIL (element not found — callout doesn't exist yet).

- [ ] **Step 3: Add the callout to UploadPage.tsx**

The current `UploadPage.tsx` return block uses a ternary: `isProcessing ? <ProgressTracker /> : <FileUploader />`. Change the false branch to a fragment that includes both `FileUploader` and the callout:

```tsx
      {isProcessing ? (
        <ProgressTracker
          stages={state.stages}
          filename={fileRef.current.name}
          fileSize={fileRef.current.size}
        />
      ) : (
        <>
          <FileUploader
            onFileSelected={handleFile}
            onUrlSubmitted={handleUrl}
            disabled={false}
          />
          <Box textAlign="center" mt={3}>
            <Text as="span" fontSize="13px" color="brand.textSecondary">
              Coming from GEE?{" "}
            </Text>
            <Link
              href="/from-gee"
              color="brand.orange"
              fontSize="13px"
              fontWeight={500}
            >
              Start here →
            </Link>
          </Box>
        </>
      )}
```

Also add `Link` to the Chakra UI import at the top of `UploadPage.tsx` if it isn't already there.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/UploadPage.test.tsx
```

Expected: both tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add sandbox/frontend/src/pages/UploadPage.tsx sandbox/frontend/tests/UploadPage.test.tsx
git commit -m "feat(frontend): add Coming from GEE callout on upload page"
```

---

### Task 9: New `/from-gee` landing page

**Files:**
- Create: `sandbox/frontend/src/pages/FromGeePage.tsx`
- Modify: `sandbox/frontend/src/App.tsx`
- Create: `sandbox/frontend/tests/FromGeePage.test.tsx`

- [ ] **Step 1: Write a smoke test**

Create `sandbox/frontend/tests/FromGeePage.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import FromGeePage from "../src/pages/FromGeePage";

function renderPage() {
  // No MemoryRouter needed — FromGeePage uses only plain href links, no RouterLink
  return render(
    <ChakraProvider value={system}>
      <FromGeePage />
    </ChakraProvider>
  );
}

it("renders the page heading", () => {
  renderPage();
  expect(screen.getByRole("heading", { name: /exported.*gee/i })).toBeInTheDocument();
});

it("shows the GEE to CNG comparison table", () => {
  renderPage();
  expect(screen.getByText(/ee\.ImageCollection/)).toBeInTheDocument();
  expect(screen.getByText(/STAC Collection/i)).toBeInTheDocument();
});

it("shows the upload CTA linking to the home page", () => {
  renderPage();
  // Both CTA links use href="/" (plain Chakra Link, not RouterLink)
  const ctas = screen.getAllByRole("link", { name: /upload.*first.*export/i });
  expect(ctas.length).toBeGreaterThanOrEqual(1);
  expect(ctas[0]).toHaveAttribute("href", "/");
});

it("shows the compute pathway section", () => {
  renderPage();
  expect(screen.getByText(/Google Colab/i)).toBeInTheDocument();
  expect(screen.getByText(/Planetary Computer/i)).toBeInTheDocument();
  expect(screen.getByText(/Pangeo/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/FromGeePage.test.tsx
```

Expected: `Cannot find module` or similar — page doesn't exist yet.

- [ ] **Step 3: Create `FromGeePage.tsx`**

Create `sandbox/frontend/src/pages/FromGeePage.tsx`:

```tsx
import { Box, Flex, Link, Table, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";

// No react-router-dom import needed — internal CTAs use plain href="/" since
// Chakra UI v3 does not support the `as` prop. Use href for simple page links.

const GEE_TO_CNG = [
  { gee: "ee.ImageCollection('COPERNICUS/S2')", cng: "STAC Collection search", cngUrl: "https://stacspec.org" },
  { gee: "ee.Image", cng: "STAC Item + COG asset", cngUrl: "https://cogeo.org" },
  { gee: "Map.addLayer(image)", cng: "TiTiler tile endpoint (HTTP, no EECU)", cngUrl: "https://developmentseed.org/titiler" },
  { gee: "Export.image.toDrive()", cng: "rio-cogeo (write COG to S3)", cngUrl: "https://github.com/cogeotiff/rio-cogeo" },
  { gee: "ee.FeatureCollection", cng: "GeoParquet / PMTiles", cngUrl: "https://github.com/protomaps/PMTiles" },
  { gee: "GEE App", cng: "Static site (MapLibre + COG on S3)", cngUrl: "https://maplibre.org" },
];

const CNG_PATTERNS = [
  {
    title: "HTTP range requests instead of full-file downloads",
    body: "A COG fetches only the pixels your viewer needs. Viewing a 10 GB scene at overview resolution? A few hundred KB, not the full file. GEE charges EECUs for every tile render; a COG on S3 costs fractions of a cent per thousand requests.",
  },
  {
    title: "STAC search instead of server-side filtering",
    body: "Filtering an ee.ImageCollection by date, bounds, and cloud cover runs server-side and consumes EECUs. A STAC API query is a lightweight metadata search — no pixel processing, no compute units.",
  },
  {
    title: "Client-side rendering eliminates tile server costs",
    body: "Libraries like geotiff.js and maplibre-cog-protocol render COGs directly in your browser. PMTiles serves vector tiles from a single file on S3. No tile server, no EECU cost per interaction.",
  },
  {
    title: "Process only what you need, where you choose",
    body: "COG range requests and Zarr chunk access let you pull exactly the spatial/temporal subset you need — locally, on a $5/month VM, or a Dask cluster. Compute cost is transparent and under your control.",
  },
  {
    title: "Static hosting replaces managed infrastructure",
    body: "A GEE App consumes EECUs for every user interaction. A map built with CNG data sources can be hosted on Vercel, Netlify, or an S3 bucket — effectively free for moderate traffic.",
  },
];

const COMPUTE_OPTIONS = [
  {
    name: "Google Colab",
    description: "Free, runs in your browser, familiar to GEE users. Great for learning xarray, rasterio, and geopandas.",
    url: "https://colab.research.google.com",
  },
  {
    name: "Microsoft Planetary Computer Hub",
    description: "Managed JupyterHub co-located with Sentinel, Landsat, and other public datasets as STAC + COG.",
    url: "https://planetarycomputer.microsoft.com",
  },
  {
    name: "Pangeo JupyterHub",
    description: "Open, scalable, built on xarray + Dask + Zarr. The open-source alternative to GEE's compute paradigm.",
    url: "https://pangeo.io",
  },
];

export default function FromGeePage() {
  return (
    <Box minH="100vh" bg="white">
      <Header />
      <Box maxW="760px" mx="auto" px={6} py={12}>

        {/* Hero */}
        <Text
          as="h1"
          fontSize={{ base: "24px", md: "32px" }}
          fontWeight={700}
          color="brand.brown"
          mb={4}
          lineHeight={1.25}
        >
          You exported from GEE. Here's what to do next.
        </Text>
        <Text fontSize="16px" color="brand.textSecondary" mb={10} lineHeight={1.6} maxW="600px">
          Google Earth Engine is great at planetary-scale analysis. But once your data leaves GEE,
          you're on your own — no catalog, no tile server, no way to share it without spinning up
          infrastructure. Cloud-native geospatial (CNG) formats solve that. Here's how to get started.
        </Text>

        {/* CTA */}
        <Box
          bg="brand.bgSubtle"
          borderRadius="6px"
          p={5}
          mb={12}
          display="inline-block"
        >
          <Text fontSize="14px" color="brand.brown" fontWeight={600} mb={2}>
            Ready to try it?
          </Text>
          <Link
            href="/"
            color="brand.orange"
            fontSize="14px"
            fontWeight={600}
          >
            Upload your first GEE export →
          </Link>
        </Box>

        {/* Comparison table */}
        <Text as="h2" fontSize="18px" fontWeight={700} color="brand.brown" mb={4}>
          GEE → CNG: the translation table
        </Text>
        <Box overflowX="auto" mb={12}>
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader fontWeight={600} color="brand.textSecondary" fontSize="12px" textTransform="uppercase" letterSpacing="0.5px">
                  In GEE you...
                </Table.ColumnHeader>
                <Table.ColumnHeader fontWeight={600} color="brand.textSecondary" fontSize="12px" textTransform="uppercase" letterSpacing="0.5px">
                  In CNG you...
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {GEE_TO_CNG.map(({ gee, cng, cngUrl }) => (
                <Table.Row key={gee}>
                  <Table.Cell>
                    <Box as="code" fontSize="12px" color="brand.brown">
                      {gee}
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Link href={cngUrl} target="_blank" rel="noopener noreferrer" color="brand.orange" fontSize="13px" fontWeight={500}>
                      {cng} →
                    </Link>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>

        {/* 5 patterns */}
        <Text as="h2" fontSize="18px" fontWeight={700} color="brand.brown" mb={2}>
          5 CNG patterns that eliminate EECU costs
        </Text>
        <Text fontSize="14px" color="brand.textSecondary" mb={6} lineHeight={1.5}>
          Many operations GEE charges compute-hours for are operations that CNG formats handle without a compute layer at all.
        </Text>
        <Flex direction="column" gap={5} mb={12}>
          {CNG_PATTERNS.map(({ title, body }) => (
            <Box key={title} borderLeft="3px solid" borderColor="brand.orange" pl={4}>
              <Text fontSize="14px" fontWeight={600} color="brand.brown" mb={1}>
                {title}
              </Text>
              <Text fontSize="13px" color="brand.textSecondary" lineHeight={1.6}>
                {body}
              </Text>
            </Box>
          ))}
        </Flex>

        {/* Compute pathway */}
        <Text as="h2" fontSize="18px" fontWeight={700} color="brand.brown" mb={2}>
          Where do I run my analysis?
        </Text>
        <Text fontSize="14px" color="brand.textSecondary" mb={6} lineHeight={1.5}>
          CNG Sandbox is the format and catalog layer — it converts your files and generates STAC metadata.
          For computation (band math, classification, time series), these platforms work natively with CNG formats:
        </Text>
        <Flex direction="column" gap={4} mb={12}>
          {COMPUTE_OPTIONS.map(({ name, description, url }) => (
            <Box key={name} p={4} border="1px solid" borderColor="brand.border" borderRadius="6px">
              <Link href={url} target="_blank" rel="noopener noreferrer" color="brand.orange" fontSize="14px" fontWeight={600}>
                {name} →
              </Link>
              <Text fontSize="13px" color="brand.textSecondary" mt={1} lineHeight={1.5}>
                {description}
              </Text>
            </Box>
          ))}
        </Flex>

        {/* Bottom CTA */}
        <Box borderTop="1px solid" borderColor="brand.border" pt={8} textAlign="center">
          <Text fontSize="16px" fontWeight={600} color="brand.brown" mb={3}>
            Ready to convert your first export?
          </Text>
          <Text fontSize="14px" color="brand.textSecondary" mb={5}>
            Built by the team that created TiTiler, pgSTAC, and the tools powering NASA and ESA's own CNG infrastructure.
          </Text>
          <Link
            href="/"
            display="inline-block"
            bg="brand.orange"
            color="white"
            px={5}
            py={3}
            borderRadius="4px"
            fontWeight={600}
            fontSize="14px"
            _hover={{ bg: "brand.orangeHover", textDecoration: "none" }}
          >
            Upload your first GEE export →
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Add the route to App.tsx**

In `sandbox/frontend/src/App.tsx`:

```tsx
import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import FromGeePage from "./pages/FromGeePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/map/:id" element={<MapPage />} />
      <Route path="/expired/:id" element={<ExpiredPage />} />
      <Route path="/from-gee" element={<FromGeePage />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /home/anthony/projects/map-app-builder/sandbox/frontend
npx vitest run tests/FromGeePage.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add sandbox/frontend/src/pages/FromGeePage.tsx sandbox/frontend/src/App.tsx sandbox/frontend/tests/FromGeePage.test.tsx
git commit -m "feat(frontend): add /from-gee landing page and route"
```

---

## Final Verification

- [ ] **Build the library and start the sandbox**

```bash
cd /home/anthony/projects/map-app-builder
npm run build
docker compose -f sandbox/docker-compose.yml up -d --build
```

- [ ] **Smoke-test the key user flows**

1. Navigate to `http://localhost:5185/from-gee` — confirm the landing page renders with the comparison table, 5 patterns, and compute options
2. Navigate to `http://localhost:5185/` — confirm the "Coming from GEE? Start here →" link appears below the upload area
3. Upload a file named `image-0000000000-0000000001.tif` (or rename any `.tif` to match) — confirm the "Coming from GEE?" section appears in the credits panel
4. Confirm a file named `elevation_model.tif` does NOT show the GEE section

- [ ] **Final commit tag (optional)**

```bash
git tag content-sprint-complete
```

---

## Not in this plan

- Blog post (content deliverable, not a code task — write and publish separately)
- v1.75 features (STAC catalog generation, COG optimization teaching, GEE→CNG concept map panel, multi-tile ingest) — separate plan, blocked on v1.5
