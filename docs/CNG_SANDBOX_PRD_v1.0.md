# CNG Sandbox — Product Requirements Document v1.0

**Status:** v1 Complete · v1.5–v4 Roadmap
**Audience:** Dev Seed leadership, partner organizations, open source collaborators
**Maintained by:** Development Seed

---

## Current Status

**Last updated:** 2026-03-18
**Next milestone:** Animation performance improvements, then v2

### What's complete

- **v1 is live.** Upload → convert → validate → shareable map URL, all four input formats (GeoTIFF, NetCDF, GeoJSON, Shapefile), all vector data routes through PMTiles (tippecanoe), SSE progress, credits panel, 30-day expiry. Runs in Docker Compose at `sandbox.devseed.com`.
- **v1.5 temporal infrastructure is complete.** Multi-file temporal upload endpoint, temporal ordering, cross-file validation, global min/max stats, STAC collection + per-timestep items, animation playback, tile preloading, GIF/MP4 export, temporal controls UI, cadence detection, gap detection. The backend pipeline and frontend hooks/components are functional.
- **DuckDB-WASM Explore tab shipped.** Browser-based SQL querying of GeoParquet files via DuckDB-WASM, with filter controls, SQL editor, and deck.gl GeoJsonLayer rendering. Allows comparison of live-queried data (DuckDB) vs. pre-tiled rendering (PMTiles) on the same dataset.
- **PRD updated to v1.2.** Marked v1.5 remaining items as deferred (see below). Updated vector routing to PMTiles-only. Added DuckDB Explore tab to completed work.

### v1.5 items deferred to later

The following v1.5 user stories are deferred — the temporal backend and playback infrastructure is complete, but these UX polish items are not needed for the current phase:

- **Multi-file upload UI** — no drag-drop or mode selection in the FileUploader (temporal uploads work via API only)
- **Shared URL state** — animation position not preserved in URL params
- **Gap handling UX** — gaps are detected but not surfaced visually to the user
- **Open questions** (colormap consistency, max batch size, sub-daily navigation, multi-variable NetCDF) — resolved by deferral; current defaults (global min/max, 50-file cap, linear slider) are sufficient

### What to work on next

- **Animation performance** — current playback advances frames before tiles have fully rendered, resulting in choppy animation. Needs tile-load-aware frame pacing.

### Key implementation context

- **User stories:** `~/Documents/obsidian-notes/Project Docs/Map App Builder/CNG Sandbox/cng-sandbox-v1.5-user-stories.md`
- **Implementation plan:** `~/Documents/obsidian-notes/Project Docs/Map App Builder/CNG Sandbox/cng-sandbox-implementation-plan.md`
- **Architecture doc:** `~/Documents/obsidian-notes/Project Docs/Map App Builder/CNG Sandbox/cng-sandbox-architecture.md`
- **Sandbox source:** `sandbox/` in this repo; see `sandbox/CLAUDE.md` for Docker Compose setup, service map, and local dev instructions
- **GeoParquet intermediate files must be stored to MinIO** even when PMTiles is the final output — this is a firm policy (see storage lifecycle notes in Section 9)

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
| A proof-of-concept gateway to custom map apps | A full storytelling or publishing platform (yet) |

**The role of PMTiles in this story:** The sandbox converts polygon and line vector data into PMTiles — self-contained tile archives that can be served from any static storage (S3, a CDN, even a USB drive) via HTTP range requests. No running tile server required. This means the converted output is not just cloud-native; it is portable and self-describing in a way that a PostGIS table or a folder of MVT tiles is not. For stakeholders evaluating CNG adoption, PMTiles makes the "what do I get at the end?" question concrete: a single file that works anywhere.

---

## 4. User Journey (v1)

### Upload Flow

```
1. Land on sandbox.devseed.com
2. Drag and drop a file (up to 1 GB) or paste a cloud storage URL (S3, GCS, or any HTTP link)
3. Format detected automatically via magic bytes (not just file extension)
4. Real-time SSE progress tracker shows five stages:
      Scanning → Converting → Validating → Ingesting → Ready
5. Map page loads at /map/{dataset-id}
      Rasters: deck.gl rendering via TiTiler COG tiles, with opacity slider and colormap selector
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
            Basemap toggle, opacity slider, colormap selector (raster)
            Click-to-inspect attribute popup (vector)
Sidebar (30%):
            "How this was made" — dynamic tool credits with links
            "Validation" — "{N}/{N} checks passed" with green/red indicator
            "What's next" — "Turn this into a story →" / "Talk to Development Seed →"
            Expiry countdown — "Expires in {N} day(s)"
```

