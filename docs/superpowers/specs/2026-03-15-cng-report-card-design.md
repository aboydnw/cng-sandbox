# CNG Report Card — Design Spec

**Date:** 2026-03-15
**Status:** Approved for implementation
**Context:** CNG Sandbox (`sandbox/`) — map page at `/map/{dataset-id}`

---

## Problem

The CNG Sandbox successfully converts data and renders it on a map, but a first-time uploader has no way to understand *what just happened* or *why it matters*. The credits panel names the tools but doesn't explain the value. A scientist wanting to advocate for CNG adoption within their organization needs concrete, quotable evidence — not a list of tool names.

---

## Goal

Give uploaders a passive, always-available summary of what their conversion achieved — in terms legible to a non-developer audience. The output should be something they can screenshot and share with a manager or program officer.

**Primary audience:** The uploader (scientist, GIS analyst, conservationist). Not the shared URL recipient.

**Message priority (informed by product discussion):**
1. **Portability** — anyone can view this, no software required
2. **Efficiency** — smaller, faster to load than the original
3. **Capabilities unlocked** — things now possible that weren't before
4. **Open source pipeline** — already covered by the existing credits panel

---

## Design Decision

**Option chosen: CNG Report Card — collapsible bottom drawer**

Rejected alternatives:
- *Enhanced credits panel* — sidebar already dense; insufficient space for visual stats
- *Before/After map toggle* — "before" state would require simulating a broken renderer, which feels contrived and sales-y. A live rendering comparison (e.g. GeoJSON vs PMTiles split map) is feasible but deferred — it only works for vector formats and is better suited as a future active feature once the passive baseline proves its value.

---

## UI Design

### Trigger

A **"See what changed →"** text button is added to the map page header (alongside the existing Share and New Upload buttons). Clicking it slides up the drawer from the bottom of the page. An ✕ button closes it.

Note: adding this button is a deliberate change to the map page header — the success criteria constraint "no changes to map layout" means no changes to the map canvas or credits panel specifically.

### Drawer layout

Full-width panel anchored to the bottom of the viewport (spanning both the map pane and the credits sidebar). Overlays content rather than pushing it up, so the map canvas is preserved. Contains:

**1. File header**
- Dataset filename
- Format transformation bar (format-dependent — see below)
- Visual gradient arrow from grey (original) to orange (CNG output)

**Vector transformation bar:**
`.shp Shapefile —— GeoPandas → tippecanoe ——→ .pmtiles PMTiles`

**Raster transformation bar:**
`.tif GeoTIFF —— rio-cogeo ——→ .tif COG` (or `.nc NetCDF —— xarray → rio-cogeo ——→ .tif COG` for NetCDF)

**2. Four stat cards in a 2×2 grid**

| Card | Content |
|------|---------|
| **File size** | Bar chart: original vs. converted size. Headline: "X% smaller". Below (vector only): feature count with geometry type label (see geometry_type handling). Sub-label: "Attributes, geometry, and CRS intact". Hidden feature section for raster. |
| **Data fetched for this view** | Highlighted card (orange border, "Live" badge). Large stat: bytes fetched since page load (see Performance API section). Comparison row: full file size vs. fetched so far. Sub-text: "Only the tiles you look at are ever fetched — pan or zoom to see this grow." |
| **To share this map** | Before: "Email a [X MB] file — `original_file_size` formatted to MB. ~[N min] to download on 4G (est.) — same formula as the estimated download time section. Recipient needs ArcGIS or QGIS." After: "Send a URL. Opens in any browser. No software required. No proprietary license." |
| **Now possible** | Checklist: shareable URL, zoom to any scale, click to inspect attributes (vector) / pixel values (raster), embed in any webpage, no proprietary license or specialized GIS server required. Footer: zoom range (e.g. "z3–z14"). |

**3. Footer**
- "Converted using open source tools maintained by Development Seed and the community. See the full pipeline →" (scrolls sidebar credits into view)

### Empty / loading states

The drawer is only accessible from `/map/{dataset-id}`, which the upload flow redirects to only after the SSE stream reports `ready`. The drawer trigger button is therefore never visible mid-conversion in the normal upload flow. For direct URL access to a dataset still processing, the map page's existing loading state handles that — the drawer trigger button should be hidden until `dataset.tile_url` is set.

If a stat field is `null` (e.g. a dataset ingested before these fields were added):
- Hide the affected sub-section within its card (not the whole card)
- Show `—` with a tooltip: "Not available for datasets converted before this feature launched"
- The drawer still renders; cards with no data gracefully collapse their affected rows

---

## Data Requirements

### Backend: new fields on dataset response

Extend `GET /api/datasets/{id}` with:

| Field | Source | Type | Notes |
|-------|--------|------|-------|
| `original_file_size` | Captured at upload/URL-fetch time, before conversion | `int` (bytes) | Store on the job record |
| `converted_file_size` | MinIO object size after conversion completes | `int` (bytes) | Query MinIO `stat_object` |
| `feature_count` | `len(gdf)` captured during GeoPandas conversion step | `int \| null` | `null` for raster |
| `geometry_types` | `gdf.geometry.geom_type.unique().tolist()` | `list[str] \| null` | e.g. `["Polygon"]` or `["Polygon", "MultiPolygon"]`; `null` for raster |
| `max_zoom` | tippecanoe stderr output (vector); `cogeo_mosaic.utils.get_zooms(src_path)[1]` for raster | `int` | |
| `min_zoom` | tippecanoe metadata (vector); `cogeo_mosaic.utils.get_zooms(src_path)[0]` for raster | `int` | `get_zooms()` returns `(min_zoom, max_zoom)` derived from native resolution — both values come from the same call |

