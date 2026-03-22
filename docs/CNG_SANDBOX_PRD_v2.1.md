# CNG Sandbox — Product Requirements Document v2.1

**Status:** v1 Complete · v1.5 Complete · Storytelling v2 (chapter types + multi-dataset) shipped · Roadmap updated
**Audience:** Dev Seed leadership, partner organizations, open source collaborators
**Maintained by:** Development Seed

---

## Current Status

**Last updated:** 2026-03-21
**Current work:** Storytelling v2 — chapter types (prose, map, scrollytelling), multi-dataset stories
**Next milestone:** Story publishing (static export / Vercel deploy), then animation performance

### What's complete

- **v1 is live.** Upload, convert, validate, shareable map URL. Five input formats (GeoTIFF, NetCDF, HDF5, GeoJSON, Shapefile). All vector data routes through PMTiles (tippecanoe). SSE progress, credits panel, 30-day expiry. Runs in Docker Compose.
- **v1.5 temporal infrastructure is complete.** Multi-file temporal upload endpoint, temporal ordering, cross-file validation, global min/max stats, STAC collection + per-timestep items, animation playback, tile preloading, GIF/MP4 export, temporal controls UI, cadence detection, gap detection.
- **HDF5 support shipped.** Full HDF5-to-COG conversion pipeline with multi-group structure navigation, variable scanning UI (pause-and-resume flow), CRS detection, and reprojection. HDF5 is excluded from temporal upload (single-file only).
- **DuckDB-WASM Explore tab shipped.** Browser-based SQL querying of GeoParquet files via DuckDB-WASM, with filter controls, SQL editor, and deck.gl GeoJsonLayer rendering.
- **UnifiedMap architecture shipped.** Consolidated map rendering into a single `UnifiedMap` component with shared camera state, deck.gl + MapLibre composition, and extracted overlay components (RasterControls, VectorPopup, PixelInspector).
- **Raster pixel inspection shipped.** Hover-based pixel value display for raster datasets via PixelInspector overlay. _(Was listed as out of scope in v1.0 PRD.)_
- **Storytelling thin slice shipped.** Visual story editor with chapter management, scrollama-based reader, API-backed persistence (SQLAlchemy + PostgreSQL), per-chapter layer styling (colormap, opacity, basemap), and iframe embed route. See Section 7 for details.
- **Chapter types shipped.** Three chapter types — scrollytelling (guided scroll-driven maps), prose (text-only), and map (interactive embedded) — with automatic grouping of consecutive scrollytelling chapters into Scrollama blocks. Multi-dataset stories supported via per-chapter dataset selection. See Section 7 for details.

### What's in progress

- **Per-chapter layer styling polish** — colormap and opacity controls work; band selection and timestep selection for temporal stories are next.

### What's deferred

**v1.5 UX polish (deferred):**
- Multi-file upload UI — no drag-drop or mode selection in the FileUploader (temporal uploads work via API only)
- Shared URL state — animation position not preserved in URL params
- Gap handling UX — gaps are detected but not surfaced visually to the user

**Animation performance (deferred):**
- Current playback advances frames before tiles have fully rendered, resulting in choppy animation. Needs tile-load-aware frame pacing.

---

## 1. Overview

The CNG Sandbox is a free, publicly hosted demo service where anyone — a conservationist tracking deforestation in the Congo Basin, a climate scientist with 10 years of sea-surface temperature GeoTIFFs, a county GIS analyst with a Shapefile of parcel boundaries — can upload their legacy geospatial data and watch it become a live, shareable web map in under five minutes. No installation. No cloud account. No developer required.

Think of it as a science fair exhibit that happens to be on the internet permanently. The experience is Dev Seed-branded throughout — not through watermarks or popups, but by making the tools themselves the story. After someone sees their data on a map, the credits panel shows them exactly which open source tools made it happen: rio-cogeo, tippecanoe, TiTiler, PMTiles, MapLibre. Every credit links to the project's homepage. That is the discovery moment — the point where a scientist learns that the tools behind NASA's VEDA platform and Microsoft's Planetary Computer are free, open source, and just converted their data.

**Target users:** Scientists, conservationists, and GIS analysts who work with geospatial data daily but are not software developers. Today, when they need to share a map, they screenshot QGIS and paste it into a slide deck. Or they email a 200 MB Shapefile and hope the recipient has ArcGIS. Or they pay for an Esri StoryMap license they only use twice a year. They know terms like COG and GeoParquet exist. They have no idea how to get from their `.shp` file to a URL they can send to their program officer.

**Business purpose:** Generate inbound for Dev Seed's geospatial platform development, data engineering, and VEDA-like dashboard services. The sandbox demonstrates — through direct experience, not marketing copy — that Dev Seed builds and maintains the open source stack that powers cloud-native geospatial. Every shared URL is a warm introduction to that capability: the uploader sees the tools, and the recipient (often a funder, program officer, or decision-maker at another institution) sees a polished Dev Seed-branded experience.

---

## 2. Problem Statement

The mental barrier to adopting cloud-native geospatial (CNG) formats is high. Scientists and conservationists know their data is locked in legacy formats: GeoTIFF, Shapefile, NetCDF. They have heard about COG, GeoParquet, and PMTiles. But the path from "I have a .shp file" to "I have a live web map I can share with my funder" requires installing GDAL, learning rio-cogeo or ogr2ogr, setting up a tile server, writing a MapLibre frontend, and deploying it somewhere. That is a months-long engineering project, not a Tuesday afternoon task.

