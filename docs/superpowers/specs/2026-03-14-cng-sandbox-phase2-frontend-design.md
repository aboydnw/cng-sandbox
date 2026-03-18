# CNG Sandbox Phase 2: Frontend — Design Spec

## Overview

The frontend is a React single-page application that provides the user-facing experience for the CNG Sandbox: upload a geospatial file, watch it convert, see it on a map, and share the URL. It connects to two backends: the Ingestion API (Phase 1) for uploads and job tracking, and eoAPI services for tile serving.

**Goal:** Upload to shareable map URL in under 5 minutes.

**Tech stack:** React 19, TypeScript, Vite, Chakra UI, @maptool/core (deck.gl + MapLibre), react-router-dom.

### Prerequisites (backend changes needed)

Phase 1 built the ingestion service but the frontend requires two additions:

1. **Add `bounds` field to `Dataset` model** — `bounds: list[float]` (west, south, east, north). Populated from STAC item bbox (raster) or GeoDataFrame total_bounds (vector) during pipeline execution. Required for auto-zoom.
2. **Add `POST /api/convert-url` route** — Accepts `{"url": "https://..."}`, fetches the file, and starts the same pipeline as `/api/upload`. The implementation plan specified this endpoint but it was not built in Phase 1.

These are small additions to existing code and should be included as the first chunk of the Phase 2 implementation plan.

### Deviations from implementation plan

- **No separate `SharedPage`** — The implementation plan (section 2E) described a separate `SharedPage.tsx` for shared URLs. This design consolidates it into a single `MapPage` that serves both the uploader and the link recipient. One code path, same experience.
- **Phase 3 items pulled forward** — The product spec's phased build plan separates "Phase 2: Map Preview UI" from "Phase 3: Full Experience Page + CTAs." This design rolls Phase 3 items (ExpiredPage, branded header, credits panel with CTAs) into Phase 2 since they are small and integral to the v1 experience. No separate Phase 3 plan is needed.

---

## Architecture

### Data flow

```
Frontend (Vite + React 19)
  │
  ├── Ingestion API (:8000)
  │     POST /api/upload         → file upload
  │     GET  /api/jobs/:id/stream → SSE progress
  │     GET  /api/datasets/:id   → dataset metadata (type, tile URL, credits, validation)
  │
  └── eoAPI Services
        :8082 titiler-pgstac     → raster tiles (COG via STAC)
        :8083 tipg               → vector tiles (MVT from PostgreSQL)
        :8081 STAC API           → metadata
```

The frontend talks to both: Ingestion API for the upload/job lifecycle, eoAPI directly for tile rendering. The `/api/datasets/:id` response includes the appropriate tile URL so the frontend doesn't need to construct eoAPI URLs itself.

### Project structure

```
sandbox/frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx                 # Router: /, /map/:id, /expired/:id
│   ├── theme.ts                # Chakra UI theme (Dev Seed brand)
│   ├── config.ts               # API URLs from env vars
│   ├── pages/
│   │   ├── UploadPage.tsx      # Single-page flow: upload → progress → redirect
│   │   ├── MapPage.tsx         # Map + credits sidebar (uploader + recipient)
│   │   └── ExpiredPage.tsx     # 30-day expiry landing
│   ├── components/
│   │   ├── Header.tsx          # Dev Seed branded header
│   │   ├── FileUploader.tsx    # Drag-drop zone + URL input
│   │   ├── ProgressTracker.tsx # SSE-driven step indicator
│   │   ├── CreditsPanel.tsx    # Sidebar: tools, validation, CTAs
│   │   ├── ShareButton.tsx     # Copy URL to clipboard
│   │   ├── RasterMap.tsx       # deck.gl COG layer via @maptool/core
│   │   └── VectorMap.tsx       # MapLibre native MVT source
│   ├── hooks/
│   │   └── useConversionJob.ts # SSE subscription + job state machine
│   └── types.ts                # Shared types (Job, Dataset, etc.)
```

---

## Design Decisions

### Single-page upload flow

The upload experience is a single page (`/`) that transitions through three stages without navigation:

1. **Upload** — Drop zone + URL input
2. **Processing** — SSE-driven progress tracker (Scanning → Converting → Validating → Ingesting → Ready)
3. **Redirect** — When status reaches `READY`, `navigate('/map/${datasetId}')` fires