**Note on `feature_count` source:** The vector pipeline converts GeoJSON/Shapefile → GeoParquet via GeoPandas before running tippecanoe. `len(gdf)` is available at that step and is the correct source. Do not attempt to parse tippecanoe stderr for feature counts.

**Note on `geometry_types`:** Store as an array using `gdf.geometry.geom_type.unique().tolist()`. The array order is arbitrary — do not treat the first element as dominant. For display, sort by frequency: `gdf.geometry.geom_type.value_counts().index.tolist()`. Render as the most-common type if only one, or a `/`-joined string if mixed: `"Polygon features"` vs `"Polygon / MultiPolygon features"`.

### Frontend: Performance API integration

The "data fetched for this view" stat is a **running total since page load**, not a per-viewport delta. Label it clearly as "fetched since page load" to avoid confusion.

Implementation — `useTileTransferSize` hook:
1. On mount, snapshot the current sum of `transferSize` across all matching Performance entries (baseline, typically 0 for tile requests at mount time)
2. Register a listener on the map's `idle` event
3. On each `idle`, re-sum matching entries and subtract the baseline snapshot
4. Return the running total in bytes

**URL pattern matching:**

Both raster and vector tile requests are same-origin: the Vite dev server proxies `/raster` → TiTiler and `/vector` → tipg, so the browser only ever sees same-origin URLs. The hook accepts a `tileUrlPrefix` parameter derived from `dataset.tile_url` (e.g. `/raster/` or `/vector/`) and filters Performance entries whose `name` starts with `window.location.origin + tileUrlPrefix`. This avoids fragile hardcoded path fragments and stays correct if routing changes.

**Raster vs. vector distinction:** For PMTiles (vector), the browser makes HTTP range requests directly against the `.pmtiles` file in MinIO — the Performance API entries reflect actual byte ranges of the source file. For COG tiles (raster), TiTiler performs the COG byte-range reads server-side and serves rendered PNG/WebP tiles to the browser. The Performance API entries for raster measure the rendered tile responses, not raw COG byte ranges. This is still an accurate and honest stat — "only the tiles you look at are rendered and fetched" is true for both paths — but the sub-text in the raster card should say "Only the tiles you look at are rendered and fetched" rather than implying direct range access.

**`transferSize` reliability — MinIO must send `Timing-Allow-Origin`:**

`performance.getEntriesByType('resource')` returns `transferSize = 0` for cross-origin requests unless the server includes `Timing-Allow-Origin: *`. MinIO does not set this by default.

Fix: add `Timing-Allow-Origin: *` to MinIO's response headers. In the sandbox docker-compose, this is configured via the MinIO environment or a proxy header rule. This is a required infrastructure change for this feature to work.

Fallback: if `transferSize` returns 0 for all entries (header not configured), the card displays "—" with a tooltip "Byte tracking requires server configuration — contact your admin." The "Live" badge is hidden in this state.

### Estimated download time formula

`seconds = original_file_size / 1_500_000` (assumes ~12 Mbps 4G throughput)

Display format: `~N min` for ≥ 60s, `~N sec` for < 60s. Always suffixed with `(est.)` in the UI.

---

## Raster vs Vector handling

| Format | File size card | Data fetched card | Features section |
|--------|---------------|------------------|-----------------|
| Vector (PMTiles) | `original_file_size` vs `converted_file_size` (.pmtiles) | sum of range request `transferSize`; "full file" baseline = `converted_file_size` | geometry type + count from `geometry_types` + `feature_count` |
| Raster (COG) | `original_file_size` vs `converted_file_size` (.cog) | sum of tile `transferSize`; "full file" baseline = `converted_file_size` (the COG being served, not the original GeoTIFF) | hidden |

**Note on "full file" baseline for "Data fetched" card:** The comparison is "X KB fetched vs Y MB total." "Total" means `converted_file_size` for both formats — it's the file actually being served. This makes the comparison honest: you fetched X KB of the Y MB PMTiles/COG file.

---

## What's deferred

- **Live split-map comparison** (GeoJSON vs PMTiles side-by-side) — feasible for vector only; deferred until passive baseline proves its value
- **Loading race / performance comparison** — requires more complex timing instrumentation
- **Per-viewport delta** for "data fetched" — the running total is simpler and honest; a per-viewport delta is a v2 refinement

---

## Success criteria

- A non-developer uploader can screenshot the drawer and explain CNG adoption to their manager using only what's on screen
- The "data fetched since page load" stat grows visibly as the user pans or zooms the map
- All stats are derived from real pipeline data — the only derived/estimated value is download time, which is labelled `(est.)`
- The map canvas and credits panel are unchanged; only the header gains a new button and the viewport gains a dismissible overlay
- Datasets missing new fields (older ingestions) degrade gracefully — the drawer renders with available data only