**What people do today instead:**
- Screenshot QGIS and email the PNG — no interactivity, no context, no zoom
- Upload to ArcGIS Online ($500+/year) — vendor lock-in, data leaves the open ecosystem
- Email raw files — recipient needs GIS software to open them
- Do nothing — the data sits on a hard drive, unseen by the people who need it

Esri Story Maps solves the sharing problem — but only within the Esri ecosystem, only if your data is already clean, and only with a paid license. There is no equivalent entry point for the open source stack.

The CNG Sandbox removes that barrier entirely. You hand it a file. It hands you back a URL. Five minutes, zero cost, and every tool in the pipeline is open source.

---

## 3. What This Is / Is Not

| This Is | This Is Not |
|---------|-------------|
| A hosted workbench at `sandbox.devseed.com` — convert, validate, and preview | A deployable app you run yourself |
| A wizard that deploys your converted data to storage you own | A permanent data host — sandbox copies expire after 30 days |
| A discovery surface for the open source geo stack | A competitor to QGIS, ArcGIS, or Felt |
| A Dev Seed brand surface and inbound channel | A SaaS with accounts, subscriptions, or pricing |
| A scrollytelling builder for map-driven narratives | A full CMS or publishing platform |
| A proof-of-concept gateway to custom map apps | A replacement for production dashboards |

**The role of PMTiles in this story:** The sandbox converts polygon and line vector data into PMTiles — self-contained tile archives that can be served from any static storage (S3, a CDN, even a USB drive) via HTTP range requests. No running tile server required. This means the converted output is not just cloud-native; it is portable and self-describing in a way that a PostGIS table or a folder of MVT tiles is not. For stakeholders evaluating CNG adoption, PMTiles makes the "what do I get at the end?" question concrete: a single file that works anywhere.

---

## 4. User Journey (v1) — COMPLETE

### Upload Flow

```
1. Land on sandbox.devseed.com
2. Drag and drop a file (up to 1 GB) or paste a cloud storage URL (S3, GCS, or any HTTP link)
3. Format detected automatically via magic bytes (not just file extension)
4. Real-time SSE progress tracker shows five stages:
      Scanning → Converting → Validating → Ingesting → Ready
   For HDF5 files, a variable picker appears after scanning — user selects
   the group and variable to convert before the pipeline continues.
5. Map page loads at /map/{dataset-id}
      Rasters: deck.gl rendering via TiTiler COG tiles, with opacity slider,
               colormap selector, and pixel value inspector on hover
      Vectors (polygons/lines): MapLibre rendering via PMTiles range requests from object storage
      Vectors (points): MapLibre rendering via tipg MVT tiles from PostGIS
6. Map auto-zooms to the dataset's bounding box — no manual configuration
7. Credits sidebar (30% width, desktop): tool credits, validation results, CTAs, expiry countdown
8. One-click shareable URL copy from the header
```

### The Shared URL Experience

The shared URL opens the same map page as the uploader sees — not a stripped-down "shared" view. The recipient gets the full Dev Seed-branded experience: the interactive map, the credits panel with tool links, the share button, and the "What's next" CTAs.

This is a deliberate product decision. The recipient of a shared URL is often a more valuable lead than the person who uploaded — a program officer reviewing field data, a funder evaluating a grantee's work, a colleague at another institution seeing an open source map tool for the first time. Every shared URL is an unmediated introduction to Dev Seed's stack.

**Map page structure (`/map/{dataset-id}`):**
```
Header:     "CNG Sandbox" + Share URL button + "New upload" button
Map (70%):  Interactive map (deck.gl for raster, MapLibre for vector)
            Basemap toggle (6 options), opacity slider, colormap selector (raster)
            Pixel value inspector on hover (raster)
            Click-to-inspect attribute popup (vector)
Sidebar (30%):
            "How this was made" — dynamic tool credits with links
            "Validation" — "{N}/{N} checks passed" with green/red indicator
            "Turn this into a story →" (links to /story/new with dataset context)
            "Talk to Development Seed →"
            Expiry countdown — "Expires in {N} day(s)"
Tabs:       "Map" | "Explore" (DuckDB SQL query tab, vector datasets only)
```

### The Expiry Page

After 30 days, the map URL redirects to `/expired/{dataset-id}`. This page shows:

- **"This map has expired"** — clear, not apologetic
- **"Sandbox maps are available for 30 days."** — sets expectations
- **"Re-upload your data or talk to us about a permanent solution."** — frames the CTA
- Two buttons: **"Upload again"** (returns to home) and **"Talk to Dev Seed"** (links to developmentseed.org/contact)

The expiry page is the highest-intent CTA surface in the product. Someone cared enough to share this URL. Someone else clicked it weeks later. That click represents active interest in both the data and the tool that displayed it.

---

## 5. The Credits Panel — COMPLETE

The credits panel is the most important design element in the product. It is the discovery mechanism — not attribution, not a footer, not an afterthought.

After someone sees their data on a map, the credits panel answers "how did this happen?" and points them directly to the open source tools that made it possible. Each credit is a clickable gateway to that tool's project page.

**Raster credits (GeoTIFF or NetCDF upload):**
```
Converted by rio-cogeo                             → github.com/cogeotiff/rio-cogeo
Tiles served by TiTiler                            → developmentseed.org/titiler
Cataloged by pgSTAC                                → github.com/stac-utils/pgstac
Map rendered by MapLibre GL JS                     → maplibre.org
```

**Raster credits (HDF5 upload):**
```
Read by h5py                                       → github.com/h5py/h5py
Converted by rasterio                              → rasterio.readthedocs.io
Tiles served by TiTiler                            → developmentseed.org/titiler
Cataloged by pgSTAC                                → github.com/stac-utils/pgstac
Map rendered by MapLibre GL JS                     → maplibre.org
```