The URL stays at `/` during stages 1–2. Only updates to `/map/:id` when the map is ready. This creates a seamless flow without page jumps.

### Chakra UI (not Tailwind)

The spec originally called for Tailwind. We use Chakra UI instead because:
- @maptool/core's `MapToolProvider` wraps `ChakraProvider` — all library components expect Chakra's theme context
- All 11 test apps use Chakra — consistent patterns and proven integration
- Custom theme extends Chakra's default with Dev Seed brand tokens

### Raster rendering: deck.gl via @maptool/core

Raster datasets (COG from GeoTIFF/NetCDF conversion) render through:
- `useTitiler` hook pointed at titiler-pgstac (`:8082`)
- `createCOGLayer` for deck.gl tile layer
- `useColorScale` + `MapLegend` for colormap display
- Auto-zoom to extent from STAC item bounding box

This reuses the library's existing infrastructure rather than building MapLibre raster source integration from scratch.

### Vector rendering: MapLibre native MVT

Vector datasets (GeoParquet from Shapefile/GeoJSON conversion) render through:
- MapLibre's built-in vector tile source pointed at tipg (`:8083`)
- Data-driven styling via MapLibre style spec
- Smart defaults based on geometry type: fill+stroke for polygons, lines for linestrings, circles for points
- Optional attribute-based coloring dropdown (simple choropleth with a numeric property)
- `FeatureTooltip` from @maptool/core for click inspection

We use MapLibre native MVT (not a deck.gl layer) because tipg serves standard MVT tiles, and MapLibre handles these natively with better performance than translating through deck.gl.

### Same page for uploader and recipient

`/map/:id` serves one `MapPage` component for everyone. No conditional rendering based on "how you got here." Both the uploader (who just finished the flow) and a link recipient (opening cold) see:
- Map with data layer (raster or vector, auto-detected from dataset metadata)
- Credits sidebar (30% width on desktop)
- Share button in header
- "New upload" button in header

One code path. The recipient sees the same branded experience the spec describes.

### Upload-first landing page

The root URL (`/`) is the upload zone — no hero section, no explainer. The tagline "See your data on the web" and the format list in the drop zone provide enough context. The credits panel after conversion handles discovery and education.

---

## Pages

### UploadPage (`/`)

**Stage 1: Upload**
- Centered drop zone with drag-and-drop support
- File picker button (whitelisted extensions: .tif, .tiff, .shp, .geojson, .json, .nc)
- "Or paste a URL" input with Fetch button (S3, GCS, HTTP)
- 1 GB max shown in drop zone
- On file select or URL submit: POST to `/api/upload`, transition to stage 2
- Shapefile handling: accept only `.zip` files containing `.shp` + companion files (`.dbf`, `.shx`, `.prj`). Phase 1's upload route already handles `.zip` as a shapefile format. Individual `.shp` upload without companions is not supported — the drop zone instructions make this clear.

**Stage 2: Processing**
- Filename + size displayed at top
- Vertical step indicator with 5 stages: Scanning, Converting, Validating, Ingesting, Ready
- Each step shows: spinner (active), checkmark (done), or empty circle (pending)
- Completed steps show detail text (e.g., "Format: GeoTIFF → COG", "rio-cogeo + GDAL")
- Driven by `useConversionJob` hook subscribing to SSE at `/api/jobs/:id/stream`
- On error: step turns red with plain-language error message from the API
- On `READY`: auto-navigate to `/map/:datasetId`

### MapPage (`/map/:id`)

**Layout:** Header + content area split 70/30 (map / sidebar).

**Header:**
- Dev Seed logo + "CNG Sandbox" branding (left)
- Share button (orange, primary) + "New upload" button (secondary) (right)

**Map area (70%):**
- Full-height map (fills viewport below header)
- Renders raster or vector based on `dataset.dataset_type` from `/api/datasets/:id`
- **Raster path:** `useTitiler` + `createCOGLayer` + `MapLegend` + opacity slider + colormap selector
- **Vector path:** MapLibre vector source from tipg + smart default styling + optional attribute dropdown
- Basemap toggle (streets, satellite, dark) via `LayerSelector`
- Auto-zoom to dataset extent on load
- `FeatureTooltip` for click inspection (vector) or pixel value display (raster)

