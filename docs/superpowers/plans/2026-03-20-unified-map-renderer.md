# Unified Map Renderer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the four separate map renderers (RasterMap, DirectRasterMap, VectorMap, DuckDBMap) into a single unified deck.gl-based component with shared camera state, as a prerequisite for the storytelling feature.

**Architecture:** A new `UnifiedMap` component wraps deck.gl with MapLibre as the basemap underlay. It accepts a `CameraState` (longitude, latitude, zoom, bearing, pitch) from the parent and reports changes via callback. Layer rendering is handled by composable layer-builder functions — one for server-side raster tiles, one for client-side COG, one for vector MVT/PMTiles, one for DuckDB GeoJSON. MapPage orchestrates which layer builder is active based on dataset type and tab selection. Feature-specific UI (colormap picker, band selector, opacity slider, temporal controls, hover inspector, feature popups) stays in dedicated overlay components rather than being baked into the map.

**Tech Stack:** React 19, deck.gl 9 (MVTLayer for vectors), MapLibre GL JS (basemap only), Chakra UI v3, Vitest

**Spec:** `docs/obsidian-notes/Project Docs/CNG Sandbox/cng-sandbox-storytelling-spec.md` (Resolved Question #1)

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/components/UnifiedMap.tsx` | Single map component: deck.gl + MapLibre basemap, accepts `CameraState`, renders layers from props |
| `frontend/src/lib/layers/rasterTileLayer.ts` | Builds deck.gl `TileLayer` for titiler server-side raster tiles |
| `frontend/src/lib/layers/cogLayer.ts` | Builds deck.gl `COGLayer` for client-side COG rendering (moved from DirectRasterMap) |
| `frontend/src/lib/layers/vectorLayer.ts` | Builds deck.gl `MVTLayer` for vector tiles (replaces MapLibre-native vector rendering) |
| `frontend/src/lib/layers/geojsonLayer.ts` | Builds deck.gl `GeoJsonLayer` for DuckDB Arrow table results |
| `frontend/src/lib/layers/types.ts` | Shared `CameraState` interface and layer builder types |
| `frontend/src/components/RasterControls.tsx` | Colormap picker, band selector, opacity slider (extracted from RasterMap) |
| `frontend/src/components/PixelInspector.tsx` | Hover tooltip showing raster pixel values (extracted from DirectRasterMap) |
| `frontend/src/components/VectorPopup.tsx` | Click popup showing vector feature properties (replaces MapLibre Popup) |
| `frontend/src/lib/layers/__tests__/rasterTileLayer.test.ts` | Unit tests for raster tile layer builder |
| `frontend/src/lib/layers/__tests__/vectorLayer.test.ts` | Unit tests for MVTLayer builder |
| `frontend/src/lib/layers/__tests__/geojsonLayer.test.ts` | Unit tests for GeoJSON layer builder |
| `frontend/src/components/__tests__/UnifiedMap.test.tsx` | Integration tests for UnifiedMap rendering |

### Modified files

| File | Changes |
|------|---------|
| `frontend/src/pages/MapPage.tsx` | Replace 4 map component imports with `UnifiedMap`; lift camera state; pass layer builders |

### Deleted files (after migration complete)

| File | Replaced by |
|------|-------------|
| `frontend/src/components/RasterMap.tsx` | `UnifiedMap` + `rasterTileLayer` + `RasterControls` |
| `frontend/src/components/DirectRasterMap.tsx` | `UnifiedMap` + `cogLayer` + `PixelInspector` |
| `frontend/src/components/VectorMap.tsx` | `UnifiedMap` + `vectorLayer` + `VectorPopup` |
| `frontend/src/components/DuckDBMap.tsx` | `UnifiedMap` + `geojsonLayer` |

---

## Task 1: Define CameraState and layer builder types

**Files:**
- Create: `frontend/src/lib/layers/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
import { WebMercatorViewport } from "@deck.gl/core";

export interface CameraState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export const DEFAULT_CAMERA: CameraState = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

export function cameraFromBounds(
  bounds: [number, number, number, number],
  viewportSize = { width: 800, height: 600 },
): CameraState {
  const [west, south, east, north] = bounds;
  const MERCATOR_LIMIT = 85.051129;
  const viewport = new WebMercatorViewport(viewportSize);
  const { longitude, latitude, zoom } = viewport.fitBounds(
    [
      [west, Math.max(south, -MERCATOR_LIMIT)],
      [east, Math.min(north, MERCATOR_LIMIT)],
    ],
    { padding: 40 },
  );
  return { longitude, latitude, zoom, bearing: 0, pitch: 0 };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `layers/types.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/layers/types.ts
git commit -m "feat: add CameraState type and helpers for unified map"
```

---

## Task 2: Extract raster tile layer builder

**Files:**
- Create: `frontend/src/lib/layers/rasterTileLayer.ts`
- Create: `frontend/src/lib/layers/__tests__/rasterTileLayer.test.ts`
- Reference: `frontend/src/components/RasterMap.tsx:140-155` (current layer creation)

This extracts the tile layer construction logic from RasterMap into a pure function.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/layers/__tests__/rasterTileLayer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildRasterTileLayers } from "../rasterTileLayer";

describe("buildRasterTileLayers", () => {
  it("returns a single layer for non-temporal dataset", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 0.8,
      isTemporalActive: false,
    });
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toBe("raster-tile-0");
  });

  it("returns N layers for temporal dataset with opacity toggle", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 0.8,
      isTemporalActive: true,
      timesteps: [
        { datetime: "2020-01-01", index: 0 },
        { datetime: "2020-02-01", index: 1 },
        { datetime: "2020-03-01", index: 2 },
      ],
      activeTimestepIndex: 1,
    });
    expect(layers).toHaveLength(3);
    // Active layer gets full opacity, others get 0
    expect(layers[1].props.opacity).toBe(0.8);
    expect(layers[0].props.opacity).toBe(0);
    expect(layers[2].props.opacity).toBe(0);
  });

  it("appends datetime param for temporal layers", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 1,
      isTemporalActive: true,
      timesteps: [{ datetime: "2020-01-01", index: 0 }],
      activeTimestepIndex: 0,
    });
    expect(layers[0].props.data).toContain("datetime=2020-01-01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/layers/__tests__/rasterTileLayer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/layers/rasterTileLayer.ts`:

```typescript
import { createCOGLayer } from "../maptool";
import type { Timestep } from "../../types";

interface RasterTileLayerOptions {
  tileUrl: string;
  opacity: number;
  isTemporalActive: boolean;
  timesteps?: Timestep[];
  activeTimestepIndex?: number;
  onViewportLoad?: (index: number) => () => void;
}

export function buildRasterTileLayers({
  tileUrl,
  opacity,
  isTemporalActive,
  timesteps = [],
  activeTimestepIndex = 0,
  onViewportLoad,
}: RasterTileLayerOptions) {
  if (!isTemporalActive) {
    return [
      createCOGLayer({
        id: "raster-tile-0",
        tileUrl,
        opacity,
      }),
    ];
  }

  return timesteps.map((ts, i) =>
    createCOGLayer({
      id: `raster-ts-${i}`,
      tileUrl: `${tileUrl}&datetime=${ts.datetime}`,
      opacity: i === activeTimestepIndex ? opacity : 0,
      onViewportLoad: onViewportLoad?.(i),
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/layers/__tests__/rasterTileLayer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/layers/rasterTileLayer.ts frontend/src/lib/layers/__tests__/rasterTileLayer.test.ts
git commit -m "feat: extract raster tile layer builder from RasterMap"
```

---

## Task 3: Build vector MVTLayer builder

**Files:**
- Create: `frontend/src/lib/layers/vectorLayer.ts`
- Create: `frontend/src/lib/layers/__tests__/vectorLayer.test.ts`
- Reference: `frontend/src/components/VectorMap.tsx:21-72` (current MapLibre layer setup)

This is the key migration: moving vector tile rendering from MapLibre-native layers to deck.gl's MVTLayer.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/layers/__tests__/vectorLayer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildVectorLayer } from "../vectorLayer";

describe("buildVectorLayer", () => {
  it("creates an MVTLayer with correct tile URL for non-PMTiles", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/collections/public.sandbox_abc123/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
    });
    expect(layer.id).toBe("vector-mvt");
    expect(layer.props.data).toContain("/vector/collections/");
  });

  it("creates an MVTLayer with pmtiles URL", () => {
    const layer = buildVectorLayer({
      tileUrl: "/pmtiles/sandbox_abc123.pmtiles",
      isPMTiles: true,
      opacity: 0.6,
    });
    expect(layer.id).toBe("vector-mvt");
  });

  it("is pickable for feature interaction", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/collections/public.sandbox_abc123/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
    });
    expect(layer.props.pickable).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/layers/__tests__/vectorLayer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/layers/vectorLayer.ts`:

**PMTiles compatibility note:** deck.gl's `MVTLayer` uses `fetch()` internally, not MapLibre's protocol system. A `pmtiles://` URL would fail with a network error. For PMTiles sources, we use the `pmtiles` library's `PMTiles` class to extract individual tiles via a custom `fetch` in `loadOptions`. For regular MVT tiles (from tipg), we use a standard URL.

