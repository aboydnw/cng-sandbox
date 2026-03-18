# Design: Client-Side COG Rendering with deck.gl-geotiff

**Date:** 2026-03-18
**Scope:** Frontend + minor backend change
**Risk:** Medium (new dependency, deck.gl version bump)

## Problem

Raster datasets have a single rendering path: titiler-pgstac generates PNG tiles server-side, and the frontend displays them via deck.gl `TileLayer` + `BitmapLayer`. Every colormap or band change triggers a full tile re-fetch from the server. There's no way to visualize a COG without the full eoAPI stack running, and users can't see what client-side rendering looks like.

## Solution

Add `@developmentseed/deck.gl-geotiff` as a client-side rendering alternative. Its `COGLayer` reads COG byte ranges directly via HTTP Range requests and renders pixels on the GPU — no tile server involved.

The frontend gets a tab bar on the raster detail page (matching the vector Explore tab pattern): **Tile Server** (default, existing behavior) and **Client Rendering** (COGLayer reading directly from MinIO via the existing `/storage` Vite proxy).

## Library

**Package:** `@developmentseed/deck.gl-geotiff` v0.3.0
**Peer deps:** `@deck.gl/*@^9.2.7`, `@deck.gl/mesh-layers@^9.2.7`, `@luma.gl/core@^9.2.6`
**API:** `new COGLayer({ id: string, geotiff: string })` — the `geotiff` prop accepts a URL to a COG file. The layer handles overview selection per zoom level, tiling, and reprojection internally.

The monorepo also ships `@developmentseed/deck.gl-raster` (low-level primitives) and `@developmentseed/geotiff` (COG reader), but `deck.gl-geotiff` is the high-level layer we use directly.

## Dependencies

### frontend/package.json

**Add:**
- `@developmentseed/deck.gl-geotiff@^0.3.0`

**Bump:**
- `@deck.gl/core`: `^9.0.0` → `^9.2.7`
- `@deck.gl/geo-layers`: `^9.0.0` → `^9.2.7`
- `@deck.gl/layers`: `^9.0.0` → `^9.2.7`
- `@deck.gl/react`: `^9.0.0` → `^9.2.7`

**Add (new peer deps):**
- `@deck.gl/mesh-layers@^9.2.7`
- `@luma.gl/core@^9.2.6`

This is a minor version bump within deck.gl v9. The existing `@geoarrow/deck.gl-layers@0.3.1` should be compatible (it also targets deck.gl 9).

## Changes

### 1. Backend: expose `cog_url` on Dataset

**`ingestion/src/models.py`** — Add field to `Dataset`:
```python
cog_url: str | None = None  # public-facing URL to the COG file (raster only)
```

**`ingestion/src/services/pipeline.py`** (line 262-288) — When constructing the `Dataset` for raster format pairs, set `cog_url` to the storage-proxy path. The COG is already uploaded at `converted_key` (e.g., `datasets/{id}/converted/data.tif`). Add alongside the existing `parquet_url` pattern:

```python
dataset = Dataset(
    ...
    cog_url=f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.RASTER else None,
    ...
)
```

This mirrors exactly how `parquet_url` is set for vectors (line 284):
```python
parquet_url=f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.VECTOR else None,
```

**`ingestion/src/services/temporal_pipeline.py`** (line 154) — Do NOT set `cog_url` for temporal datasets. Temporal rasters have multiple COGs and `COGLayer` reads individual files, not collections. The tab will only appear when `cog_url` is present.

### 2. Frontend type: add `cog_url`

**`frontend/src/types.ts`** — Add to `Dataset` interface (after `parquet_url`):
```typescript
cog_url?: string;  // raster only; direct URL to COG file via /storage proxy
```

### 3. New component: DirectRasterMap.tsx