### The Expiry Page

After 30 days, the map URL redirects to `/expired/{dataset-id}`. This page shows:

- **"This map has expired"** — clear, not apologetic
- **"Sandbox maps are available for 30 days."** — sets expectations
- **"Re-upload your data or talk to us about a permanent solution."** — frames the CTA
- Two buttons: **"Upload again"** (returns to home) and **"Talk to Dev Seed"** (links to developmentseed.org/contact)

The expiry page is the highest-intent CTA surface in the product. Someone cared enough to share this URL. Someone else clicked it weeks later. That click represents active interest in both the data and the tool that displayed it.

---

## 5. The Credits Panel

The credits panel is the most important design element in the product. It is the discovery mechanism — not attribution, not a footer, not an afterthought.

After someone sees their data on a map, the credits panel answers "how did this happen?" and points them directly to the open source tools that made it possible. Each credit is a clickable gateway to that tool's project page.

**Raster credits (GeoTIFF or NetCDF upload):**
```
Converted by rio-cogeo                             → github.com/cogeotiff/rio-cogeo
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
- **"Turn this into a story →"** — ambient CTA linking to Dev Seed contact. Not a form, not a popup. A natural next step.
- **"Talk to Development Seed →"** — direct engagement CTA.
- **Expiry countdown** — "Expires in {N} day(s)" calculated from creation date + 30 days.

---

## 6. Open Data Discovery Panel _(Future: v3.5)_

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

**Implementation scope:** Requires a lightweight dataset index (pre-curated, not a live search across all catalogs), a bounding box intersection service, and a data-type taxonomy. Estimated at ~2,000 lines of backend + frontend.

**Roadmap:** v3.5, after scrollytelling (v3).

---

## 7. Custom Map Application CTA _(Future: v4)_

The sandbox proves that a dataset is CNG-ready and renders correctly on a web map. It does not prove what a production-quality application built on that data looks like — one with time sliders, layer selectors, custom legends, responsive layouts, API integrations, and institutional branding.

The Custom Map Application CTA closes that gap. It connects the sandbox experience to Dev Seed's rapid map application development capability, powered by `@maptool/core` — the React component library in this repository that provides production-grade deck.gl layers, MapLibre integrations, TiTiler hooks, STAC search, animation controls, and 25+ reusable geospatial UI components.

**Positioning:** "From proof-of-concept to production map app."

**What the user has proven by this point:**
- Their data converts cleanly to CNG formats (the sandbox validated it)
- It renders on a web map (they saw it)
- Other people want to see it (they shared the URL)

**What they need next:**
- A branded, permanent web application — not a 30-day sandbox link
- Custom interactivity: time sliders, layer toggles, data filtering, search
- Integration with their existing data infrastructure or public APIs

**CTA placement (v1, already implemented):**
- Credits sidebar: **"Turn this into a story →"** and **"Talk to Development Seed →"**
- Expiry page: **"Talk to Dev Seed"** button — the highest-intent moment

**CTA evolution (v3):**
- Credits sidebar: **"Build a custom map application →"** — replaces or supplements the existing CTAs with a more specific offer
- Expiry page: **"See what a production app looks like →"** — links to a gallery of Dev Seed-built applications or a consultation intake form

This is not self-serve. It is not a product configurator. It is a Dev Seed engagement pathway — a conversation that starts because someone already has evidence their data works.

**Roadmap:** v4 (parallel to or after v3.5). Implementation is CTA copy, a landing page or gallery, and a consultation intake form.

---

## 8. Guided Self-Hosting _(Future: v2)_

When a user has seen their data on the sandbox map, a second question always follows: **"Cool — but where can I download this? How do I keep it after 30 days?"**

The Guided Self-Hosting wizard answers that directly. The sandbox is the workbench — the place to convert, validate, and preview. The wizard is the bridge from that moment of inspiration to a permanent deployment the user owns. DevSeed provides the workbench and the on-ramp; the user owns everything that comes out of it.

**Design principles:**
- **The user owns everything.** Every file, every service, every URL runs on the user's own accounts. DevSeed hosts nothing in production. If CNG Sandbox disappeared tomorrow, the user's infrastructure keeps running.
- **Progressive complexity.** Start with the simplest possible deployment and let users opt into more infrastructure only when they need it.
- **One happy path first.** Cloudflare R2 for storage, Vercel for the viewer. Expand to AWS S3 and other targets in later iterations.

**The v2 wizard (Tier 0 — static deployment):**

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

**Relationship to v1.5:**

The wizard ships after v1.5 (temporal stacks) because datasets processed through the wizard will typically have a temporal dimension. The static STAC catalog output and viewer need to support multi-file temporal stacks before the wizard delivers full value to the scientists and GEE migrants most likely to use it.

---

## 9. Formats and Pipeline (v1 Current)

### Supported Format Pairs

| Input Format | Intermediate | Final Output | Tile Serving | Rendering |
|-------------|-------------|-------------|-------------|-----------|
| GeoTIFF (.tif, .tiff) | — | COG | titiler-pgstac (PNG/WebP tiles) | deck.gl |
| NetCDF (.nc) | — | COG | titiler-pgstac (PNG/WebP tiles) | deck.gl |
| GeoJSON (.geojson) | GeoParquet | PMTiles | MinIO (HTTP range requests) | MapLibre GL JS |
| Shapefile (.zip) | GeoParquet | PMTiles | MinIO (HTTP range requests) | MapLibre GL JS |

**Vector routing:** All vector datasets go through the PMTiles path (tippecanoe → MinIO). This was originally split by geometry type (polygons/lines → PMTiles, points → tipg), but tipg's SQL builder rejects column names with special characters, making it fragile for real-world datasets. tippecanoe handles all geometry types and column names reliably.

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
  Validate (8 checks)                   Validate (10 checks)
  ↓                                     ↓
  Upload COG to MinIO (S3)              Detect geometry type
  ↓                                     ↓                ↓
  Register in pgSTAC (STAC          Polygon/Line         Point
   collection + item)                   ↓                ↓
  ↓                                tippecanoe         Load into PostGIS
  titiler-pgstac serves tiles      (--maximum-zoom=g,  tipg auto-discovers
  (deck.gl, auto-zoom to bounds)    --no-feature-limit, new table (5s TTL)
                                    --layer=default)    ↓
                                    ↓                  tipg serves MVT tiles
                                   .pmtiles → MinIO    (MapLibre)
                                    ↓
                                   MapLibre renders
                                   via range requests
```