```typescript
import { MVTLayer } from "@deck.gl/geo-layers";
import { PMTiles } from "pmtiles";
import { BRAND_COLOR_RGBA } from "../../components/MapShell";

const FILL_COLOR: [number, number, number, number] = [BRAND_COLOR_RGBA[0], BRAND_COLOR_RGBA[1], BRAND_COLOR_RGBA[2], 77];
const LINE_COLOR: [number, number, number, number] = [BRAND_COLOR_RGBA[0], BRAND_COLOR_RGBA[1], BRAND_COLOR_RGBA[2], 255];

interface VectorLayerOptions {
  tileUrl: string;
  isPMTiles: boolean;
  opacity: number;
  onHover?: (info: any) => void;
  onClick?: (info: any) => void;
}

export function buildVectorLayer({
  tileUrl,
  isPMTiles,
  opacity,
  onHover,
  onClick,
}: VectorLayerOptions) {
  if (isPMTiles) {
    // PMTiles: use the pmtiles library to fetch tiles directly.
    // MVTLayer doesn't support the pmtiles:// protocol — we provide
    // a placeholder tile URL template and override fetch via loadOptions.
    const absoluteUrl = `${window.location.origin}${tileUrl}`;
    const pmtilesSource = new PMTiles(absoluteUrl);

    return new MVTLayer({
      id: "vector-mvt",
      // MVTLayer needs a data URL template with {z}/{x}/{y}.
      // We intercept all fetches via loadOptions.fetch, so the URL is never actually hit.
      data: `${absoluteUrl}/{z}/{x}/{y}.pbf`,
      opacity,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      getFillColor: FILL_COLOR,
      getLineColor: LINE_COLOR,
      getLineWidth: 1.5,
      lineWidthMinPixels: 1,
      getPointRadius: 4,
      pointRadiusMinPixels: 3,
      pointType: "circle",
      stroked: true,
      filled: true,
      onHover,
      onClick,
      loadOptions: {
        fetch: async (url: string, context: any) => {
          // Parse z/x/y from the URL template we constructed
          const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
          if (!match) return new Response(null, { status: 404 });
          const [, z, x, y] = match.map(Number);
          const tile = await pmtilesSource.getZxy(z, x, y);
          if (!tile?.data) return new Response(null, { status: 404 });
          return new Response(tile.data);
        },
      },
    });
  }

  // Regular MVT tiles from tipg
  const data = tileUrl.startsWith("/")
    ? `${window.location.origin}${tileUrl}`
    : tileUrl;

  return new MVTLayer({
    id: "vector-mvt",
    data,
    opacity,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 60],
    getFillColor: FILL_COLOR,
    getLineColor: LINE_COLOR,
    getLineWidth: 1.5,
    lineWidthMinPixels: 1,
    getPointRadius: 4,
    pointRadiusMinPixels: 3,
    pointType: "circle",
    stroked: true,
    filled: true,
    onHover,
    onClick,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/layers/__tests__/vectorLayer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/layers/vectorLayer.ts frontend/src/lib/layers/__tests__/vectorLayer.test.ts
git commit -m "feat: add MVTLayer-based vector layer builder"
```

