# deck.gl-geotiff Client-Side COG Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Client Rendering" tab to raster dataset pages that renders COGs directly in the browser using `@developmentseed/deck.gl-geotiff`, alongside the existing titiler tile server.

**Architecture:** The backend exposes a `cog_url` field on raster Dataset responses pointing to the COG file via the existing `/storage` Vite proxy. A new `DirectRasterMap` component uses `COGLayer` from `@developmentseed/deck.gl-geotiff` to render the COG client-side. `MapPage.tsx` gets a tab bar to switch between server-rendered and client-rendered views for non-temporal rasters.

**Tech Stack:** React 19, Chakra UI v3, deck.gl 9, `@developmentseed/deck.gl-geotiff@0.3.0`, MapLibre GL JS, Python/FastAPI (backend)

**Spec:** `docs/superpowers/specs/2026-03-18-deck-gl-raster-design.md`

---

### Task 1: Backend — add `cog_url` field to Dataset model

**Files:**
- Modify: `ingestion/src/models.py:79-106`
- Test: `ingestion/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

Add to `ingestion/tests/test_models.py`:

```python
def test_dataset_cog_url_default_none():
    d = Dataset(
        id="x",
        filename="x.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
    )
    assert d.cog_url is None


def test_dataset_cog_url_populated():
    d = Dataset(
        id="x",
        filename="x.tif",
        dataset_type=DatasetType.RASTER,
        format_pair=FormatPair.GEOTIFF_TO_COG,
        tile_url="/raster/x",
        created_at=datetime.now(timezone.utc),
        cog_url="/storage/datasets/x/converted/data.tif",
    )
    assert d.cog_url == "/storage/datasets/x/converted/data.tif"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ingestion && uv run pytest tests/test_models.py::test_dataset_cog_url_default_none tests/test_models.py::test_dataset_cog_url_populated -v`
Expected: FAIL — `cog_url` is not a recognized field on `Dataset`

- [ ] **Step 3: Add `cog_url` field to Dataset model**

In `ingestion/src/models.py`, add after `parquet_url` (line 99):

```python
    cog_url: str | None = None  # raster only; public-facing URL to COG file
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ingestion && uv run pytest tests/test_models.py -v`
Expected: ALL PASS (including existing tests — the new field defaults to `None` so no existing `Dataset()` calls break)

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/models.py ingestion/tests/test_models.py
git commit -m "feat: add cog_url field to Dataset model"
```

---

### Task 2: Backend — populate `cog_url` in pipeline

**Files:**
- Modify: `ingestion/src/services/pipeline.py:262-288`
- Test: `ingestion/tests/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

Add to `ingestion/tests/test_pipeline.py`:

```python
def test_cog_url_built_for_raster():
    converted_key = "datasets/abc-123/converted/data.tif"
    format_pair = FormatPair.GEOTIFF_TO_COG
    cog_url = f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.RASTER else None
    assert cog_url == "/storage/datasets/abc-123/converted/data.tif"


def test_cog_url_none_for_vector():
    converted_key = "datasets/abc-123/converted/data.parquet"
    format_pair = FormatPair.GEOJSON_TO_GEOPARQUET
    cog_url = f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.RASTER else None
    assert cog_url is None
```

You'll need to add `DatasetType` to the imports at the top of the file if not already present. Check existing imports — the file already imports `FormatPair` from `src.models`.

- [ ] **Step 2: Run tests to verify they pass**

These tests validate the URL construction logic without needing to mock the full pipeline. They should pass immediately since we're testing the expression itself.

Run: `cd ingestion && uv run pytest tests/test_pipeline.py::test_cog_url_built_for_raster tests/test_pipeline.py::test_cog_url_none_for_vector -v`
Expected: PASS

- [ ] **Step 3: Add `cog_url` to the Dataset constructor in `pipeline.py`**

In `ingestion/src/services/pipeline.py`, find the `Dataset(...)` constructor call (line 262). Add after the `parquet_url` line (line 284):

```python
            cog_url=f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.RASTER else None,
