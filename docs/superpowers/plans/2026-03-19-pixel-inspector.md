# Pixel Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hover-based pixel inspector tooltip to DirectRasterMap that shows raw raster values and coordinates at the cursor position.

**Architecture:** Retain raw float32 tile data in a `Map` cache alongside GPU textures. On hover, convert screen coordinates to geographic via deck.gl's viewport, find the matching cached tile, compute pixel offset, and read the raw value. Display in a floating tooltip near the cursor.

**Tech Stack:** React, deck.gl (DeckGL `onHover`, `WebMercatorViewport`), TypeScript, Chakra UI

**Spec:** `docs/superpowers/specs/2026-03-19-pixel-inspector-design.md`

---

## File Structure

All changes in a single file:

- **Modify:** `frontend/src/components/DirectRasterMap.tsx` — add tile cache, hover handler, tooltip UI

No new files, no new dependencies, no backend changes.

---

### Task 1: Add tile data cache and populate it in getTileData

**Files:**
- Modify: `frontend/src/components/DirectRasterMap.tsx`

- [ ] **Step 1: Add TileCacheEntry type and cache ref**

Add after the `ViridisColorize` module definition (line 93), before the `DirectRasterMapProps` interface:

```typescript
interface TileCacheEntry {
  data: Float32Array;
  width: number;
  height: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
}

const MAX_CACHED_TILES = 256;
```

Add `useRef` to the React import on line 1 (`import { useState, useMemo, useCallback, useRef } from "react"`), then add in the component body after the existing `useState` calls:

```typescript
const tileCacheRef = useRef<Map<string, TileCacheEntry>>(new Map());
```

- [ ] **Step 2: Add tile-to-bounds helper function**

Add after the `localEpsgResolver` function (line 44), before `BASEMAPS`:

```typescript
/** Convert Web Mercator tile indices to geographic bounds [west, south, east, north]. */
function tileToBounds(x: number, y: number, z: number): [number, number, number, number] {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  const n2 = Math.PI - (2 * Math.PI * (y + 1)) / 2 ** z;
  return [
    (x / 2 ** z) * 360 - 180,               // west
    (Math.atan(Math.sinh(n2)) * 180) / Math.PI, // south
    ((x + 1) / 2 ** z) * 360 - 180,          // east
    (Math.atan(Math.sinh(n)) * 180) / Math.PI,  // north
  ];
}
```

- [ ] **Step 3: Populate cache in getTileData**

In the `getTileData` callback, destructure `z` from options alongside `x` and `y`:

```typescript
const { device, x, y, z, signal } = options;
```

After extracting `floatData` and before the null check (around line 142), add:

```typescript
// Cache raw float32 data for pixel inspector
const cacheKey = `${z}/${x}/${y}`;
const cache = tileCacheRef.current;
cache.set(cacheKey, {
  data: floatData,
  width,
  height,
  bounds: tileToBounds(x, y, z),
});
// Simple eviction: drop oldest entries when over cap
if (cache.size > MAX_CACHED_TILES) {
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) cache.delete(firstKey);
}
```

Note: `tileCacheRef` is a React ref (stable reference) — do NOT add it to the `useCallback` dependency array. Refs don't trigger re-renders.

Note: if `z` is not available on `options`, log `console.log("getTileData options:", Object.keys(options))` to discover what's available and adapt. The deck.gl TileLayer v9 standard provides `z` in its tile data callback.

- [ ] **Step 4: Verify the cache populates**

Rebuild the frontend container:

```bash
docker compose -f docker-compose.yml build frontend && docker compose -f docker-compose.yml up -d frontend
```

Open the Copernicus DEM dataset in the Client Rendering tab. Open browser console and verify no errors. Add a temporary `console.log` after the `cache.set` call:

```typescript
console.log(`[PixelInspector] cached tile ${cacheKey}, ${width}x${height}`);
```

Verify log messages appear as tiles load.

- [ ] **Step 5: Remove temporary console.log and commit**

Remove the temporary log line added in step 4.

```bash
cd frontend && git add src/components/DirectRasterMap.tsx && git commit -m "feat(pixel-inspector): add tile data cache in getTileData"
```

---

### Task 2: Add hover handler with coordinate lookup

**Files:**
- Modify: `frontend/src/components/DirectRasterMap.tsx`

- [ ] **Step 1: Add hover info state**

Add after the `tileCacheRef` declaration:

```typescript
const [hoverInfo, setHoverInfo] = useState<{
  x: number;
  y: number;
  lng: number;
  lat: number;
  value: number;
  bandName: string | null;
} | null>(null);
```

- [ ] **Step 2: Add value lookup helper**

Add after `tileToBounds`, before `BASEMAPS`:

```typescript
/** Look up raw raster value at a geographic point from the tile cache. */
function lookupValue(
  cache: Map<string, TileCacheEntry>,
  lng: number,
  lat: number,
): number | null {
  let bestEntry: TileCacheEntry | null = null;
  let bestZoom = -1;

  for (const [key, entry] of cache) {
    const [west, south, east, north] = entry.bounds;
    if (lng >= west && lng <= east && lat >= south && lat <= north) {
      const z = parseInt(key.split("/")[0], 10);
      if (z > bestZoom) {
        bestZoom = z;
        bestEntry = entry;
      }
    }
  }

  if (!bestEntry) return null;

  const [west, south, east, north] = bestEntry.bounds;
  const px = Math.floor(
    ((lng - west) / (east - west)) * bestEntry.width,
  );
  const py = Math.floor(
    ((north - lat) / (north - south)) * bestEntry.height,
  );

  if (px < 0 || px >= bestEntry.width || py < 0 || py >= bestEntry.height) {
    return null;
  }

  const val = bestEntry.data[py * bestEntry.width + px];
  if (val !== val) return null; // NaN check
  return val;
}
```

- [ ] **Step 3: Add onHover handler**

Add inside the component, after the `layers` useMemo:

```typescript
const onHover = useCallback(
  (info: any) => {
    if (!info.coordinate) {
      setHoverInfo(null);
      return;
    }
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
      bandName: dataset.band_names?.[0] ?? null,
    });
  },
  [dataset.band_names],
);
```

- [ ] **Step 4: Wire onHover to DeckGL**

Add the `onHover` prop to the `<DeckGL>` component:

```tsx
<DeckGL
  initialViewState={initialViewState}
  controller
  layers={layers}
  views={new MapView({ repeat: true })}
  onHover={onHover}
  onError={(error) => console.error("DeckGL error:", error.message)}
>
```

- [ ] **Step 5: Verify hover events fire**

Add a temporary log in the `onHover` handler:

```typescript
console.log("[PixelInspector] hover:", lng.toFixed(4), lat.toFixed(4), "value:", value);
```

Rebuild frontend, open the Copernicus DEM dataset, switch to Client Rendering tab, hover over the raster. Verify log messages show elevation values.

- [ ] **Step 6: Remove temporary log and commit**

```bash
cd frontend && git add src/components/DirectRasterMap.tsx && git commit -m "feat(pixel-inspector): add hover handler with coordinate lookup"
```

---

### Task 3: Add floating tooltip UI

**Files:**
- Modify: `frontend/src/components/DirectRasterMap.tsx`

- [ ] **Step 1: Add coordinate formatting helper**

Add after `lookupValue`, before `BASEMAPS`:

```typescript
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
```

- [ ] **Step 2: Add tooltip JSX**

Add the tooltip `<Box>` inside the return, as a sibling of the existing basemap selector and opacity control — right before the closing `</Box>` of the root container:

```tsx
{hoverInfo && (
  <Box
    position="absolute"
    left={`${hoverInfo.x + 12}px`}
    top={`${hoverInfo.y - 40}px`}
    bg="white"
    borderRadius="4px"
    shadow="sm"
    px={2}
    py={1}
    pointerEvents="none"
    zIndex={10}
    whiteSpace="nowrap"
  >
    <Text fontSize="13px" fontWeight={600} color="brand.brown">
      {hoverInfo.bandName
        ? `${hoverInfo.bandName}: ${formatValue(hoverInfo.value)}`
        : formatValue(hoverInfo.value)}
    </Text>
    <Text fontSize="11px" color="brand.textSecondary">
      {formatCoord(hoverInfo.lat, hoverInfo.lng)}
    </Text>
  </Box>
)}
```

- [ ] **Step 3: Rebuild and verify tooltip renders**

```bash
docker compose -f docker-compose.yml build frontend && docker compose -f docker-compose.yml up -d frontend
```

Open the Copernicus DEM dataset, switch to Client Rendering tab, hover over the raster. Verify:
1. Tooltip appears near the cursor showing a numeric value
2. Coordinates update as cursor moves
3. Tooltip disappears when cursor leaves the raster area
4. Tooltip doesn't interfere with pan/zoom (pointer-events: none)

Use Playwright MCP to take a screenshot for verification.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/DirectRasterMap.tsx && git commit -m "feat(pixel-inspector): add floating tooltip UI"
```

---

### Task 4: Final verification and cleanup

**Files:**
- Modify: `frontend/src/components/DirectRasterMap.tsx`

- [ ] **Step 1: Remove any remaining debug console.log statements**

Search for any `console.log` calls that were added during development (not the existing `console.error` calls which should stay).

- [ ] **Step 2: End-to-end verification**

Rebuild and test the full flow:

```bash
docker compose -f docker-compose.yml build frontend && docker compose -f docker-compose.yml up -d frontend
```

Verify with Playwright MCP:
1. Navigate to the Copernicus DEM dataset
2. Switch to Client Rendering tab
3. Hover over the rendered raster — tooltip shows elevation values
4. Move cursor off the raster — tooltip disappears
5. Pan and zoom still work normally
6. Switch back to Credits tab and back to Client Rendering — tooltip still works

- [ ] **Step 3: Commit final cleanup**

```bash
cd frontend && git add src/components/DirectRasterMap.tsx && git commit -m "chore: clean up pixel inspector debug logging"
```