---

## Task 4: Extract GeoJSON layer builder

**Files:**
- Create: `frontend/src/lib/layers/geojsonLayer.ts`
- Create: `frontend/src/lib/layers/__tests__/geojsonLayer.test.ts`
- Reference: `frontend/src/components/DuckDBMap.tsx:22-72`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/layers/__tests__/geojsonLayer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildGeoJsonLayer, arrowTableToGeoJSON } from "../geojsonLayer";

describe("buildGeoJsonLayer", () => {
  it("returns empty array when geojson is null", () => {
    const layers = buildGeoJsonLayer({ geojson: null });
    expect(layers).toHaveLength(0);
  });

  it("returns empty array when feature collection is empty", () => {
    const layers = buildGeoJsonLayer({
      geojson: { type: "FeatureCollection", features: [] },
    });
    expect(layers).toHaveLength(0);
  });

  it("returns a GeoJsonLayer when features exist", () => {
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { name: "test" },
        },
      ],
    };
    const layers = buildGeoJsonLayer({ geojson });
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toBe("geojson-layer");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/layers/__tests__/geojsonLayer.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/layers/geojsonLayer.ts`:

```typescript
import { GeoJsonLayer } from "@deck.gl/layers";
import { BRAND_COLOR_RGBA } from "../../components/MapShell";
import type { Table } from "apache-arrow";

const FILL_COLOR = [...BRAND_COLOR_RGBA, 180] as [number, number, number, number];
const LINE_COLOR = [...BRAND_COLOR_RGBA, 255] as [number, number, number, number];

export function arrowTableToGeoJSON(table: Table): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const row = table.get(i);
    if (!row) continue;
    const geojsonStr = row.__geojson;
    if (!geojsonStr) continue;
    const properties: Record<string, unknown> = {};
    for (const field of table.schema.fields) {
      if (field.name === "__geojson") continue;
      properties[field.name] = row[field.name];
    }
    features.push({
      type: "Feature",
      geometry: JSON.parse(geojsonStr),
      properties,
    });
  }
  return { type: "FeatureCollection", features };
}

interface GeoJsonLayerOptions {
  geojson: GeoJSON.FeatureCollection | null;
}