**Key pipeline details:**
- **Progress tracking:** SSE (Server-Sent Events) with named `event: status` events. Five stages: `scanning`, `converting`, `validating`, `ingesting`, `ready`. Job timeout at 10 minutes.
- **Job processing:** FastAPI BackgroundTasks — no distributed queue needed at demo scale.
- **tippecanoe flags:** `--maximum-zoom=g` (auto-selects max zoom based on feature density, not a fixed level), `--no-feature-limit`, `--no-tile-size-limit` (never drops features — tippecanoe applies zoom-appropriate visual simplification but discards nothing), `--layer=default` (matches the source-layer name tipg uses, so the frontend rendering code works for both paths).
- **Rate limiting:** 5 uploads per IP per hour via slowapi. Enforced on both `/api/upload` and `/api/convert-url`. Returns HTTP 429 with plain-language message.
- **Storage lifecycle:** All files expire after 30 days via S3 lifecycle policy. Paths are dataset-scoped (`datasets/{id}/raw/`, `datasets/{id}/converted/`) to support multi-file temporal stacks in v1.5 without a storage rewrite.

### Tool Credits (complete list)

| Tool | Role | Maintained by |
|------|------|---------------|
| GDAL | Format detection, raster/vector I/O | OSGeo |
| rio-cogeo | GeoTIFF / NetCDF → COG conversion | Development Seed |
| xarray | NetCDF variable extraction | Community / Pangeo |
| GeoPandas | GeoJSON / Shapefile → GeoParquet conversion | Community |
| tippecanoe | GeoParquet → PMTiles tile generation | Felt |
| pgSTAC | STAC catalog storage (raster datasets) | Development Seed |
| titiler-pgstac | COG → raster tile serving (PNG/WebP) | Development Seed |
| tipg | PostGIS → vector tile serving (MVT, point datasets) | Development Seed |
| PMTiles | Self-contained vector tile archive format | Protomaps |
| MapLibre GL JS | Vector + PMTiles map rendering | MapLibre Community |
| deck.gl | Raster map rendering (WebGL) | OpenJS Foundation / vis.gl |