```

This mirrors the `parquet_url` pattern on the line above. `converted_key` is already set (line 234) and holds the S3 object key (e.g., `datasets/{id}/converted/data.tif`).

**Note:** Do NOT add `cog_url` to `temporal_pipeline.py` — temporal rasters have multiple COGs and the tab should not appear for them. `temporal_pipeline.py` already omits `parquet_url` for the same reason.

- [ ] **Step 2: Run the full backend test suite to verify nothing breaks**

Run: `cd ingestion && uv run pytest -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/services/pipeline.py
git commit -m "feat: populate cog_url for raster datasets in pipeline"
```

---

### Task 3: Frontend — bump deck.gl and add deck.gl-geotiff dependency

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install `@developmentseed/deck.gl-geotiff` and bump deck.gl**

```bash
cd frontend && yarn add @developmentseed/deck.gl-geotiff@^0.3.0 @deck.gl/core@^9.2.7 @deck.gl/geo-layers@^9.2.7 @deck.gl/layers@^9.2.7 @deck.gl/react@^9.2.7 @deck.gl/mesh-layers@^9.2.7 @luma.gl/core@^9.2.6
```

`@deck.gl/mesh-layers` and `@luma.gl/core` are peer deps of `deck.gl-geotiff`. The deck.gl bump is `^9.0.0` → `^9.2.7` (minor version within v9).

- [ ] **Step 2: Run existing frontend tests to verify deck.gl bump doesn't break anything**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
cd frontend && git add package.json yarn.lock
git commit -m "deps: add deck.gl-geotiff, bump deck.gl to ^9.2.7"
```

---

### Task 4: Frontend — add `cog_url` to Dataset type

**Files:**
- Modify: `frontend/src/types.ts:29-57`

- [ ] **Step 1: Add `cog_url` field to Dataset interface**

In `frontend/src/types.ts`, add after `parquet_url` (line 49):

```typescript
  cog_url?: string;
```

- [ ] **Step 2: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS (new optional field doesn't break anything)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add cog_url field to Dataset type"
```

---

### Task 5: Frontend — create DirectRasterMap component

**Files:**
- Create: `frontend/src/components/DirectRasterMap.tsx`

**Reference:** `frontend/src/components/RasterMap.tsx` — follow the same deck.gl + MapLibre composition pattern, basemap selector, and opacity slider structure.

- [ ] **Step 1: Create `DirectRasterMap.tsx`**

```typescript
import { useState, useMemo } from "react";
import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView, WebMercatorViewport } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import type { Dataset } from "../types";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

interface DirectRasterMapProps {
  dataset: Dataset;
}

export function DirectRasterMap({ dataset }: DirectRasterMapProps) {
  const [opacity, setOpacity] = useState(0.8);
  const [basemap, setBasemap] = useState("streets");

  const initialViewState = useMemo(() => {
    if (!dataset.bounds) {
      return { longitude: 0, latitude: 0, zoom: 2 };
    }
    const [west, south, east, north] = dataset.bounds;
    const MERCATOR_LIMIT = 85.051129;
    const viewport = new WebMercatorViewport({ width: 800, height: 600 });
    const { longitude, latitude, zoom } = viewport.fitBounds(
      [
        [west, Math.max(south, -MERCATOR_LIMIT)],
        [east, Math.min(north, MERCATOR_LIMIT)],
      ],
      { padding: 40 },
    );
    return { longitude, latitude, zoom };
  }, [dataset.bounds]);

  const layers = useMemo(() => {
    if (!dataset.cog_url) return [];
    const url = window.location.origin + dataset.cog_url;
    return [
      new COGLayer({
        id: "direct-cog-layer",
        geotiff: url,
        opacity,
      }),
    ];
  }, [dataset.cog_url, opacity]);

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        initialViewState={initialViewState}
        controller
        layers={layers}
        views={new MapView({ repeat: true })}
      >
        <Map mapStyle={BASEMAPS[basemap]} />
      </DeckGL>

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
    </Box>
  );
}
```

**Why `window.location.origin + dataset.cog_url`:** `COGLayer` makes HTTP Range requests and needs a full URL, not a relative path. This is the same pattern `VectorMap.tsx` uses for MapLibre tile sources.

**Note:** The basemap selector and opacity slider are copied from `RasterMap.tsx` (lines 176-268). No colormap or band selector — `COGLayer` renders native pixel values. The `BASEMAPS` constant is duplicated (pre-existing pattern across `RasterMap.tsx` and `VectorMap.tsx`).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors. If `COGLayer` import fails, check the actual export name from `@developmentseed/deck.gl-geotiff` — it may need `import { COGLayer } from "@developmentseed/deck.gl-geotiff"` or a different path. Check `node_modules/@developmentseed/deck.gl-geotiff/dist/index.d.ts` for the actual exports.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DirectRasterMap.tsx
git commit -m "feat: add DirectRasterMap component using COGLayer"
```