export function buildGeoJsonLayer({ geojson }: GeoJsonLayerOptions) {
  if (!geojson || geojson.features.length === 0) return [];

  return [
    new GeoJsonLayer({
      id: "geojson-layer",
      data: geojson,
      getFillColor: FILL_COLOR,
      getLineColor: LINE_COLOR,
      getLineWidth: 1.5,
      lineWidthMinPixels: 1,
      getPointRadius: 4,
      pointRadiusMinPixels: 3,
      stroked: true,
      filled: true,
      pickable: true,
    }),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/layers/__tests__/geojsonLayer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/layers/geojsonLayer.ts frontend/src/lib/layers/__tests__/geojsonLayer.test.ts
git commit -m "feat: extract GeoJSON layer builder from DuckDBMap"
```

---

## Task 5: Build COG client-side layer builder

**Files:**
- Create: `frontend/src/lib/layers/cogLayer.ts`
- Reference: `frontend/src/components/DirectRasterMap.tsx:14-285` (all COG rendering logic)

Extracts the entire client-side COG rendering pipeline from DirectRasterMap into a standalone module. This includes the EPSG resolver, tile cache management, WebGL texture creation, value normalization, and the Viridis shader.

- [ ] **Step 1: Create cogLayer.ts**

Create `frontend/src/lib/layers/cogLayer.ts`:

```typescript
import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import { CreateTexture } from "@developmentseed/deck.gl-raster/gpu-modules";
import wktParser from "wkt-parser";

// --- EPSG resolver (offline for common CRSes, network fallback) ---

const EPSG_DEFS: Record<number, any> = {
  4326: {
    projName: "longlat",
    name: "WGS 84",
    srsCode: "WGS 84",
    ellps: "WGS 84",
    a: 6378137,
    rf: 298.257223563,
    axis: "neu",
    units: "degree",
  },
  3857: {
    projName: "merc",
    name: "WGS 84 / Pseudo-Mercator",
    srsCode: "WGS 84 / Pseudo-Mercator",
    ellps: "WGS 84",
    a: 6378137,
    rf: 298.257223563,
    axis: "enu",
    units: "metre",
  },
};

async function localEpsgResolver(epsg: number) {
  if (EPSG_DEFS[epsg]) return EPSG_DEFS[epsg];
  const resp = await fetch(`https://epsg.io/${epsg}.json`);
  if (!resp.ok) throw new Error(`Failed to fetch EPSG:${epsg}`);
  const projjson = await resp.json();
  const parsed = wktParser(projjson);
  EPSG_DEFS[epsg] = parsed;
  return parsed;
}

// --- WebGL helpers ---

function padToAlignment(
  src: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const rowBytes = width;
  const alignedRowBytes = Math.ceil(rowBytes / 4) * 4;
  if (alignedRowBytes === rowBytes) return src;
  const dst = new Uint8Array(alignedRowBytes * height);
  for (let r = 0; r < height; r++) {
    dst.set(src.subarray(r * rowBytes, (r + 1) * rowBytes), r * alignedRowBytes);
  }
  return dst;
}

const ViridisColorize = {
  name: "viridis-colorize",
  inject: {
    "fs:DECKGL_FILTER_COLOR": `
      float t = color.r;
      if (t <= 0.0) { discard; }
      vec3 c0 = vec3(0.267, 0.004, 0.329);
      vec3 c1 = vec3(0.282, 0.140, 0.458);
      vec3 c2 = vec3(0.127, 0.566, 0.551);
      vec3 c3 = vec3(0.544, 0.773, 0.247);
      vec3 c4 = vec3(0.993, 0.906, 0.144);
      vec3 rgb;
      if (t < 0.25) rgb = mix(c0, c1, t * 4.0);
      else if (t < 0.5) rgb = mix(c1, c2, (t - 0.25) * 4.0);
      else if (t < 0.75) rgb = mix(c2, c3, (t - 0.5) * 4.0);
      else rgb = mix(c3, c4, (t - 0.75) * 4.0);
      color = vec4(rgb, 1.0);
    `,
  },
};

// --- Tile cache for pixel inspector ---

export interface TileCacheEntry {
  data: Float32Array;
  width: number;
  height: number;
  bounds: [number, number, number, number];
}

const MAX_CACHED_TILES = 256;

// --- COG layer builder ---

interface CogLayerOptions {
  cogUrl: string;
  opacity: number;
  rasterMin: number;
  rasterMax: number;
  datasetBounds: [number, number, number, number] | null;
  tileCacheRef: React.MutableRefObject<Map<string, TileCacheEntry>>;
}

export function buildCogLayer({
  cogUrl,
  opacity,
  rasterMin,
  rasterMax,
  datasetBounds,
  tileCacheRef,
}: CogLayerOptions) {
  const url = window.location.origin + cogUrl;
  const range = rasterMax - rasterMin || 1;

  const getTileData = async (image: any, options: any) => {
    const { device, x, y, signal } = options;
    const tile = await image.fetchTile(x, y, {
      boundless: false,
      signal,
    });
    const arr = tile.array;
    const { width, height } = arr;

    let floatData: Float32Array;
    if (arr.layout === "band-separate") {
      floatData = arr.bands[0];
    } else {
      floatData = arr.data;
    }

    if (!floatData || !(floatData instanceof Float32Array)) {
      console.error("[cogLayer] unexpected data type:", floatData);
      return { texture: null, width: 0, height: 0 };
    }

    // Cache raw float data for pixel inspector
    if (datasetBounds) {
      const cacheKey = `${x}/${y}`;
      const cache = tileCacheRef.current;
      cache.set(cacheKey, {
        data: new Float32Array(floatData),
        width,
        height,
        bounds: datasetBounds,
      });
      while (cache.size > MAX_CACHED_TILES) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
    }

    // Normalize float32 to uint8 [0, 255]
    const pixelCount = width * height;
    const uint8 = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const v = floatData[i];
      if (v !== v) {
        uint8[i] = 0;
        continue;
      }
      uint8[i] = Math.round(
        Math.max(0, Math.min(255, ((v - rasterMin) / range) * 255)),
      );
    }

    const textureData = padToAlignment(uint8, width, height);

    const texture = device.createTexture({
      data: textureData,
      format: "r8unorm",
      width,
      height,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    return { texture, width, height };
  };

  const renderTile = (data: any) => [
    { module: CreateTexture, props: { textureName: data.texture } },
    { module: ViridisColorize },
  ];

  return [
    new COGLayer({
      id: "direct-cog-layer",
      geotiff: url,
      opacity,
      getTileData,
      renderTile,
    } as any),
  ];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/layers/cogLayer.ts
git commit -m "feat: extract COG client-side layer builder from DirectRasterMap"
```

---

## Task 6: Build the UnifiedMap component (forwardRef for deckRef)

**Files:**
- Create: `frontend/src/components/UnifiedMap.tsx`
- Reference: `frontend/src/components/MapShell.tsx` (basemap styles, BasemapPicker)

This is the core new component. It renders deck.gl with MapLibre basemap and accepts layers + camera state from the parent.

- [ ] **Step 1: Create UnifiedMap**

Create `frontend/src/components/UnifiedMap.tsx`:

```typescript
import { forwardRef, useCallback } from "react";
import { Box } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import type { Layer } from "@deck.gl/core";
import type { CameraState } from "../lib/layers/types";
import { BASEMAPS, BasemapPicker } from "./MapShell";

interface UnifiedMapProps {
  camera: CameraState;
  onCameraChange: (camera: CameraState) => void;
  layers: Layer[];
  basemap: string;
  onBasemapChange: (basemap: string) => void;
  onHover?: (info: any) => void;
  onClick?: (info: any) => void;
  getTooltip?: (info: any) => any;
  children?: React.ReactNode;
}

export const UnifiedMap = forwardRef<any, UnifiedMapProps>(function UnifiedMap(
  {
    camera,
    onCameraChange,
    layers,
    basemap,
    onBasemapChange,
    onHover,
    onClick,
    getTooltip,
    children,
  },
  ref,
) {
  const handleViewStateChange = useCallback(
    ({ viewState }: { viewState: any }) => {
      onCameraChange({
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        bearing: viewState.bearing ?? 0,
        pitch: viewState.pitch ?? 0,
      });
    },
    [onCameraChange],
  );

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        ref={ref}
        viewState={camera}
        onViewStateChange={handleViewStateChange}
        controller={{ dragRotate: true }}
        layers={layers}
        views={new MapView({ repeat: true })}
        onHover={onHover}
        onClick={onClick}
        getTooltip={getTooltip}
      >
        <Map mapStyle={BASEMAPS[basemap]} />
      </DeckGL>

      <Box
        position="absolute"
        top={3}
        left={3}
        bg="white"
        borderRadius="4px"
        shadow="sm"
        p={1}
      >
        <BasemapPicker value={basemap} onChange={onBasemapChange} />
      </Box>

      {children}
    </Box>
  );
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `UnifiedMap.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/UnifiedMap.tsx
git commit -m "feat: add UnifiedMap component with shared camera state"
```

---

## Task 7: Extract RasterControls overlay

**Files:**
- Create: `frontend/src/components/RasterControls.tsx`
- Reference: `frontend/src/components/RasterMap.tsx:188-253` (control panel UI)

Extracts the colormap picker, band selector, and opacity slider into a standalone overlay component.

- [ ] **Step 1: Create RasterControls**

Create `frontend/src/components/RasterControls.tsx`:

```typescript
import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import { listColormaps } from "../lib/maptool";
import { BRAND_COLOR } from "./MapShell";

const COLORMAP_NAMES = listColormaps();

interface BandInfo {
  name: string;
  index: number;
}

interface RasterControlsProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  colormapName: string;
  onColormapChange: (colormap: string) => void;
  showColormap: boolean;
  bands?: BandInfo[];
  hasRgb?: boolean;
  selectedBand: "rgb" | number;
  onBandChange: (band: "rgb" | number) => void;
  showBands: boolean;
}

export function RasterControls({
  opacity,
  onOpacityChange,
  colormapName,
  onColormapChange,
  showColormap,
  bands = [],
  hasRgb = false,
  selectedBand,
  onBandChange,
  showBands,
}: RasterControlsProps) {
  return (
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
      {showBands && (
        <Box>
          <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
            Band
          </Text>
          <NativeSelect.Root size="xs">
            <NativeSelect.Field
              value={String(selectedBand)}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const val = e.target.value;
                onBandChange(val === "rgb" ? "rgb" : Number(val));
              }}
            >
              {hasRgb && <option value="rgb">RGB</option>}
              {bands.map((b) => (
                <option key={b.index} value={String(b.index)}>
                  {b.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>
      )}
      {showColormap && (
        <Box>
          <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
            Colormap
          </Text>
          <NativeSelect.Root size="xs">
            <NativeSelect.Field
              value={colormapName}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onColormapChange(e.target.value)
              }
            >
              {COLORMAP_NAMES.map((cm) => (
                <option key={cm} value={cm}>
                  {cm}
                </option>
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
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          style={{ width: 80, accentColor: BRAND_COLOR }}
        />
      </Box>
    </Flex>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/RasterControls.tsx
git commit -m "feat: extract RasterControls overlay from RasterMap"
```

---

## Task 8: Extract PixelInspector overlay

**Files:**
- Create: `frontend/src/components/PixelInspector.tsx`
- Reference: `frontend/src/components/DirectRasterMap.tsx:46-96,141-148,287-318,364-398`

Extracts the hover tooltip with pixel value lookup. The tile cache and lookup logic move here.

- [ ] **Step 1: Create PixelInspector**

Create `frontend/src/components/PixelInspector.tsx`:

```typescript
import { useState, useCallback, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import type { TileCacheEntry } from "../lib/layers/cogLayer";

function lookupValue(
  cache: Map<string, TileCacheEntry>,
  lng: number,
  lat: number,
): number | null {
  let bestEntry: TileCacheEntry | null = null;
  let bestRes = Infinity;

  for (const [, entry] of cache) {
    const [west, south, east, north] = entry.bounds;
    if (lng >= west && lng <= east && lat >= south && lat <= north) {
      const res = (east - west) / entry.width;
      if (res < bestRes) {
        bestRes = res;
        bestEntry = entry;
      }
    }
  }

  if (!bestEntry) return null;

  const [west, south, east, north] = bestEntry.bounds;
  const px = Math.floor(((lng - west) / (east - west)) * bestEntry.width);
  const py = Math.floor(((north - lat) / (north - south)) * bestEntry.height);

  if (px < 0 || px >= bestEntry.width || py < 0 || py >= bestEntry.height) {
    return null;
  }

  const val = bestEntry.data[py * bestEntry.width + px];
  if (val !== val) return null;
  return val;
}

function formatCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) return value.toFixed(1);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  if (Math.abs(value) >= 0.01) return value.toFixed(4);
  return value.toPrecision(4);
}

interface HoverInfo {
  x: number;
  y: number;
  lng: number;
  lat: number;
  value: number;
  bandName: string | null;
}

interface PixelInspectorProps {
  tileCacheRef: React.MutableRefObject<Map<string, TileCacheEntry>>;
  bandNames: string[] | null;
}

export function usePixelInspector(
  tileCacheRef: React.MutableRefObject<Map<string, TileCacheEntry>>,
  bandNames: string[] | null,
) {
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  const onHover = useCallback(
    (info: any) => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
      }
      if (!info.coordinate) {
        hoverRafRef.current = null;
        setHoverInfo(null);
        return;
      }
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const [lng, lat] = info.coordinate;
        const value = lookupValue(tileCacheRef.current, lng, lat);
        if (value === null) {
          setHoverInfo(null);
          return;
        }
        setHoverInfo({
          x: info.x,
          y: info.y,
          lng,
          lat,
          value,
          bandName: bandNames?.[0]?.match(/^Band \d+$/i)
            ? null
            : (bandNames?.[0] ?? null),
        });
      });
    },
    [tileCacheRef, bandNames],
  );

  return { hoverInfo, onHover };
}

interface PixelInspectorTooltipProps {
  hoverInfo: HoverInfo;
}

export function PixelInspectorTooltip({ hoverInfo }: PixelInspectorTooltipProps) {
  return (
    <Box
      position="absolute"
      left={`${hoverInfo.x + 14}px`}
      top={`${hoverInfo.y - 44}px`}
      bg="rgba(15, 23, 42, 0.88)"
      backdropFilter="blur(8px)"
      borderRadius="6px"
      border="1px solid rgba(255,255,255,0.08)"
      shadow="lg"
      px={2.5}
      py={1.5}
      pointerEvents="none"
      zIndex={10}
      whiteSpace="nowrap"
    >
      <Text fontSize="13px" fontWeight={600} fontFamily="mono" color="white" lineHeight="1.2">
        {formatValue(hoverInfo.value)}
        {hoverInfo.bandName && (
          <Text as="span" fontSize="11px" fontWeight={400} color="whiteAlpha.600" ml={1.5}>
            {hoverInfo.bandName}
          </Text>
        )}
      </Text>
      <Text fontSize="10px" fontFamily="mono" color="whiteAlpha.500" mt={0.5} lineHeight="1.2">
        {formatCoord(hoverInfo.lat, hoverInfo.lng)}
      </Text>
    </Box>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PixelInspector.tsx
git commit -m "feat: extract PixelInspector overlay from DirectRasterMap"
```

---

## Task 9: Extract VectorPopup overlay

**Files:**
- Create: `frontend/src/components/VectorPopup.tsx`
- Reference: `frontend/src/components/VectorMap.tsx:74-97` (popup click handler)

Replaces MapLibre's native `Popup` with a React-rendered overlay for feature properties. Uses deck.gl's `onClick` info object.

- [ ] **Step 1: Create VectorPopup**

Create `frontend/src/components/VectorPopup.tsx`:

```typescript
import { useState, useCallback } from "react";
import { Box, Text } from "@chakra-ui/react";

interface PopupInfo {
  x: number;
  y: number;
  properties: Record<string, unknown>;
}

export function useVectorPopup() {
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const onClick = useCallback((info: any) => {
    if (!info.object) {
      setPopup(null);
      return;
    }
    const properties = info.object.properties ?? info.object;
    setPopup({
      x: info.x,
      y: info.y,
      properties,
    });
  }, []);

  const dismiss = useCallback(() => setPopup(null), []);

  return { popup, onClick, dismiss };
}

interface VectorPopupOverlayProps {
  popup: PopupInfo;
  onDismiss: () => void;
}

export function VectorPopupOverlay({ popup, onDismiss }: VectorPopupOverlayProps) {
  return (
    <Box
      position="absolute"
      left={`${popup.x}px`}
      top={`${popup.y}px`}
      bg="white"
      borderRadius="6px"
      shadow="lg"
      border="1px solid"
      borderColor="gray.200"
      p={3}
      maxW="300px"
      maxH="400px"
      overflow="auto"
      zIndex={10}
      onClick={(e) => e.stopPropagation()}
    >
      <Box
        as="button"
        position="absolute"
        top={1}
        right={1}
        fontSize="xs"
        color="gray.400"
        onClick={onDismiss}
        cursor="pointer"
        bg="none"
        border="none"
        p={1}
      >
        ✕
      </Box>
      {Object.entries(popup.properties).map(([k, v]) => (
        <Box key={k} mb={1}>
          <Text as="span" fontSize="xs" fontWeight={600} color="gray.600">
            {k}:{" "}
          </Text>
          <Text as="span" fontSize="xs" color="gray.800">
            {String(v)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/VectorPopup.tsx
git commit -m "feat: add VectorPopup overlay for deck.gl vector interactions"
```

---

## Task 10: Rewrite MapPage — lift state and wire UnifiedMap

**Files:**
- Modify: `frontend/src/pages/MapPage.tsx`
- Reference: All layer builders (Tasks 2-5), UnifiedMap (Task 6), overlays (Tasks 7-9)

This is the integration task. It's large, so follow these sub-steps carefully. The implementing agent MUST:
1. Read the current `MapPage.tsx` in full first
2. Read all new layer builder files and overlay files
3. Preserve ALL existing behavior: temporal animation, colormap, band selection, preloading, export, COG client rendering, DuckDB explore tab, vector popups

**Note:** PMTiles protocol registration is no longer needed at the app level. The `vectorLayer.ts` builder uses the `pmtiles` library directly via `loadOptions.fetch`. Remove any `addProtocol`/`removeProtocol` calls for PMTiles.

### Sub-step 10a: Replace imports and lift state

Replace the imports and state declarations in MapPage. Key changes:
- Remove imports: `RasterMap`, `DirectRasterMap`, `VectorMap`, `DuckDBMap`, `MapViewState`
- Add imports: `UnifiedMap`, `RasterControls`, `PixelInspectorTooltip`, `usePixelInspector`, `VectorPopupOverlay`, `useVectorPopup`, layer builders, `CameraState`, `buildCogLayer`
- Replace `viewState: MapViewState` with `camera: CameraState` (with `DEFAULT_CAMERA` initial value)
- Lift raster-specific state (opacity, colormapName, selectedBand) from RasterMap into MapPage
- Add `tileCacheRef` for pixel inspector and `deckRef` for temporal export
- Add `useVectorPopup()` and `usePixelInspector()` hooks

### Sub-step 10b: Wire layer selection

Add a `layers` useMemo that selects the right layer builder:

```typescript
const layers = useMemo(() => {
  if (!dataset) return [];

  if (dataset.dataset_type === "raster") {
    if (activeTab === "client" && canClientRender) {
      return buildCogLayer({
        cogUrl: dataset.cog_url!,
        opacity,
        rasterMin: dataset.raster_min ?? 0,
        rasterMax: dataset.raster_max ?? 1,
        datasetBounds: dataset.bounds,
        tileCacheRef,
      });
    }
    return buildRasterTileLayers({
      tileUrl,
      opacity,
      isTemporalActive: dataset.is_temporal,
      timesteps: dataset.timesteps,
      activeTimestepIndex: animation.activeIndex,
      onViewportLoad: getLoadCallback,
    });
  }

  if (activeTab === "explore" && geojson) {
    return buildGeoJsonLayer({ geojson });
  }

  return [buildVectorLayer({
    tileUrl: dataset.tile_url,
    isPMTiles: dataset.tile_url.startsWith("/pmtiles/"),
    opacity: 1,
    onClick: vectorPopup.onClick,
  })];
}, [dataset, activeTab, canClientRender, tileUrl, opacity, colormapName,
    effectiveBand, animation.activeIndex, geojson, vectorPopup.onClick]);
```

The `tileUrl` computation (colormap, band, rescale params) must be preserved from the current RasterMap logic. Port it into a `useMemo` in MapPage.

### Sub-step 10c: Wire event handlers and tooltip

- For raster server-side: no hover/click handlers needed
- For COG client-side: pass `pixelInspector.onHover` as the `onHover` prop to UnifiedMap
- For vector: pass `vectorPopup.onClick` as the `onClick` prop to UnifiedMap
- For DuckDB explore: pass a `getTooltip` function to UnifiedMap that shows feature properties on hover (ported from DuckDBMap lines 87-94):

```typescript
const getTooltip = useMemo(() => {
  if (dataset?.dataset_type !== "vector" || activeTab !== "explore") return undefined;
  return ({ object }: { object?: Record<string, unknown> }) => {
    if (!object) return null;
    const props = Object.entries(object)
      .filter(([k]) => k !== "geometry" && k !== "geom")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    return { text: props, style: { fontSize: "12px" } };
  };
}, [dataset?.dataset_type, activeTab]);
```

### Sub-step 10d: Wire overlay rendering

Render overlays as children of UnifiedMap:

```typescript
<UnifiedMap
  ref={deckRef}
  camera={camera}
  onCameraChange={setCamera}
  layers={layers}
  basemap={basemap}
  onBasemapChange={setBasemap}
  onHover={activeTab === "client" && canClientRender ? pixelInspector.onHover : undefined}
  onClick={dataset?.dataset_type === "vector" && activeTab !== "explore" ? vectorPopup.onClick : undefined}
  getTooltip={getTooltip}
>
  {/* Raster controls (server-side or client-side raster) */}
  {dataset?.dataset_type === "raster" && (
    <RasterControls
      opacity={opacity}
      onOpacityChange={setOpacity}
      colormapName={colormapName}
      onColormapChange={setColormapName}
      showColormap={showingColormap}
      bands={selectableBands}
      hasRgb={hasRgb}
      selectedBand={selectedBand}
      onBandChange={setSelectedBand}
      showBands={isMultiBand && activeTab !== "client"}
    />
  )}

  {/* Map legend for raster with colormap */}
  {showingColormap && activeTab !== "client" && (
    <Box position="absolute" bottom={3} left={3}>
      <MapLegend
        layers={[{
          type: "continuous" as const,
          id: "raster",
          title: dataset!.filename,
          domain,
          colors,
        }]}
      />
    </Box>
  )}

  {/* Temporal controls */}
  {dataset?.is_temporal && activeTab !== "client" && (
    <TemporalControls
      timesteps={dataset.timesteps}
      activeIndex={animation.activeIndex}
      onIndexChange={animation.setActiveIndex}
      isPlaying={animation.isPlaying}
      onTogglePlay={animation.togglePlay}
      speed={animation.speed}
      onSpeedChange={animation.setSpeed}
      preloadProgress={preloadProgress}
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

  {/* Pixel inspector tooltip (COG client rendering) */}
  {pixelInspector.hoverInfo && activeTab === "client" && (
    <PixelInspectorTooltip hoverInfo={pixelInspector.hoverInfo} />
  )}

  {/* Vector feature popup */}
  {vectorPopup.popup && dataset?.dataset_type === "vector" && activeTab !== "explore" && (
    <VectorPopupOverlay popup={vectorPopup.popup} onDismiss={vectorPopup.dismiss} />
  )}
</UnifiedMap>
```

### Sub-step 10e: Preserve remaining MapPage structure

Everything outside the map rendering area stays the same:
- Loading/error states (lines 78-109)
- Header with ShareButton, ReportCard button, New Upload link (lines 131-160)
- CreditsPanel sidebar with tabs, ExploreTab, clientRenderContent (lines 202-239)
- ReportCard modal (lines 243-248)

The temporal hooks (`useTemporalAnimation`, `useTemporalExport`) and preload tracking (`loadedRef`, `loadedCount`, `getLoadCallback`) move from RasterMap into MapPage. Port the entire temporal pre-rendering logic from RasterMap lines 84-155.

- [ ] **Step 1: Rewrite MapPage following sub-steps 10a-10e above**

The implementing agent must read the current MapPage.tsx and all referenced files before writing.

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors

- [ ] **Step 3: Run all existing tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/MapPage.tsx
git commit -m "refactor: rewrite MapPage to use UnifiedMap with layer builders"
```

---

## Task 11: Delete old map components and clean up PMTiles registration

**Files:**
- Delete: `frontend/src/components/RasterMap.tsx`
- Delete: `frontend/src/components/DirectRasterMap.tsx`
- Delete: `frontend/src/components/VectorMap.tsx`
- Delete: `frontend/src/components/DuckDBMap.tsx`

Only do this after Task 10 is verified working.

- [ ] **Step 1: Verify no remaining imports of old components**

Run: `cd frontend && grep -r "from.*RasterMap\|from.*DirectRasterMap\|from.*VectorMap\|from.*DuckDBMap" src/ --include="*.tsx" --include="*.ts"`

Expected: No results (all imports should now reference UnifiedMap + layer builders)

- [ ] **Step 2: Delete old files**

```bash
cd frontend
rm src/components/RasterMap.tsx
rm src/components/DirectRasterMap.tsx
rm src/components/VectorMap.tsx
rm src/components/DuckDBMap.tsx
```

- [ ] **Step 3: Verify build still passes**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -u frontend/src/components/
git commit -m "refactor: remove old map components replaced by UnifiedMap"
```

---

## Task 12: Add layers index export

**Files:**
- Create: `frontend/src/lib/layers/index.ts`

Clean barrel export for the layers module.

- [ ] **Step 1: Create index file**

Create `frontend/src/lib/layers/index.ts`:

```typescript
export { type CameraState, DEFAULT_CAMERA, cameraFromBounds } from "./types";
export { buildRasterTileLayers } from "./rasterTileLayer";
export { buildCogLayer } from "./cogLayer";
export type { TileCacheEntry } from "./cogLayer";
export { buildVectorLayer } from "./vectorLayer";
export { buildGeoJsonLayer, arrowTableToGeoJSON } from "./geojsonLayer";
```

- [ ] **Step 2: Update imports in MapPage to use barrel**

Replace individual layer imports in `MapPage.tsx` with:

```typescript
import {
  type CameraState,
  DEFAULT_CAMERA,
  cameraFromBounds,
  buildRasterTileLayers,
  buildVectorLayer,
  buildGeoJsonLayer,
  arrowTableToGeoJSON,
} from "../lib/layers";
```

- [ ] **Step 3: Verify it compiles and tests pass**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: All green

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/layers/index.ts frontend/src/pages/MapPage.tsx
git commit -m "refactor: add layers barrel export and clean up imports"
```

---

## Task 13: Visual verification

**Files:** None (manual testing)

Use the dev server and Playwright MCP to verify all map rendering paths still work.

- [ ] **Step 1: Start the Docker stack**

Run: `cd /home/anthony/projects/cng-sandbox && docker compose up -d --build`

- [ ] **Step 2: Verify raster dataset — server-side tiles**

Navigate to a raster dataset's map page. Verify:
- Map renders with tiles from titiler
- Basemap picker works
- Colormap picker changes colormap
- Opacity slider works
- Legend displays

- [ ] **Step 3: Verify raster dataset — client-side COG tab**

Switch to "Client" tab. Verify:
- COG renders via deck.gl-geotiff
- Pixel inspector tooltip appears on hover
- Opacity slider works

- [ ] **Step 4: Verify temporal raster dataset**

Navigate to a temporal raster dataset. Verify:
- Animation plays (temporal controls work)
- Frame switching is smooth
- Preload progress indicator shows

- [ ] **Step 5: Verify vector dataset**

Navigate to a vector dataset. Verify:
- Vector features render (fills, lines, points)
- Click shows popup with feature properties
- Basemap picker works

- [ ] **Step 6: Verify DuckDB explore tab**

Switch to "Explore" tab on a vector dataset. Run a query. Verify:
- GeoJSON features render on map
- Tooltip shows properties on hover

- [ ] **Step 7: Verify camera state is shared**

On a vector dataset, switch between "Credits" tab (vector view) and "Explore" tab (DuckDB view). Verify:
- Camera position (zoom, center) is preserved across tab switches
- Bearing and pitch are maintained

- [ ] **Step 8: Take screenshots of each verification step**

Save to `/tmp/unified-map-*.png` for review.

- [ ] **Step 9: Commit any fixes needed**

```bash
git add -A frontend/src/
git commit -m "fix: address issues found during visual verification"
```