**Credits sidebar (30%):**
- "How this was made" section header (uppercase label)
- List of tools with name, description, and link — dynamic based on conversion path:
  - Raster: rio-cogeo, TiTiler, pgSTAC, MapLibre
  - Vector: GeoPandas, tipg, pgSTAC, MapLibre
- "Validation" section: "8/8 checks passed" (green) or warning/failure details
- "What's next" section: "Turn this into a story →", "Talk to Development Seed →"
- Expiry countdown: "Expires in N days"
- Mobile: not polished for v1, but the sidebar should stack below the map at narrow viewports using a simple CSS breakpoint (no bottom sheet complexity)

**Data loading:**
- `useEffect` on mount: fetch `/api/datasets/:id`
- Shows a centered spinner while the dataset fetch is in flight
- If dataset not found (404) or expired: redirect to `/expired/:id`
- If fetch fails with network error: show inline error with retry button
- Dataset response includes: `dataset_type` (raster/vector), `tile_url`, `bounds`, `stac_collection_id`, `validation_results`, `credits`, `created_at`
- Expiry is checked once on load (computed from `created_at` + 30 days). No polling — if the dataset expires while the page is open, it continues to work until the user refreshes.

### ExpiredPage (`/expired/:id`)

- Centered message: "This map has expired"
- Explanation: "Sandbox maps are available for 30 days"
- Two CTAs: "Upload again" (→ `/`) and "Talk to Dev Seed" (→ external link)
- This is the highest-intent CTA surface per the spec — the person clicked a link weeks later

---

## Components

### Header

Dev Seed branded header bar. White background, `ds` logo mark in orange (placeholder for real SVG), "CNG Sandbox" text. Right side accepts children for action buttons.

### FileUploader

Drag-and-drop zone using native HTML drag events (no library dependency). Contains:
- Drop zone with file type icons and format list
- Hidden `<input type="file">` triggered by "Browse files" button
- Accept attribute filters to whitelisted extensions (`.tif`, `.tiff`, `.zip`, `.geojson`, `.json`, `.nc`)
- URL input with Fetch button
- `onFileSelected(file: File)` and `onUrlSubmitted(url: string)` callbacks
- Validates file extension client-side before upload; shows inline error for unsupported formats

### ProgressTracker

Renders 5 steps as a vertical stepper. Receives current `JobStatus` from `useConversionJob`. Each step has three visual states: pending (gray circle), active (orange spinner), done (green checkmark). Error state turns the active step red with the error message.

### CreditsPanel

Sidebar content for MapPage. Receives `Dataset` object and renders:
- Tool credits (filtered by `dataset.dataset_type`)
- Validation results summary
- "What's next" links
- Expiry countdown (computed from `dataset.created_at`)

### ShareButton

Copies `window.location.href` to clipboard using `navigator.clipboard.writeText()`. Shows brief "Copied!" toast via Chakra's `useToast`.

### RasterMap

Wraps @maptool/core's deck.gl integration for raster datasets:
- `useTitiler` with the tile URL from dataset metadata
- `createCOGLayer` for the tile layer
- `useColorScale` for colormap state
- `MapLegend` overlay
- Opacity slider (Chakra `Slider`)
- Colormap selector dropdown

### VectorMap

MapLibre map with native vector tile source for vector datasets:
- Adds tipg MVT source on mount
- Auto-detects geometry type from first feature and applies default style
- Renders attribute dropdown for choropleth coloring (numeric columns only)
- `FeatureTooltip` from @maptool/core for click inspection

---

## Hooks

### useConversionJob

Manages the SSE connection to `/api/jobs/:id/stream` and exposes job state.

```typescript
interface StageInfo {
  name: string;        // "Scanning", "Converting", "Validating", "Ingesting", "Ready"
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;     // e.g., "Format: GeoTIFF → COG", "rio-cogeo + GDAL"
}

interface ConversionJobState {
  jobId: string | null;
  status: JobStatus;
  datasetId: string | null;
  error: string | null;
  stages: StageInfo[];
}

function useConversionJob(): {
  state: ConversionJobState;
  startUpload: (file: File) => Promise<void>;
  startUrlFetch: (url: string) => Promise<void>;
};
```