**`frontend/src/components/DirectRasterMap.tsx`** — New component that renders a COG using `COGLayer`.

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
      [[west, Math.max(south, -MERCATOR_LIMIT)], [east, Math.min(north, MERCATOR_LIMIT)]],
      { padding: 40 }
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
      {/* Basemap selector and opacity slider — same pattern as RasterMap */}
      {/* Controls omitted from spec for brevity; follows RasterMap.tsx pattern */}
    </Box>
  );
}
```

Key decisions:
- **Absolute URL:** `COGLayer` needs a full URL for Range requests (not a relative path). Use `window.location.origin + dataset.cog_url` — same pattern as `VectorMap.tsx` which does `window.location.origin` for MapLibre tile sources.
- **No colormap/band controls:** `COGLayer` renders the COG's native pixel values. Adding GPU-side colormap application would require the lower-level `@developmentseed/deck.gl-raster` primitives — that's a follow-up.
- **Same basemap/viewport pattern:** Shares the same `BASEMAPS` map, `WebMercatorViewport` zoom fitting, and deck.gl + MapLibre composition as `RasterMap.tsx`.
- **Viewport is NOT shared between tabs:** Switching tabs resets the viewport to the initial fitted bounds. `RasterMap` already manages its own internal `viewState` (line 91) independently of `MapPage`'s state, so lifting viewport state would require changes to `RasterMap` too. Accepting this as a v1 limitation — both tabs fit to the same bounds on load, which is sufficient for comparison. Shared viewport can be added later by refactoring both components to accept `viewState`/`onViewStateChange` props.

### 4. MapPage.tsx: add rendering tab for rasters

**`frontend/src/pages/MapPage.tsx`** — Add a tab bar when displaying non-temporal raster datasets that have a `cog_url`.

**New import** (top of file):
```typescript
import { DirectRasterMap } from "../components/DirectRasterMap";
```

**New state** (after `activeTab` on line 28 — note: `activeTab` controls the side panel tabs in `CreditsPanel`; `rasterTab` controls the map rendering mode, which is a separate concern):
```typescript
const [rasterTab, setRasterTab] = useState<"server" | "client">("server");
```

**Modify the raster rendering block** (line 153-164). Replace the unconditional `<RasterMap>` with:

```typescript
{dataset.dataset_type === "raster" ? (
  <>
    {!dataset.is_temporal && dataset.cog_url && (
      <Flex position="absolute" top={3} left="50%" transform="translateX(-50%)" zIndex={10}>
        <Flex bg="white" borderRadius="6px" shadow="sm" overflow="hidden">
          <Box
            px={3} py={1} cursor="pointer" fontSize="sm" fontWeight={500}
            bg={rasterTab === "server" ? "brand.orange" : "white"}
            color={rasterTab === "server" ? "white" : "brand.brown"}
            onClick={() => setRasterTab("server")}
          >
            Tile Server
          </Box>
          <Box
            px={3} py={1} cursor="pointer" fontSize="sm" fontWeight={500}
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
        onTimestepChange={...}
      />
    )}
  </>
) : /* vector branch unchanged */}
```

The tab bar is positioned as a floating pill overlay at the top-center of the map, matching similar map overlay patterns (the basemap selector is top-left). It only renders for non-temporal rasters with a `cog_url`.

### What doesn't change

- **Temporal rasters:** No `cog_url` set, no tab shown, existing `RasterMap` behavior unchanged
- **Vector datasets:** Explore tab, PMTiles/tipg paths all unchanged
- **CreditsPanel:** No changes — tabs live on the map, not in the side panel
- **Existing RasterMap.tsx:** Zero modifications
- **Docker/MinIO/CORS:** Using `/storage` proxy avoids any CORS configuration
- **Vite proxy config:** `/storage` route already maps to MinIO, no changes needed

## Tests

### Backend

**`ingestion/tests/test_pipeline.py`** — Add one test:

1. **`test_raster_dataset_has_cog_url`** — After a raster pipeline run, assert `dataset.cog_url` starts with `/storage/datasets/` and ends with `.tif`. Assert vector datasets have `cog_url == None`.

### Frontend

No new unit tests. The `DirectRasterMap` component is a thin deck.gl wrapper with no testable business logic beyond what deck.gl itself handles. The integration is best verified by manual testing (upload a GeoTIFF, switch tabs, see if it renders).

## Scope summary

| What | Change |
|------|--------|
| `frontend/package.json` | 1 new dep, 4 bumped, 2 new peer deps |
| `frontend/src/types.ts` | Add `cog_url` field |
| `frontend/src/components/DirectRasterMap.tsx` | New file (~60 lines) |
| `frontend/src/pages/MapPage.tsx` | Add tab bar + conditional rendering (~25 lines) |
| `ingestion/src/models.py` | Add `cog_url` field |
| `ingestion/src/services/pipeline.py` | Set `cog_url` for raster datasets (1 line) |
| `ingestion/tests/test_pipeline.py` | Add 1 test |

## Risks and mitigations

1. **deck.gl version bump** (`^9.0.0` → `^9.2.7`): Minor version within v9. `@geoarrow/deck.gl-layers@0.3.1` also targets deck.gl 9. Mitigation: run existing frontend tests and manual smoke test after bump.
2. **COGLayer compatibility with untiled COGs**: The sandbox converts everything to tiled COGs, so this should be fine. If a user somehow uploads a pre-tiled COG that confuses the layer, the Tile Server tab still works.
3. **Large COGs**: `COGLayer` fetches overviews based on zoom level, so it won't try to load the entire file at once. Same principle as titiler.
4. **No colormap controls**: The Client Rendering tab renders native pixel values only. For single-band grayscale COGs, this may look different from the Tile Server tab which applies a viridis colormap. This is acceptable for a v1 comparison tool — the user can see the difference and understand the trade-off.
5. **`/storage` proxy is dev-only**: The Vite dev server proxy handles `/storage` → MinIO routing. If the sandbox were deployed behind nginx or similar, that proxy rule would need to be replicated (or CORS configured on MinIO). Not actionable now but worth noting.