**Vector credits — polygon/line upload (PMTiles path):**
```
Converted by GeoPandas                             → geopandas.org
Tiles generated by tippecanoe                      → github.com/felt/tippecanoe
Tiles served via PMTiles                           → github.com/protomaps/PMTiles
Map rendered by MapLibre GL JS                     → maplibre.org
```

**Vector credits — point upload (tipg path):**
```
Converted by GeoPandas                             → geopandas.org
Tiles served by tipg                               → github.com/developmentseed/tipg
Map rendered by MapLibre GL JS                     → maplibre.org
```

Credits are generated dynamically based on the conversion path — the backend determines which tools were involved and returns the appropriate credit list with each dataset.

**Below the credits**, the sidebar shows:
- **Validation results** — e.g., "8/8 checks passed" (green checkmark) or "7/10 checks passed" (red warning icon). Individual check results are visible on hover/click.
- **"Turn this into a story →"** — links to the story editor with this dataset pre-loaded.
- **"Talk to Development Seed →"** — direct engagement CTA.
- **Expiry countdown** — "Expires in {N} day(s)" calculated from creation date + 30 days.

---

## 6. DuckDB-WASM Explore Tab — COMPLETE

For vector datasets, the map page includes a second tab: **Explore**. This provides browser-based SQL querying of the GeoParquet intermediate file via DuckDB-WASM.

**What it does:**
- Loads the GeoParquet file into an in-browser DuckDB instance
- Provides filter controls for column-based filtering (auto-generated from column metadata)
- Includes a SQL editor for arbitrary queries
- Renders query results as a deck.gl GeoJsonLayer on the map
- Shows result count and truncation warnings for large result sets

**Why it matters:** It lets users compare live-queried data (DuckDB) against pre-tiled rendering (PMTiles) on the same dataset. This demonstrates two complementary CNG patterns — static tile serving and dynamic in-browser analytics — using the same underlying GeoParquet file.

---

## 7. StoryMap Builder — THIN SLICE COMPLETE

### Status summary

| Capability | Status |
|-----------|--------|
| Story data model (chapters, map state, layer config) | **Complete** |
| Visual chapter editor with narrative text (markdown) | **Complete** |
| Map state capture (center, zoom, bearing, pitch) per chapter | **Complete** |
| Chapter drag-and-drop reordering | **Complete** |
| Scrollama-based reader with fly-to transitions | **Complete** |
| Per-chapter layer styling (colormap, opacity, basemap) | **Complete** |
| API-backed persistence (PostgreSQL via SQLAlchemy) | **Complete** |
| Story CRUD endpoints (create, read, update, delete, list) | **Complete** |
| Iframe embed route (`/story/:id/embed`) | **Complete** |
| Credits panel "Turn this into a story" → editor link | **Complete** |
| Chapter types (scrollytelling, prose, map) | **Complete** |
| Multi-dataset stories (per-chapter dataset selection) | **Complete** |
| Scrollytelling block grouping (consecutive chapters share sticky map) | **Complete** |
| Chapter type migration (backward-compatible with old stories) | **Complete** |
| Story publishing (static export, Vercel deploy) | Not started |
| Media embedding (images, video in chapters) | Not started |
| Story gallery / discovery page | Not started |

### What's built

The StoryMap Builder is a visual, no-code storytelling tool inside the sandbox. A user who has uploaded data to the sandbox and sees it on a map can click **"Turn this into a story"** in the credits panel to open the editor. The editor captures map views per chapter, lets the user write narrative text in markdown, and configure layer styling (colormap, opacity) per chapter. Stories support three chapter types — **scrollytelling** (guided scroll-driven maps with no user navigation), **prose** (text-only sections for introductions or narrative), and **map** (interactive embedded maps readers can explore). Consecutive scrollytelling chapters automatically group into Scrollama blocks with a shared sticky map and fly-to camera transitions. Each chapter can reference a different dataset, enabling multi-dataset stories.

**Story routes:**
```
/story/new        — Create a new story (opens editor)
/story/:id        — Read a story (scrollytelling reader)
/story/:id/edit   — Edit an existing story
/story/:id/embed  — Iframe-embeddable reader (same as reader, no chrome)
```

**Story API endpoints:**
```
POST   /api/stories              — Create story
GET    /api/stories              — List all stories
GET    /api/stories/:id          — Get single story
PATCH  /api/stories/:id          — Update story
DELETE /api/stories/:id          — Delete story
```

**Per-chapter configuration:**
Each chapter has a `type` field (`"scrollytelling"`, `"prose"`, or `"map"`) and a `LayerConfig` object:
- `dataset_id` — which dataset this chapter visualizes
- `colormap` — raster colormap name (viridis, plasma, inferno, etc.)
- `opacity` — layer opacity (0–1)
- `basemap` — basemap style for this chapter
- `band` — optional band index for multi-band rasters
- `timestep` — optional timestep index for temporal data

This means a single story can mix chapter types, use different datasets per chapter, and show the same dataset with different visualization parameters — e.g., switching from `viridis` to `terrain` colormap to emphasize different features, or adjusting opacity to reveal the basemap underneath.

### What's next for storytelling

The core editing and reading experience is complete, including chapter types and multi-dataset support. The next phase focuses on making stories publishable and shareable:

1. **Static export** — download story as a self-contained ZIP (HTML + JS + CSS + data references) for self-hosting
2. **Vercel deploy** — one-click deployment of the exported static site
3. **Media embedding** — images and video embeds in chapter narratives
4. **Story gallery** — browseable page of published stories

### Competitive positioning