---

### Task 6: Frontend — add rendering tab to MapPage

**Files:**
- Modify: `frontend/src/pages/MapPage.tsx:1-214`

**Reference:** Look at how the vector dataset "Explore" tab works in this file. The raster tab follows a similar pattern but uses a floating pill overlay on the map instead of a side-panel tab.

- [ ] **Step 1: Add import and state**

At the top of `frontend/src/pages/MapPage.tsx`, add the import (after line 9):

```typescript
import { DirectRasterMap } from "../components/DirectRasterMap";
```

Add new state (after `activeTab` on line 28):

```typescript
const [rasterTab, setRasterTab] = useState<"server" | "client">("server");
```

Note: `activeTab` controls the side-panel `CreditsPanel` tabs. `rasterTab` controls which map renderer is shown — these are separate concerns.

- [ ] **Step 2: Replace the raster rendering block**

Replace lines 153-164 (the `dataset.dataset_type === "raster"` branch) with:

```typescript
          {dataset.dataset_type === "raster" ? (
            <>
              {!dataset.is_temporal && dataset.cog_url && (
                <Flex
                  position="absolute"
                  top={3}
                  left="50%"
                  transform="translateX(-50%)"
                  zIndex={10}
                >
                  <Flex bg="white" borderRadius="6px" shadow="sm" overflow="hidden">
                    <Box
                      px={3}
                      py={1}
                      cursor="pointer"
                      fontSize="sm"
                      fontWeight={500}
                      bg={rasterTab === "server" ? "brand.orange" : "white"}
                      color={rasterTab === "server" ? "white" : "brand.brown"}
                      onClick={() => setRasterTab("server")}
                    >
                      Tile Server
                    </Box>
                    <Box
                      px={3}
                      py={1}
                      cursor="pointer"
                      fontSize="sm"
                      fontWeight={500}
                      bg={rasterTab === "client" ? "brand.orange" : "white"}
                      color={rasterTab === "client" ? "white" : "brand.brown"}
                      onClick={() => setRasterTab("client")}
                    >
                      Client Rendering
                    </Box>
                  </Flex>
                </Flex>
              )}
              {rasterTab === "client" && !dataset.is_temporal && dataset.cog_url ? (
                <DirectRasterMap dataset={dataset} />
              ) : (
                <RasterMap
                  dataset={dataset}
                  initialTimestep={dataset.is_temporal ? initialTimestep : undefined}
                  onTimestepChange={(index) => {
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("t", String(index));
                        return next;
                      },
                      { replace: true },
                    );
                  }}
                />
              )}
            </>
          ) : activeTab === "explore" ? (
```

**Important:** The `onTimestepChange` callback must be preserved exactly as-is from the original code. The vector branch (`activeTab === "explore"` onward) stays unchanged.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MapPage.tsx
git commit -m "feat: add Tile Server / Client Rendering tab for raster datasets"
```

---

### Task 7: Smoke test — verify the full stack

This task requires Docker and the full stack running.

- [ ] **Step 1: Rebuild and restart the stack**

```bash
docker compose -f docker-compose.yml build ingestion frontend
docker compose -f docker-compose.yml up -d
```

Wait for all services to be healthy: `docker compose -f docker-compose.yml ps`

- [ ] **Step 2: Upload a GeoTIFF and verify `cog_url` is returned**

Open `http://localhost:5185`, upload a GeoTIFF file. After conversion completes, check the dataset API response:

```bash
curl -s http://localhost:8000/api/datasets | python3 -m json.tool | grep cog_url
```

Expected: `"cog_url": "/storage/datasets/<id>/converted/<filename>.tif"` for raster datasets, `"cog_url": null` for vector datasets.

- [ ] **Step 3: Verify the tab bar appears**

Navigate to the raster dataset page. You should see a floating "Tile Server | Client Rendering" pill at the top-center of the map.

- [ ] **Step 4: Verify client rendering works**

Click "Client Rendering". The map should render the COG directly from MinIO. The rendering may look different from the Tile Server tab (native pixel values vs. colormap-applied), which is expected.

- [ ] **Step 5: Verify temporal rasters don't show the tab**

If you have a NetCDF file, upload it. The temporal raster page should NOT show the tab bar (temporal datasets don't have `cog_url`).

- [ ] **Step 6: Verify vector datasets are unaffected**

Upload a GeoJSON or Shapefile. The vector page should work exactly as before — Explore tab, PMTiles rendering, etc.
