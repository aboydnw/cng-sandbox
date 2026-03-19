# Pixel Inspector — Design Spec

## Summary

Add a hover-based pixel inspector to the client-side COG renderer (DirectRasterMap). When the user moves their cursor over the map, a floating tooltip displays the raw raster value and geographic coordinates at that point. This is the single most-requested feature in geospatial viewers and is only possible with client-side rendering — server-rendered PNG tiles discard raw pixel values.

## Scope

- Hover-only tooltip (no click-to-pin, no comparison panel — those are future work)
- Always on when DirectRasterMap is active (no toggle)
- Floating near cursor
- Works with single-band float32 COGs (the current DirectRasterMap capability)

## Architecture: tile data cache + coordinate lookup

Three approaches were evaluated:

1. **Tile data cache + manual coordinate lookup** (chosen) — retain raw float32 arrays from `getTileData`, reverse-map screen coordinates to tile pixels on hover
2. **GPU readback via deck.gl picking** — rejected because COGLayer's custom shader returns colorized uint8, not raw float32
3. **Offscreen canvas + readPixels** — rejected as unnecessarily complex for the same result

### Why approach 1

`getTileData` already fetches and decodes float32 arrays. We just keep a reference instead of discarding after normalization. No GPU readback, no extra rendering pass, no parallel pipeline.

## Data layer

### Tile cache

A `Map<string, TileCacheEntry>` stored as a `useRef` on DirectRasterMap, keyed by `"z/x/y"`:

```typescript
interface TileCacheEntry {
  data: Float32Array;
  width: number;
  height: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
}
```

### Population

In `getTileData`, after fetching the float32 array and before normalizing to uint8, store a reference in the cache. The tile's geographic bounds come from the COG metadata (the library provides tile extent information via the fetch options).

### Eviction

Entries are removed when tiles are unloaded. If COGLayer exposes an `onTileUnload` callback, use it. Otherwise, apply a simple LRU cap (e.g., 256 entries) to prevent unbounded memory growth.

### Memory cost

~4 bytes × width × height per tile. For 256×256 tiles, that's ~256KB per tile. With a 256-tile cap, worst case is ~64MB — acceptable for a developer/analyst tool.

## Coordinate lookup

### Screen → geographic

deck.gl's `onHover` event provides screen coordinates `[x, y]`. Convert to geographic coordinates using `viewport.unproject([x, y])` → `[lng, lat]`.

### Geographic → tile pixel

1. Scan the tile cache to find tiles whose bounds contain `[lng, lat]`
2. If multiple tiles match (overlapping zoom levels), pick the highest-zoom tile for best resolution
3. Convert to pixel offset within the tile:
   - `px = floor((lng - west) / (east - west) * width)`
   - `py = floor((north - lat) / (north - south) * height)` (y flipped — north is row 0)
4. Read `data[py * width + px]` → raw float32 value

### Edge cases

- **NaN / nodata**: Hide tooltip or show "No data"
- **Cursor outside all cached tiles**: Hide tooltip
- **Fast mouse movement**: Throttle updates via `requestAnimationFrame`

## Tooltip UI

### Position

Absolutely positioned `<div>` over the map, offset ~12px right and ~12px above the cursor. Follows the cursor on each hover event.

### Content

- **Primary line**: Band name + value + units when available from dataset metadata. Example: `Elevation: 2847.3 m`. Falls back to the raw value when metadata is missing: `2847.3`
- **Secondary line**: Coordinates formatted as `47.15°N, 11.42°E`, smaller and muted

### Metadata sources

- `dataset.band_names[0]` for the band name (if available)
- `dataset.dtype` for context (float32, int16, etc.)
- Units are not currently in the Dataset type — fall back to no units for now

### Styling

- White background, subtle box shadow, 4px border-radius
- Value: 13px, semibold, `brand.brown`
- Coordinates: 11px, regular, `brand.textSecondary`
- Matches existing DirectRasterMap control panels (opacity slider, basemap picker)
- `pointer-events: none` so the tooltip doesn't interfere with map interaction

### Visibility

- Hidden when cursor leaves the map
- Hidden when hovering over nodata pixels
- Hidden when no cached tile contains the cursor position

## Implementation scope

All changes are confined to `frontend/src/components/DirectRasterMap.tsx`:

1. Add `TileCacheEntry` type and `useRef` for the cache
2. Modify `getTileData` to store float32 data before normalization
3. Add `onHover` handler to DeckGL component
4. Add hover state (`{ x, y, lng, lat, value, bandName } | null`)
5. Add tooltip `<Box>` in the render, conditionally shown

No new files, no new dependencies, no backend changes.

## Future extensions

These are explicitly out of scope but informed the design:

- **Click-to-pin**: Drop persistent markers showing values. The tile cache already supports this — just store the looked-up value at a pinned coordinate.
- **Comparison panel**: Show pinned values in the sidebar. Would add a prop/callback to communicate pins to MapPage.
- **Multi-band**: Extend the tooltip to show values for all bands. Requires storing all bands in the cache, not just band 0.
- **Units**: Add a `units` field to the Dataset type, populated from COG metadata during ingestion.

## Test data

Copernicus DEM 90m (Alps), dataset ID `993133ee-d3c5-4c3d-a148-2a08c10e7eca`, float32 elevation data, bounds `[11.0, 47.0, 12.0, 48.0]`, range ~400–3800m.