| Feature | Esri StoryMaps | Mapbox Storytelling | Knight Lab StoryMapJS | CNG Sandbox |
|---------|---------------|--------------------|-----------------------|-------------|
| Visual editor | Yes | No (config file) | Yes (limited) | **Yes** |
| CNG data sources | No | No | No | **Yes (COG, PMTiles, STAC)** |
| Self-hostable output | No | Yes (static) | Yes (static) | **Planned** |
| Open source | No | Template only | Yes | **Yes** |
| Cost | $100+/yr | Free (Mapbox token) | Free | **Free** |
| Raster data support | Limited | No | No | **Yes** |

---

## 8. Guided Self-Hosting _(Future)_

When a user has seen their data on the sandbox map, a second question always follows: **"Cool — but where can I download this? How do I keep it after 30 days?"**

The Guided Self-Hosting wizard answers that directly. The sandbox is the workbench — the place to convert, validate, and preview. The wizard is the bridge from that moment of inspiration to a permanent deployment the user owns. DevSeed provides the workbench and the on-ramp; the user owns everything that comes out of it.

**Design principles:**
- **The user owns everything.** Every file, every service, every URL runs on the user's own accounts. DevSeed hosts nothing in production. If CNG Sandbox disappeared tomorrow, the user's infrastructure keeps running.
- **Progressive complexity.** Start with the simplest possible deployment and let users opt into more infrastructure only when they need it.
- **One happy path first.** Cloudflare R2 for storage, Vercel for the viewer. Expand to AWS S3 and other targets in later iterations.

**The wizard (Tier 0 — static deployment):**

1. **Prep** (already done in sandbox): Files converted to COG or PMTiles, static STAC catalog JSON generated, map viewer configured.
2. **Storage setup**: User connects their Cloudflare R2 bucket (or AWS S3). The sandbox pushes converted files + STAC catalog JSON to the user's bucket. Credentials are never stored — R2's OAuth or one-time upload tokens only.
3. **Viewer deploy**: The sandbox exports the map as a static site. User deploys it to Vercel (one-click) or downloads a zip for self-hosting.
4. **Result**: User has a permanent URL. Data on R2, viewer on Vercel, everything open-source and portable. Monthly cost: a few cents for storage, zero for compute.

**Why Cloudflare R2 as the default:**

R2's zero egress fees make it significantly cheaper than S3 for COG data served via HTTP range requests. It offers a 10GB free tier, doesn't require an AWS account, and exposes the same S3-compatible API so all existing CNG tooling works unchanged. AWS S3 is supported for users who already have accounts, but R2 is the guided default for new users.

**What Tier 0 does not include:**
- No TiTiler deployment — client-side COG rendering via maplibre-cog-protocol handles the most common visualization needs. Users who need server-side tile generation are pointed to documentation or Dev Seed consulting.
- No dynamic STAC API — static STAC catalogs are sufficient for datasets under a few hundred items.
- No credential storage — the sandbox forgets credentials when the user disconnects.

**How this changes the expiry page:**

The 30-day expiry gains a third CTA alongside "Upload again" and "Talk to Dev Seed": **"Deploy your own copy →"** that launches the wizard. The expiry moment is no longer just a prompt to re-engage with DevSeed — it's also the trigger for users ready to take permanent ownership of their data.

---

## 9. Open Data Discovery Panel _(Future)_

After users see their own data on a map for the first time, they are primed for a question the sandbox does not yet answer: "What does this look like at scale? What else exists in this format? Am I the only one doing this?"

The Open Data Discovery Panel answers that. It surfaces related datasets from the open CNG ecosystem alongside the user's freshly converted data — not as a generic catalog, but as a curated context window: three to five datasets selected because they are geographically or thematically adjacent to what the user just uploaded.

**Positioning:** "Your data is now cloud-native. Here's what the open data world looks like when it already is."

**Two modes:**

1. **Automatic suggestions** — matching on the dataset's bounding box and data type:
   - A land cover raster uploaded for East Africa → ESA WorldCover 10m (Planetary Computer), Sentinel-2 L2A composites (Planetary Computer), Africa Cropland (source.coop)
   - A county-level GeoJSON for the U.S. Midwest → USDA Cropland Data Layer (VEDA), Overture Buildings (source.coop), NOAA Climate Normals (Planetary Computer)
   - A coral reef Shapefile for Southeast Asia → Allen Coral Atlas (source.coop), Global Fishing Watch (source.coop), Sentinel-2 coastal composites (Planetary Computer)