Four of these tools (rio-cogeo, pgSTAC, titiler-pgstac, tipg) are built and maintained by Dev Seed. This is not incidental — it is the core of the brand message.

---

## 10. Validation Suite

Runs automatically after every conversion. Results displayed in the credits sidebar. The shareable URL is only generated after all critical checks pass — a failed validation blocks sharing entirely.

### Raster Checks (8 per conversion)

Applies to GeoTIFF → COG and NetCDF → COG.

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

**Display in sidebar:**
- "8/8 checks passed" or "10/10 checks passed" (green checkmark icon)
- Warning icon (red) if any check failed, with per-check detail available

---

## 11. Product Roadmap

Each version delivers a complete, standalone value proposition. Nothing in v1 is a half-built promise of v1.5.

### v1 — "See your data on the web" _(Complete)_

Single file upload. Four input formats (GeoTIFF, NetCDF, GeoJSON, Shapefile) with geometry-aware vector routing (PMTiles for polygons/lines, tipg for points). 8–10 automated validation checks per conversion. Real-time SSE progress. Shareable URL with 30-day expiry. Credits sidebar with tool discovery links and ambient CTAs.

**The bar:** Upload to shareable map URL in under 5 minutes.

### v1.5 — "See your data change over time"

Multi-file temporal stack. Upload N files representing timesteps (e.g., annual deforestation rasters, monthly SST composites). Time slider. Frame-by-frame animation. Export to GIF/MP4. The storage architecture already supports this — dataset-scoped S3 paths accept multiple files per dataset.

**The bar:** A scientist uploads 10 years of annual rasters and watches them animate in a browser without downloading a single file. This is the demo you bring to AGU or IGARSS. The one that gets shared by NASA scientists.

### v2 — "Own your data" _(See Section 8)_

Guided Self-Hosting wizard. After the sandbox converts and validates a dataset, the wizard walks the user through deploying it to Cloudflare R2 (or AWS S3) and exporting the map viewer as a static site. The result is a permanent URL the user controls, with no lock-in to DevSeed's infrastructure.

**The bar:** A researcher with no cloud experience deploys their converted dataset to R2 and shares a permanent map URL — without writing a line of configuration.

### v3 — "Tell a story with your data"

Scrollytelling. Narrative text + map transitions. Publish to a permanent URL. The full VEDA-for-everyone vision, built on MDX-based authoring and the `@maptool/core` component library.

**The bar:** A conservationist with no dev background publishes a scrollytelling story about their field data and shares it with their board of directors.

### v3.5 — "Discover what the open data world looks like" _(See Section 6)_

Open Data Discovery Panel. After the user's data is on the map, surface 3–5 related datasets from Planetary Computer, source.coop, and NASA VEDA based on bounding box and data type. Browseable catalog links.

**The bar:** A researcher who uploaded a deforestation raster for Borneo discovers — on the same page — that the Allen Coral Atlas, Global Forest Watch, and Sentinel-2 composites for the same region already exist as cloud-native datasets.

### v4 — "Build a production map application" _(See Section 7)_

Custom Map Application CTA. A Dev Seed engagement pathway for organizations that have proven their data works in the sandbox and want a permanent, branded, interactive web application.

**The bar:** A conservation NGO that shared a sandbox link with their funder three weeks ago clicks "Talk to Dev Seed" from the expiry page and starts a conversation about a custom monitoring dashboard.

---

## 12. Success Metrics