- `startUpload` POSTs the file to `/api/upload`, gets back `job_id`, opens SSE connection
- `startUrlFetch` POSTs the URL to `/api/convert-url`, same flow
- SSE events update `status` and `stages` reactively
- On `READY` event: sets `datasetId` for the parent to trigger navigation
- On error event: sets `error` with the plain-language message
- Cleans up EventSource on unmount
- SSE reconnection: relies on `EventSource`'s built-in reconnection (browser retries automatically with backoff). No custom retry logic needed for v1 — conversions are short enough that a dropped connection during processing is rare.

---

## Branding

### Dev Seed brand tokens

```typescript
const dsTheme = {
  colors: {
    brand: {
      orange: '#CF3F02',
      orangeHover: '#b83800',
      brown: '#443F3F',
      bgSubtle: '#f5f3f0',
      border: '#e8e5e0',
      textSecondary: '#7a7474',
      success: '#2a7d3f',
    }
  }
};
```

### Visual style
- Light theme with white backgrounds
- Orange (`#CF3F02`) for primary CTAs, links, active states
- Dark brown (`#443F3F`) for text
- Subtle warm gray (`#f5f3f0`) for backgrounds and hover states
- Clean borders (`#e8e5e0`), no heavy shadows
- Uppercase labels with letter spacing for section headers
- Buttons: orange bg + white text (primary), warm gray bg + brown text (secondary)
- Border radius: 4px for buttons and inputs, 6px for panels

---

## API Integration

### Port assignment

The sandbox frontend runs on port **5185** — the next available port after the 11 test apps (which end at 5184). This should be added to the port table in the project's CLAUDE.md.

### Vite dev proxy

In local development, Vite proxies API requests to avoid CORS:

```typescript
// vite.config.ts
server: {
  host: true,
  port: 5185,
  proxy: {
    '/api': 'http://localhost:8000',
  }
}
```

The frontend uses relative URLs (`/api/upload`) in development. In production, a reverse proxy handles routing.

### Config

```typescript
// config.ts
export const config = {
  apiBase: import.meta.env.VITE_API_BASE || '',
  rasterTilerUrl: import.meta.env.VITE_RASTER_TILER_URL || 'http://localhost:8082',
  vectorTilerUrl: import.meta.env.VITE_VECTOR_TILER_URL || 'http://localhost:8083',
};
```

### Endpoints consumed

| Endpoint | Used by | Purpose |
|----------|---------|---------|
| `POST /api/upload` | useConversionJob | File upload, returns job_id |
| `POST /api/convert-url` | useConversionJob | URL fetch, returns job_id |
| `GET /api/jobs/:id/stream` | useConversionJob | SSE progress updates |
| `GET /api/datasets/:id` | MapPage | Dataset metadata, tile URL, validation |
| `GET :8082/collections/:col/items/:item/tiles/{z}/{x}/{y}` | RasterMap | Raster tiles via titiler-pgstac |
| `GET :8083/collections/sandbox_:id/tiles/{z}/{x}/{y}` | VectorMap | Vector tiles via tipg |

---

## Testing Strategy

- **Unit tests (Vitest + jsdom):** useConversionJob hook (mock SSE), CreditsPanel rendering, ProgressTracker state transitions, config loading
- **Component tests:** FileUploader drag-and-drop behavior, ShareButton clipboard interaction
- **E2E tests (Playwright):** Full upload flow against running Docker Compose stack — upload file, wait for progress, verify map renders, copy share URL, open in new context

---

## Dependencies

### Package dependencies
- `@maptool/core@file:../../` (local link, same pattern as test apps)
- `react-router-dom` (routing)
- All @maptool/core peer deps: react, react-dom, @chakra-ui/react, @deck.gl/*, maplibre-gl, @tanstack/react-query

### Vite config
- Must deduplicate React, deck.gl, luma.gl, probe.gl (same pattern as test apps)
- `server.host: true` for remote access
- Proxy `/api` to ingestion service

### Dev dependencies
- vitest, @testing-library/react, playwright

---

## Out of Scope (Phase 2)

- User accounts or saved sessions
- Time slider or animation (v1.5)
- Side-by-side comparison
- Story authoring (v2)
- Mobile-optimized layout (functional but not polished)
- Custom vector styling UI beyond attribute dropdown
- Batch upload or directory processing