2. **Browseable catalog** — a lightweight search/filter interface linking directly to:
   - [source.coop](https://source.coop) — community open data in CNG formats (GeoParquet, PMTiles, COG)
   - [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/catalog) — petabyte-scale Earth observation (STAC + COG)
   - [NASA VEDA](https://www.earthdata.nasa.gov/dashboard) — NASA Earth science data dashboards

**Why this matters for Dev Seed:** Every organization that uploads data is implicitly asking "what does the broader ecosystem look like?" Surfacing the answer — with attribution to the catalogs Dev Seed helped build and maintain — positions Dev Seed as the integration layer between a user's data and the open geospatial ecosystem. That is a services conversation, not a product sale.

**Standard data libraries (near-term, before full discovery):**

Before building the full discovery panel, we can offer a curated set of ready-to-use datasets from public STAC catalogs that Dev Seed is close to — Planetary Computer, Earth Search (Element 84), NASA VEDA. These would be available to all users from the homepage as a "Browse public data" entry point, letting people explore and build stories with high-quality open data without uploading anything. This lowers the barrier to entry significantly: a user curious about the sandbox can start building a story with real data immediately.

This is a stepping stone toward the full discovery panel — it validates the catalog integration, tile rendering from external STACs, and the UX for browsing/selecting datasets, without requiring the bounding-box matching or recommendation engine.

**Implementation scope (full discovery):** Requires a lightweight dataset index (pre-curated, not a live search across all catalogs), a bounding box intersection service, and a data-type taxonomy. Estimated at ~2,000 lines of backend + frontend.

---

## 10. Custom Map Application CTA _(Future)_

The sandbox proves that a dataset is CNG-ready and renders correctly on a web map. It does not prove what a production-quality application built on that data looks like — one with time sliders, layer selectors, custom legends, responsive layouts, API integrations, and institutional branding.

The Custom Map Application CTA closes that gap. It connects the sandbox experience to Dev Seed's rapid map application development capability.

**Positioning:** "From proof-of-concept to production map app."

**What the user has proven by this point:**
- Their data converts cleanly to CNG formats (the sandbox validated it)
- It renders on a web map (they saw it)
- Other people want to see it (they shared the URL)
- They can tell a story with it (they built a scrollytelling narrative)

**What they need next:**
- A branded, permanent web application — not a 30-day sandbox link
- Custom interactivity: time sliders, layer toggles, data filtering, search
- Integration with their existing data infrastructure or public APIs

**CTA placement (currently implemented):**
- Credits sidebar: **"Turn this into a story →"** and **"Talk to Development Seed →"**
- Expiry page: **"Talk to Dev Seed"** button — the highest-intent moment

**CTA evolution (future):**
- Credits sidebar: **"Build a custom map application →"** — a more specific offer
- Expiry page: **"See what a production app looks like →"** — links to a gallery of Dev Seed-built applications or a consultation intake form

This is not self-serve. It is not a product configurator. It is a Dev Seed engagement pathway — a conversation that starts because someone already has evidence their data works.

---

## 11. Formats and Pipeline

### Supported Format Pairs

| Input Format | Intermediate | Final Output | Tile Serving | Rendering | Status |
|-------------|-------------|-------------|-------------|-----------|--------|
| GeoTIFF (.tif, .tiff) | — | COG | titiler-pgstac (PNG/WebP tiles) | deck.gl | **Complete** |
| NetCDF (.nc, .nc4) | — | COG | titiler-pgstac (PNG/WebP tiles) | deck.gl | **Complete** |
| HDF5 (.h5, .hdf5) | — | COG | titiler-pgstac (PNG/WebP tiles) | deck.gl | **Complete** |
| GeoJSON (.geojson, .json) | GeoParquet | PMTiles | MinIO (HTTP range requests) | MapLibre GL JS | **Complete** |
| Shapefile (.shp, .zip) | GeoParquet | PMTiles | MinIO (HTTP range requests) | MapLibre GL JS | **Complete** |

**Vector routing:** All vector datasets go through the PMTiles path (tippecanoe → MinIO). This was originally split by geometry type (polygons/lines → PMTiles, points → tipg), but tipg's SQL builder rejects column names with special characters, making it fragile for real-world datasets. tippecanoe handles all geometry types and column names reliably.

**HDF5 pipeline:** HDF5 files use a pause-and-resume flow. The scanner reads the file's group/variable structure and returns it to the frontend. The user selects which 2D variable to convert via a VariablePicker UI. The pipeline then resumes: extracts the selected variable, detects or constructs CRS and transform from coordinate arrays, reprojects to EPSG:4326, and writes a COG. HDF5 is excluded from temporal upload (single-file only).

### Processing Pipeline

```
File received (upload ≤ 1 GB, or URL fetch with size check)
  ↓
Security scan: magic bytes + extension whitelist + SSRF prevention (http/https only)
  ↓
Format detection → raster or vector path
  ↓
RASTER PATH:                          VECTOR PATH:
  GeoTIFF / NetCDF → COG               GeoJSON / Shapefile → GeoParquet
  (rio-cogeo, xarray, GDAL)            (GeoPandas, GDAL)
  ↓                                     ↓
  HDF5 → scan → variable picker        Validate (10 checks)
  → user selects → COG                  ↓
  (h5py, rasterio)                      Detect geometry type
  ↓                                     ↓                ↓
  Validate (8 checks)              Polygon/Line         Point
  ↓                                     ↓                ↓
  Upload COG to MinIO (S3)         tippecanoe         Load into PostGIS
  ↓                                (--maximum-zoom=g,  tipg auto-discovers
  Register in pgSTAC (STAC         --no-feature-limit, new table (5s TTL)
   collection + item)               --layer=default)    ↓
  ↓                                     ↓              tipg serves MVT tiles
  titiler-pgstac serves tiles      .pmtiles → MinIO    (MapLibre)
  (deck.gl, auto-zoom to bounds)        ↓
                                   MapLibre renders
                                   via range requests
```

**Key pipeline details:**
- **Progress tracking:** SSE (Server-Sent Events) with named `event: status` events. Five stages: `scanning`, `converting`, `validating`, `ingesting`, `ready`. Job timeout at 10 minutes.
- **Job processing:** FastAPI BackgroundTasks — no distributed queue needed at demo scale.
- **tippecanoe flags:** `--maximum-zoom=g` (auto-selects max zoom based on feature density, not a fixed level), `--no-feature-limit`, `--no-tile-size-limit` (never drops features — tippecanoe applies zoom-appropriate visual simplification but discards nothing), `--layer=default` (matches the source-layer name tipg uses, so the frontend rendering code works for both paths).
- **Rate limiting:** 5 uploads per IP per hour via slowapi. Enforced on both `/api/upload` and `/api/convert-url`. Returns HTTP 429 with plain-language message.
- **Storage lifecycle:** All files expire after 30 days via S3 lifecycle policy. Paths are dataset-scoped (`datasets/{id}/raw/`, `datasets/{id}/converted/`) to support multi-file temporal stacks.

### Tool Credits (complete list)

| Tool | Role | Maintained by | Status |
|------|------|---------------|--------|
| GDAL | Format detection, raster/vector I/O | OSGeo | In use |
| rio-cogeo | GeoTIFF / NetCDF → COG conversion | Development Seed | In use |
| xarray | NetCDF variable extraction | Community / Pangeo | In use |
| h5py | HDF5 file reading and variable extraction | Community | In use |
| rasterio | HDF5 → COG writing and CRS handling | Community / Mapbox | In use |
| GeoPandas | GeoJSON / Shapefile → GeoParquet conversion | Community | In use |
| tippecanoe | GeoParquet → PMTiles tile generation | Felt | In use |
| pgSTAC | STAC catalog storage (raster datasets) | Development Seed | In use |
| titiler-pgstac | COG → raster tile serving (PNG/WebP) | Development Seed | In use |
| tipg | PostGIS → vector tile serving (MVT, point datasets) | Development Seed | In use |
| PMTiles | Self-contained vector tile archive format | Protomaps | In use |
| MapLibre GL JS | Vector + PMTiles map rendering | MapLibre Community | In use |
| deck.gl | Raster map rendering (WebGL) | OpenJS Foundation / vis.gl | In use |
| DuckDB-WASM | In-browser SQL analytics on GeoParquet | DuckDB Foundation | In use |
| scrollama | Scrollytelling scroll-position detection | Community | In use |

Four of these tools (rio-cogeo, pgSTAC, titiler-pgstac, tipg) are built and maintained by Dev Seed. This is not incidental — it is the core of the brand message.

---

## 12. Validation Suite — COMPLETE

Runs automatically after every conversion. Results displayed in the credits sidebar. The shareable URL is only generated after all critical checks pass — a failed validation blocks sharing entirely.

### Raster Checks (8 per conversion)

Applies to GeoTIFF → COG, NetCDF → COG, and HDF5 → COG.

| # | Check | Pass Condition |
|---|-------|----------------|
| 1 | COG structure valid | rio-cogeo validate returns `valid=True` |
| 2 | CRS preserved | Input and output EPSG codes match exactly |
| 3 | Bounding box preserved | All four bounds within 1e-6 degrees |
| 4 | Pixel dimensions preserved | Width and height match exactly |
| 5 | Band count preserved | Band count matches exactly |
| 6 | Pixel value fidelity | 1,000 random pixel samples: max diff < 1e-4 (float), exact match (int) |
| 7 | NoData value preserved | NoData attribute matches exactly |
| 8 | Internal overviews present | ≥ 3 overview levels exist in the COG |

### Vector Checks (10 per conversion)

Applies to GeoJSON → GeoParquet and Shapefile → GeoParquet.

| # | Check | Pass Condition |
|---|-------|----------------|
| 1 | Row count preserved | Input and output row counts match exactly |
| 2 | CRS preserved | CRS string matches exactly |
| 3 | Column names preserved | Column sets match exactly |
| 4 | Geometry type preserved | Geometry types match between input and output |
| 5 | Geometry validity | All output geometries pass `is_valid` |
| 6 | Geometry fidelity | 100 random geometries: exact WKT match |
| 7 | Attribute fidelity | 100 random rows: all field values match exactly |
| 8 | Bounding box preserved | Spatial bounds match within tolerance |
| 9 | GeoParquet metadata valid | Parquet geo metadata present and spec-compliant |
| 10 | Column names lowercase | All column names are lowercase (required for PostGIS/tipg compatibility) |

### Temporal Cross-File Checks

Applies to multi-file temporal uploads. Run after individual file validation.

| Check | Pass Condition |
|-------|----------------|
| CRS consistency | All files share the same CRS |
| Bounds consistency | All bounding boxes within tolerance |
| Dtype consistency | All files share the same data type |
| Resolution consistency | All files share the same pixel dimensions |

---

## 13. Product Roadmap

Each version delivers a complete, standalone value proposition.

### v1 — "See your data on the web" — COMPLETE

Single file upload. Five input formats (GeoTIFF, NetCDF, HDF5, GeoJSON, Shapefile) with geometry-aware vector routing (PMTiles for polygons/lines, tipg for points). HDF5 variable selection UI. 8–10 automated validation checks per conversion. Real-time SSE progress. Shareable URL with 30-day expiry. Credits sidebar with tool discovery links and ambient CTAs. DuckDB-WASM Explore tab for vector datasets. Raster pixel inspection on hover.

**The bar:** Upload to shareable map URL in under 5 minutes.

### v1.5 — "See your data change over time" — BACKEND COMPLETE, UX DEFERRED

Multi-file temporal stack. Upload N files representing timesteps (e.g., annual deforestation rasters, monthly SST composites). Time slider. Frame-by-frame animation. Export to GIF/MP4. Temporal ordering, cross-file validation, cadence detection, gap detection.

**Complete:** Backend pipeline, temporal controls, animation playback, GIF/MP4 export, tile preloading.
**Deferred:** Multi-file upload UI (temporal uploads work via API only), shared URL state, gap handling UX, animation performance (tile-load-aware frame pacing).

**The bar:** A scientist uploads 10 years of annual rasters and watches them animate in a browser without downloading a single file.

### v2 — "Tell a story with your data" — CORE COMPLETE

_(Storytelling was originally v3 in the roadmap. Pulled forward because it provides the most immediately compelling and shareable sandbox output with the least infrastructure complexity.)_

Visual, no-code storytelling builder with three chapter types. Scrollytelling chapters use Scrollama-driven scroll-to-fly transitions with a shared sticky map (no user navigation). Prose chapters render centered markdown text without a map. Map chapters render narrative above an interactive embedded map with zoom controls. Multi-dataset support via per-chapter dataset selection.

**Complete:** Story editor, reader, persistence, embed route, per-chapter styling, chapter types (scrollytelling/prose/map), multi-dataset stories, scrollytelling block grouping, backward-compatible migration. See Section 7.
**Next:** Static export, Vercel deploy, media embedding, story gallery, standard data libraries (public STAC catalogs).

**The bar:** A conservationist with no dev background creates a multi-chapter story mixing guided map narratives, prose introductions, and explorable maps — then shares it with their board of directors.

### v3 — "Own your data" _(See Section 8)_

_(Was v2 in the original roadmap. Deferred behind storytelling because the story publishing flow will benefit from the same static export infrastructure.)_

Guided Self-Hosting wizard. After the sandbox converts and validates a dataset, the wizard walks the user through deploying it to Cloudflare R2 (or AWS S3) and exporting the map viewer as a static site.

**The bar:** A researcher with no cloud experience deploys their converted dataset to R2 and shares a permanent map URL — without writing a line of configuration.

### v4 — "Discover what the open data world looks like" _(See Section 9)_

Open Data Discovery Panel. After the user's data is on the map, surface 3–5 related datasets from Planetary Computer, source.coop, and NASA VEDA based on bounding box and data type.

**The bar:** A researcher who uploaded a deforestation raster for Borneo discovers — on the same page — that the Allen Coral Atlas, Global Forest Watch, and Sentinel-2 composites for the same region already exist as cloud-native datasets.

### Future — "Smart raster visualization"

Automatic detection of raster data characteristics (value range, distribution, data type) to recommend or auto-apply the right visualization parameters. Percentile-based rescaling, data-type-aware transforms (dB scaling for SAR, hillshade for DEM), colormap recommendation, per-band statistics.

**The bar:** A scientist uploads a NISAR GCOV radar backscatter file and sees recognizable terrain on the map without needing to know what decibels are.

### Future — "Build a production map application" _(See Section 10)_

Custom Map Application CTA. A Dev Seed engagement pathway for organizations that have proven their data works in the sandbox and want a permanent, branded, interactive web application.

**The bar:** A conservation NGO that shared a sandbox link with their funder three weeks ago clicks "Talk to Dev Seed" from the expiry page and starts a conversation about a custom monitoring dashboard.

---

## 14. API Reference

All endpoints are proxied through the frontend at `/api/*`.

### Upload

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/upload` | Upload a single file (multipart form) | **Complete** |
| POST | `/api/convert-url` | Fetch and convert a file from a URL | **Complete** |
| POST | `/api/upload-temporal` | Upload 2–50 raster files as a temporal stack | **Complete** |
| POST | `/api/scan/{scan_id}/convert` | Resume a paused HDF5/NetCDF scan after variable selection | **Complete** |

### Jobs

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/jobs/{job_id}` | Job status snapshot | **Complete** |
| GET | `/api/jobs/{job_id}/stream` | SSE progress stream | **Complete** |

### Datasets

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/datasets` | List all datasets | **Complete** |
| GET | `/api/datasets/{dataset_id}` | Dataset metadata (includes tile_url) | **Complete** |

### Stories

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/stories` | Create a story | **Complete** |
| GET | `/api/stories` | List all stories | **Complete** |
| GET | `/api/stories/{story_id}` | Get a single story | **Complete** |
| PATCH | `/api/stories/{story_id}` | Update a story | **Complete** |
| DELETE | `/api/stories/{story_id}` | Delete a story | **Complete** |

### System

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/health` | Health check | **Complete** |

---

## 15. Frontend Routes

| Path | Page | Description | Status |
|------|------|-------------|--------|
| `/` | Upload | Landing page with drag-drop uploader and URL input | **Complete** |
| `/map/:id` | Map Viewer | Interactive map with credits sidebar and Explore tab | **Complete** |
| `/expired/:id` | Expiry | Post-30-day landing with re-upload and contact CTAs | **Complete** |
| `/story/new` | Story Editor | Create a new story from an uploaded dataset | **Complete** |
| `/story/:id` | Story Reader | Scrollytelling reader with fly-to transitions | **Complete** |
| `/story/:id/edit` | Story Editor | Edit an existing story | **Complete** |
| `/story/:id/embed` | Story Embed | Iframe-embeddable reader (no chrome) | **Complete** |

---

## 16. Success Metrics

### v1 (launch) — COMPLETE
| Metric | Target | Measurement |
|--------|--------|-------------|
| Upload-to-shareable-URL time | < 5 minutes (p50), < 10 minutes (p95) | Server-side job duration logs |
| Validation pass rate | 100% on all 5 input formats with zero data loss | Automated test suite against reference datasets |
| Shared URL engagement | URLs shared externally within first month | Qualitative: social media, Slack mentions, email forwards |
| Inbound inquiries | ≥ 1 inquiry/month referencing the sandbox | CRM tracking, contact form attribution |

### v1.5 (temporal) — BACKEND COMPLETE
| Metric | Target | Measurement |
|--------|--------|-------------|
| Temporal upload success | 10+ file stacks render as animation | E2E test with reference temporal datasets |
| Conference demo usage | Used in ≥ 2 conference presentations | Internal tracking |

### v2 (storytelling)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Story creation rate | ≥ 10% of map page visitors click "Turn this into a story" | Frontend analytics |
| Story completion rate | ≥ 50% of editors who start a story publish or save it | Frontend analytics |
| Story share rate | ≥ 30% of completed stories are shared via URL or embed | Share button / embed route analytics |

### v3 (guided self-hosting)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Wizard completion rate | ≥ 30% of users who start the wizard complete a deployment | Frontend funnel analytics |
| Successful R2 deployments | ≥ 10 deployments in first month post-launch | Backend deployment logs |
| Permanent URL longevity | Deployed URLs still resolving 90 days after creation | Periodic link checks |

### v4 (discovery)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Discovery click-throughs | ≥ 20% of map page visitors click a suggested dataset | Frontend analytics |
| Ecosystem partner mentions | source.coop or Planetary Computer links to sandbox | Partner outreach tracking |

---

## 17. Out of Scope

| Item | Reason | Status |
|------|--------|--------|
| Email capture or user accounts | Demo service — zero friction is the product | Firm |
| Paid tiers or subscriptions | Not a SaaS play | Firm |
| HDF4 support | Dependency complexity (outdated format, rarely encountered) | Firm |
| Kerchunk / VirtualiZarr for NetCDF | Optimization for large NetCDF — not needed at demo scale | Firm |
| Self-hosted distribution of the sandbox app itself | The sandbox is the hosted service — the wizard helps users deploy their *data*, not a copy of the tool | Firm |
| Attribute-based choropleth styling | Requires a style editor UI — potential future addition | Deferred |
| ~~Raster pixel value inspection~~ | ~~Requires click-to-query against TiTiler~~ | **Shipped** (PixelInspector) |
| ~~HDF5 support~~ | ~~Dependency complexity~~ | **Shipped** (HDF5-to-COG pipeline) |
| ~~Story authoring UI~~ | ~~v3 roadmap~~ | **Shipped** (StoryMap Builder thin slice) |
| ~~Batch / directory upload~~ | ~~v1 is single-file~~ | **Shipped** (temporal upload endpoint) |

---

## Changelog

- **v2.1**: Chapter types and multi-dataset stories shipped. Key changes:
  - Added three chapter types: scrollytelling (guided, no navigation), prose (text-only), and map (interactive embedded). Consecutive scrollytelling chapters auto-group into Scrollama blocks with shared sticky map and fly-to transitions.
  - Added multi-dataset stories — each chapter can reference a different dataset via per-chapter `LayerConfig.dataset_id`.
  - Added `UnifiedMap.interactive` prop to disable map navigation for scrollytelling chapters.
  - Added `ProseChapter` and `MapChapter` reader components.
  - Added chapter type dropdown and conditional field visibility to story editor.
  - Added chapter type indicator in sidebar chapter list.
  - Added backward-compatible migration: old stories without `type` field default to `"scrollytelling"`.
  - Updated Section 7 status table with 4 new completed capabilities.
  - Updated v2 roadmap — "THIN SLICE COMPLETE" → "CORE COMPLETE". Multi-dataset stories removed from "Next" (now shipped).
  - Updated StoryMap Builder Spec to v1.1.
- **v2.0**: Comprehensive status update for external sharing. Key changes:
  - Added HDF5 as fifth supported input format — was "out of scope" in v1.0, now fully implemented with variable scanning UI and pause-and-resume pipeline.
  - Added StoryMap Builder section (Section 7) documenting the thin slice: visual editor, scrollama reader, API persistence, per-chapter layer styling, iframe embed route.
  - Added DuckDB-WASM Explore tab section (Section 6) — was mentioned in status notes but had no dedicated section.
  - Added API Reference (Section 14) and Frontend Routes (Section 15) sections.
  - Added temporal cross-file validation checks to the Validation Suite.
  - Updated roadmap: storytelling pulled forward to v2 (was v3), guided self-hosting moved to v3 (was v2), discovery moved to v4 (was v3.5). Reflects actual development priorities.
  - Updated "What This Is / Is Not" table to include storytelling.
  - Updated Out of Scope table — four items previously deferred have now shipped (HDF5, pixel inspection, story authoring, batch upload). Crossed out with status.
  - Updated tool credits table to include h5py, rasterio, DuckDB-WASM, and scrollama.
  - Updated format pairs table to include HDF5 and added Status column.
  - Added storytelling success metrics.
  - Updated pipeline diagram to include HDF5 pause-and-resume flow.
  - Updated map page structure to reflect Explore tab, pixel inspector, and story CTA linking to internal editor route.
  - Validation pass rate target updated from "4 input formats" to "5 input formats" to reflect HDF5 addition.
  - All sections now have clear status labels (COMPLETE, THIN SLICE COMPLETE, BACKEND COMPLETE, Future).
- v1.2: Marked v1.5 remaining items as deferred. Updated vector routing to PMTiles-only. Added DuckDB Explore tab to completed work.
- v1.1: Added Guided Self-Hosting as v2 roadmap item. Updated "What This Is / Is Not" to reflect sandbox-as-workbench framing. Inserted v2 into roadmap; shifted scrollytelling to v3, discovery to v3.5, custom app CTA to v4.
- v1.0: Rewritten as stakeholder-ready PRD. Vector pipeline updated to PMTiles. Validation checks corrected. Rate limit corrected. SSE stages corrected. Added Open Data Discovery Panel, Custom Map Application CTA, shared URL experience, expiry page. Success metrics expanded. Out of scope with rationale. Roadmap stages with "The bar" acceptance criteria.
- v0.1–v0.4: Internal engineering spec (see `CNG_SANDBOX_PRODUCT_SPEC_v0.4.md`)