### v1 (launch)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Upload-to-shareable-URL time | < 5 minutes (p50), < 10 minutes (p95) | Server-side job duration logs |
| Validation pass rate | 100% on all 4 input formats with zero data loss | Automated test suite against reference datasets |
| Shared URL engagement | URLs shared externally within first month | Qualitative: social media, Slack mentions, email forwards |
| Inbound inquiries | ≥ 1 inquiry/month referencing the sandbox | CRM tracking, contact form attribution |

### v1.5 (temporal)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Temporal upload success | 10+ file stacks render as animation | E2E test with reference temporal datasets |
| Conference demo usage | Used in ≥ 2 conference presentations | Internal tracking |

### v2 (guided self-hosting)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Wizard completion rate | ≥ 30% of users who start the wizard complete a deployment | Frontend funnel analytics |
| Successful R2 deployments | ≥ 10 deployments in first month post-launch | Backend deployment logs |
| Permanent URL longevity | Deployed URLs still resolving 90 days after creation | Periodic link checks |

### v3.5 (discovery)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Discovery click-throughs | ≥ 20% of map page visitors click a suggested dataset | Frontend analytics |
| Ecosystem partner mentions | source.coop or Planetary Computer links to sandbox | Partner outreach tracking |

### v4 (custom app CTA)
| Metric | Target | Measurement |
|--------|--------|-------------|
| CTA click-through rate | ≥ 5% of map page visitors click a CTA | Frontend analytics |
| Engagement conversations | ≥ 1 qualified lead/quarter from sandbox CTAs | CRM attribution |

---

## 13. Out of Scope

These items are explicitly deferred. Some are roadmap candidates; others are architectural decisions.

| Item | Reason |
|------|--------|
| Email capture or user accounts | Demo service — zero friction is the product |
| Story authoring UI | v2 roadmap |
| Paid tiers or subscriptions | Not a SaaS play |
| Batch / directory upload | v1 is single-file; multi-file comes in v1.5 as temporal stacks |
| HDF4 support | Dependency complexity (outdated format, rarely encountered) |
| Kerchunk / VirtualiZarr for NetCDF | Optimization for large NetCDF — not needed at demo scale |
| Self-hosted distribution of the sandbox app itself | The sandbox is the hosted service — the wizard helps users deploy their *data*, not a copy of the tool |
| Attribute-based choropleth styling | Requires a style editor UI — deferred to post-v1 |
| Raster pixel value inspection | Requires click-to-query against TiTiler — deferred to post-v1 |

---

## Changelog

- v0.1–v0.4: Internal engineering spec (see `CNG_SANDBOX_PRODUCT_SPEC_v0.4.md`)
- v1.1: Added Guided Self-Hosting as v2 roadmap item (Section 8). Updated "What This Is / Is Not" to reflect sandbox-as-workbench framing. Inserted v2 into roadmap and success metrics; shifted scrollytelling to v3, discovery to v3.5, custom app CTA to v4. Removed "write-back to user's cloud storage" from out of scope (now in scope via wizard). Clarified self-hosted distribution of the sandbox app itself remains out of scope.
- v1.0: Rewritten as stakeholder-ready PRD. Key changes from v0.4:
  - Vector pipeline updated: polygon/line data now routes through tippecanoe → PMTiles (served via range requests from object storage); point data continues through PostGIS → tipg. Pipeline diagram reflects actual geometry-aware routing.
  - Validation check counts corrected: 8 raster checks (unchanged), 10 vector checks (was 7 — added geometry type, bounds, and lowercase column checks during implementation).
  - Rate limit corrected: 5/hour (was stated as 5/minute in v0.4).
  - SSE stages corrected: `scanning → converting → validating → ingesting → ready` (was "registering" in earlier drafts).
  - Added Open Data Discovery Panel (Section 6, v2.5 roadmap).
  - Added Custom Map Application CTA (Section 7, v3 roadmap) connecting sandbox to `@maptool/core` and Dev Seed professional services.
  - Added shared URL experience and expiry page sections (Section 4) — restored from v0.4, updated to reflect implementation.
  - Success metrics expanded with concrete targets and measurement methods per roadmap stage.
  - Out of scope converted to table with rationale per item.
  - Roadmap stages v2.5 and v3 now include "The bar" acceptance criteria.
  - Tone shifted from implementation notes to product narrative throughout.
