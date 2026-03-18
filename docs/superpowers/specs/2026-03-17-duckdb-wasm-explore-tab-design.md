# DuckDB-WASM Explore Tab for CNG Sandbox

**Date:** 2026-03-17
**Status:** Draft
**Scope:** Sandbox frontend + minor backend addition (one new field on Dataset model)

## Motivation

The CNG sandbox converts vector uploads through a pipeline: GeoJSON/Shapefile → GeoParquet → PMTiles. Both intermediate (GeoParquet) and final (PMTiles) formats already live in MinIO, accessible via HTTP. Today only the PMTiles are visualized.

DuckDB-WASM can query GeoParquet directly in the browser via HTTP range requests. Combined with `@geoarrow/deck.gl-layers` for zero-copy GPU rendering, this enables a powerful comparison: pre-tiled rendering (PMTiles) vs. live-queried rendering (DuckDB + GeoArrow) — same data, same map, two approaches.

This also gives users SQL query power over their uploaded data with no server-side compute.

### Prior art

- **[geospatial-atlas](https://github.com/do-me/geospatial-atlas)** — Svelte app using DuckDB-WASM + Mosaic for cross-filtered geospatial exploration. Heavy integration, full SQL interface.
- **[spatial-access-measures](https://github.com/developmentseed/spatial-access-measures)** — DevSeed app using the same stack as @maptool/core (React, deck.gl, Vite, Chakra UI) with DuckDB-WASM + GeoArrow layers. Simpler pattern, proven with our exact dependencies.

## Design

### Availability

The Explore tab appears automatically for any vector dataset that went through the PMTiles ingestion path — meaning both a GeoParquet file and `data.pmtiles` exist in MinIO at `datasets/{id}/converted/`. No user opt-in or configuration required.

Note: The GeoParquet filename preserves the original upload stem (e.g., `buildings.geojson` → `buildings.parquet`), not a fixed name like `data.parquet`. A new `parquet_url` field on the backend Dataset model provides the frontend with the correct URL (see Backend Change below).

Raster datasets and vector datasets that went through the tipg-only path (points without PMTiles) do not get the Explore tab. Note that point-only datasets do still have a GeoParquet intermediate in MinIO — this restriction could be relaxed in the future.

### Layout: Tabbed CreditsPanel

The existing CreditsPanel becomes a tabbed container with two tabs:

- **Credits** (default) — Existing content: tools used, validation results, raster metadata, expiry countdown. Map renders via `VectorMap` (MapLibre + PMTiles/tipg).
- **Explore** — New DuckDB query interface. Map renders via `DuckDBMap` (deck.gl + GeoArrow).

The active tab drives the map rendering mode. Tab state lives in MapPage and is passed down to the panel and map components. Switching tabs preserves the map viewport (center, zoom, pitch, bearing).

Basemap state (satellite/streets) currently lives inside each map component independently. This needs to be lifted to MapPage so the basemap choice is preserved when switching tabs.

### Explore Tab UI

The Explore tab stacks vertically in the right panel (30% width):

```
┌─────────────────────────┐
│ [Credits] [Explore]     │  tab bar
├─────────────────────────┤
│ ⏳ Loading DuckDB...    │  shown once on first click
├─────────────────────────┤
│ 3,241 of 12,847         │  feature count (updates on filter)
│ features                │
├─────────────────────────┤
│ ▼ Filters               │
│  population [===|===]   │  range slider (numeric)
│  category   [▾ multi ]  │  multi-select (string <20 unique)
│  year       [===|===]   │  range slider (numeric)
│  ...up to 8 auto...     │
│  [+ Add filter]         │
├─────────────────────────┤
│ ▼ SQL (collapsed)       │
│  ┌───────────────────┐  │
│  │ SELECT * FROM data │  │
│  │ WHERE pop > 1000   │  │
│  └───────────────────┘  │
│  [Run query]            │
├─────────────────────────┤
│ ▼ Column stats          │
│  population: 0 – 1.2M   │
│    avg 45K              │
│  category: 5 unique     │
│    [bar chart]          │
└─────────────────────────┘
```

### Auto-Filter Logic

On DuckDB initialization, run `SUMMARIZE` on the GeoParquet to get column metadata. Auto-generate filter controls for up to 8 columns, prioritized as:

1. Numeric columns with variance (skip constant columns)
2. String columns with 2–20 unique values (multi-select dropdowns)
3. Date/timestamp columns (range pickers)
4. Skip: geometry columns, columns named `id`/`fid`/`ogc_fid`, columns with all nulls

Additional columns available via "+ Add filter" button, which shows the full column list.

### Filter → Query → Render Pipeline

1. Visual filter changes are debounced (~300ms) and generate a SQL WHERE clause
2. Full query: `SELECT * FROM read_parquet('{minio_url}') WHERE {clauses}`
3. DuckDB executes the query, returns an Arrow table
4. `@geoarrow/deck.gl-layers` renders the Arrow table directly — zero serialization to GeoJSON
5. Summary stats recompute for the filtered subset

### SQL Editor Behavior

- Starts collapsed, showing a one-line preview of current generated SQL
- Expanding reveals a monospace textarea (not a full code editor)
- Visual filters generate SQL that the user can inspect and edit
- Editing SQL directly adds a "Custom SQL" badge and dims the visual filters
- "Reset to filters" button clears custom SQL and restores filter-driven mode

### Summary Stats

**Unfiltered (initial load):**
- Total feature count
- Geometry summary: "12,847 Polygons" or "Mixed: 10K Polygons, 2K Points"
- Per-column stats for auto-filtered columns: min, max, mean (numeric) or unique count + top values (categorical)
- Small bar chart for low-cardinality categorical columns

**Filtered:**
- Feature count updates: "3,241 of 12,847 features"
- Stats recompute for the filtered subset
- Bar charts show filtered distribution with ghost bars for full-dataset context

### Map Rendering

**Credits tab (existing, unchanged):**
- `VectorMap` component — MapLibre GL JS with PMTiles protocol or tipg MVT tiles
- Fill/line/circle layers with fixed styling
- Click popup showing feature properties

**Explore tab (new):**
- `DuckDBMap` component — deck.gl `DeckGL` instance with MapLibre basemap
- Renders via `@geoarrow/deck.gl-layers`: GeoArrowPolygonLayer, GeoArrowPathLayer, or GeoArrowScatterplotLayer — geometry type is detected from the Arrow result table (not from `dataset.geometry_types`) so custom SQL queries that transform geometry render correctly
- Same orange accent color (`#CF3F02`) as existing VectorMap
- Click on feature shows same popup style (reuse existing popup component)
- Basemap toggle (satellite/streets) — state lifted to parent MapPage, shared with VectorMap

**Viewport sync:**
- On tab switch, read current viewport from outgoing map, pass as initial state to incoming map
- VectorMap uses MapLibre's `{lng, lat}` format; DuckDBMap uses deck.gl's `{longitude, latitude}` format — a normalization step converts between them on switch

**Error states:**
- DuckDB-WASM fails to load (browser incompatibility, network error) → show error message: "DuckDB could not be loaded. Your browser may not support WebAssembly."
- GeoParquet fetch fails (MinIO down, file deleted) → show error with retry button
- Query execution error (bad SQL) → show DuckDB error message inline below the SQL editor

### Performance Guardrail

If a query returns >100,000 features, append `LIMIT 100000` and show a warning: "Showing first 100,000 features. Add filters to narrow results."

## Dependencies

**New npm packages (sandbox frontend only):**

| Package | Purpose |
|---------|---------|
| `@duckdb/duckdb-wasm` | DuckDB engine running in browser via WebAssembly |
| `apache-arrow` | Arrow JS for handling query result tables |
| `@geoarrow/deck.gl-layers` | Zero-copy Arrow table → deck.gl layer rendering |

No changes to `@maptool/core`. No new backend services or Docker containers.

## Backend Change

One small addition to the ingestion service:

**Add `parquet_url` field to the Dataset model.** The GeoParquet filename preserves the original upload stem (e.g., `buildings.geojson` → `buildings.parquet`), so the frontend cannot derive the URL from a fixed name. During ingestion, after the GeoParquet is uploaded to MinIO, store the MinIO key in a new `parquet_url` field on the Dataset. The frontend uses this to construct the DuckDB query URL.

**Files changed:**
- `sandbox/ingestion/src/models.py` — Add `parquet_url: str | None` to Dataset
- `sandbox/ingestion/src/services/pipeline.py` — Populate `parquet_url` with the MinIO key after `upload_converted`
- `sandbox/frontend/src/types.ts` — Add `parquet_url?: string` to Dataset type

## New Files

| File | Purpose |
|------|---------|
| `sandbox/frontend/src/hooks/useDuckDB.ts` | Initialize DuckDB-WASM, manage connection lifecycle, lazy-load on first use |
| `sandbox/frontend/src/hooks/useGeoParquetQuery.ts` | Run queries against GeoParquet, return Arrow tables + computed stats |
| `sandbox/frontend/src/components/ExploreTab.tsx` | Explore tab container: filters, SQL editor, stats |
| `sandbox/frontend/src/components/DuckDBMap.tsx` | deck.gl + GeoArrow map rendering for query results |
| `sandbox/frontend/src/components/FilterControls.tsx` | Auto-generated filter widgets (range sliders, multi-selects) |
| `sandbox/frontend/src/components/SqlEditor.tsx` | Collapsible SQL textarea with run button |
| `sandbox/frontend/src/hooks/useFilterQuery.ts` | Filter state → SQL generation logic, keeps ExploreTab manageable |

## Modified Files

| File | Change |
|------|--------|
| `sandbox/frontend/src/components/CreditsPanel.tsx` | Wrap in tabbed container with Credits + Explore tabs |
| `sandbox/frontend/src/pages/MapPage.tsx` | Conditional rendering: VectorMap vs DuckDBMap based on active tab; viewport sync; lift basemap state |
| `sandbox/frontend/src/types.ts` | Add `parquet_url?: string` to Dataset type |
| `sandbox/frontend/vite.config.ts` | WASM/worker configuration for DuckDB bundling; `optimizeDeps.exclude` for `@duckdb/duckdb-wasm` to prevent Vite from pre-bundling WASM files |
| `sandbox/ingestion/src/models.py` | Add `parquet_url` field to Dataset |
| `sandbox/ingestion/src/services/pipeline.py` | Populate `parquet_url` after GeoParquet upload |

## Data Access Path

```
Browser (DuckDB-WASM)
  → HTTP range requests (Range header required)
  → Vite dev proxy (/storage/ prefix)
  → MinIO (:9000)
  → datasets/{id}/converted/{original_stem}.parquet
```

The existing `/pmtiles/` proxy in `vite.config.ts` rewrites to MinIO. Add a new `/storage/` proxy alias pointing to the same MinIO backend — semantically clearer than routing GeoParquet through a `/pmtiles/` prefix. Both proxies target the same MinIO bucket.

**Range request verification:** DuckDB-WASM's HTTP filesystem relies on HTTP `Range` headers for efficient partial reads. The Vite proxy must forward these headers correctly. Verify during implementation that `Range` and `Content-Range` headers pass through; if not, configure the proxy to preserve them.

## What This Is Not

- **Not a replacement for PMTiles.** PMTiles remains the production serving format — fast, cacheable, scales to many users. DuckDB-WASM is the exploration format — full query power, client-side compute.
- **Not a library feature yet.** If the pattern proves out, `useDuckDB` and `createGeoArrowLayer` can be extracted into `@maptool/core` later.
- **Not a major backend change.** No new Docker services or API endpoints. One new field (`parquet_url`) added to the Dataset model during ingestion.

## Future Considerations

- Extract `useDuckDB` hook and `createGeoArrowLayer` into `@maptool/core` if the pattern works well
- Compute column stats during ingestion for instant Explore tab loading (Approach C from design discussion)
- Add attribute table view (currently scoped out)
- Support GeoParquet-only datasets (skip PMTiles entirely for small datasets)
