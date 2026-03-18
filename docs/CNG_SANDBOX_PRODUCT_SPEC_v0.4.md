# Open Source CNG Sandbox — Product Spec v0.4

## Vision

A demo service where anyone — conservationist, scientist, GIS analyst — can upload their legacy geospatial data, watch it become a live cloud-native web map in minutes, and discover for the first time that the open source geospatial stack is powerful, accessible, and free.

This is not a toolkit people deploy. It is a **demo service** — a science fair exhibit that happens to be on the internet permanently. Dev Seed hosts it, maintains it, and it quietly generates inbound. The open source tools get discovered through the experience, not through a README.

**The bar for v1:** Upload to shareable map URL in under 5 minutes.

---

## Problem Statement

The mental barrier to adopting cloud-native geospatial (CNG) formats is high. Scientists and conservationists know their data is locked in legacy formats (GeoTIFF, Shapefile, NetCDF). They've heard about COG and GeoParquet. But the path from "I have a .shp file" to "I have a live web map I can share" is opaque, technical, and fragmented across a dozen tools nobody has heard of.

Esri Storymaps solves this — but only if you're already in the Esri ecosystem and have clean data. There is no equivalent entry point for the open source stack.

---

## What This Is Not

- Not a toolkit people self-host
- Not a data hosting business
- Not a competitor to QGIS or ArcGIS
- Not a full storytelling platform in v1
- Not a SaaS with accounts or subscriptions

---

## Product Layers

### Layer 1 — CLI Toolkit (Open Source)
Standalone conversion + validation scripts. Runs anywhere. No Dev Seed dependency. MIT licensed. Lives on GitHub. For developers who want to go deep or build their own pipeline.

Formats supported in v1:
| Input | Output | Tools credited |
|---|---|---|
| GeoTIFF (.tif, .tiff) | COG | GDAL, rio-cogeo |
| Shapefile (.shp + companions) | GeoParquet | GeoPandas, GDAL |
| GeoJSON (.geojson) | GeoParquet | GeoPandas |
| NetCDF (.nc) | COG | GDAL, xarray |

### Layer 2 — Dev Seed Demo Service (Hosted)
The full experience. Upload a file or point at a cloud URL. Watch it convert. See it on a map. Share the URL. The entire page is Dev Seed-branded — no watermark needed. Every element of the experience communicates who built this and how.

This is where scientists and conservationists discover the open source stack through their own data. The CLI toolkit is what developers find when they want to go deeper.

---

## User Journey (v1)

```
1. Land on the tool (sandbox.devseed.com or similar)
2. Upload a file OR paste a cloud storage URL (S3, GCS, HTTP)
3. Format detected automatically, conversion starts, progress shown
4. Live map preview of converted data
5. Credits panel: see exactly which open source tools processed the file
6. Copy shareable URL
7. Optional: explore map tools (layer controls, attribute inspector, basemap toggle)
8. Optional: follow tool links to TiTiler, STAC, VEDA stories, MapLibre docs
```

---

## The Credits Panel

This is the most important design element in the product. It is the discovery mechanism — not attribution, not a footer, not an afterthought.

After someone sees their data on a map, the credits panel answers "how did this happen?" and points them directly to the tools that made it possible.

Each credit is a gateway:

```
Your file was converted by rio-cogeo           → [github.com/cogeotiff/rio-cogeo]
Tiles served by TiTiler                        → [developmentseed.org/titiler]
Cataloged by pgSTAC                            → [github.com/stac-utils/pgstac]
Map rendered by MapLibre GL JS                 → [maplibre.org]
Turn this map into a story                     → [Dev Seed contact]
```

Credits are dynamic based on the conversion path — raster datasets show rio-cogeo + TiTiler, vector datasets show GeoPandas + tipg.

"Turn this map into a story" is the sales moment. Not a form. Not a popup. A natural next step that leads to a Dev Seed engagement conversation.

---

## The Shared URL Experience

The shared URL opens the same map page as the uploader sees — not a separate "shared" view. The recipient gets the full Dev Seed-branded experience: the map, the credits panel, the share button, and the "What's next" CTAs.

The recipient is often a more valuable lead than the person who uploaded — a program officer, a funder, a colleague at another institution seeing this for the first time.

**Map page structure (`/map/:id`):**
```
Header:     Dev Seed logo + "CNG Sandbox" + Share button + New Upload button
Map (70%):  Raster (deck.gl + TiTiler) or Vector (MapLibre MVT via tipg)
            Basemap toggle, opacity slider, colormap selector (raster)
Sidebar (30%): Credits panel
            "How this was made" — tool credits with links
            "Validation" — check results (e.g. "8/8 checks passed")
            "What's next" — "Turn this into a story →", "Talk to Dev Seed →"
            Expiry countdown
```

No watermarks. No popups. No interruptions.

---

## CTA Strategy

CTAs are ambient, not aggressive. They appear at natural moments of curiosity or transition — never during the core upload → convert → preview flow.

| Moment | CTA |
|---|---|
| After map loads | "Turn this into a story →" (credits sidebar) |
| Credits panel | Links to each open source tool |
| Credits sidebar | "Talk to Development Seed →" |
| After 30-day expiry | "Upload again" + "Talk to Dev Seed" |

The expiry page is the highest-intent CTA moment. The user cared enough to share the URL. Someone clicked it weeks later.

---

## Ingestion Workflow

### Input Methods (v1)
- **File upload**: drag and drop or file picker, max 1GB
- **Cloud URL**: paste an S3, GCS, or HTTP direct URL to a supported file (http/https only — other schemes rejected for SSRF prevention)

### Security Requirements
- File type whitelist enforced server-side — check magic bytes, not just extension
  - Allowed: .tif, .tiff, .zip (shapefiles), .geojson, .json, .nc
  - Reject everything else with a plain-language error message
- 1GB hard cap enforced at upload layer, before processing begins
- Rate limiting: max 5 uploads per IP per minute
- URL scheme validation: only http and https allowed (prevents SSRF)
- No public bucket listing — all S3 URLs are unguessable UUIDs
- Raw uploads and converted outputs in dataset-scoped S3 paths

**Deferred to post-v1 hardening:** ClamAV malware scan, WAF, abuse monitoring.

### Processing Pipeline
```
File received (upload or URL fetch)
  ↓
Security: magic bytes + extension whitelist + 1GB size cap
  ↓
Format detection → raster or vector path
  ↓
RASTER PATH:                          VECTOR PATH:
  Convert to COG (rio-cogeo)            Convert to GeoParquet (geopandas)
  ↓                                     ↓
  Validate (8 checks)                   Validate (9 checks)
  ↓                                     ↓
  Extract bounds for auto-zoom          Extract bounds for auto-zoom
  ↓                                     ↓
  Upload COG to S3/MinIO                Upload GeoParquet to S3/MinIO
  ↓                                     ↓
  Create STAC collection + item         Load into PostgreSQL (geopandas)
  ↓                                     ↓
  Ingest into pgSTAC                    tipg auto-discovers the new table
  ↓                                     ↓
  titiler-pgstac serves tiles           tipg serves vector tiles (MVT)
  ↓                                     ↓
  Return tile URL + dataset metadata    Return tile URL + dataset metadata
```

Progress updates are delivered via **SSE (Server-Sent Events)** — simpler than WebSockets for one-directional status updates. Processing uses **FastAPI BackgroundTasks** — no distributed job queue needed at demo scale.

### S3 Lifecycle Policy
```json
{
  "Rules": [{
    "ID": "expire-sandbox-files",
    "Status": "Enabled",
    "Expiration": { "Days": 30 },
    "Filter": { "Prefix": "sandbox/" }
  }]
}
```

### Failure Handling
Every failure returns a plain-language message. No stack traces shown to users.

---

## QA + Validation Suite

Runs automatically after every conversion. Results shown in the credits sidebar. The shareable URL is only generated after all critical checks pass.

### Raster (GeoTIFF → COG, NetCDF → COG)
| Check | Method | Pass Condition |
|---|---|---|
| COG structure valid | rio-cogeo validate | valid=True |
| CRS preserved | Compare EPSG codes | Exact match |
| Bounding box preserved | Compare bounds | Within 1e-6 degrees |
| Pixel dimensions | Compare width/height | Exact match |
| Band count | Compare band count | Exact match |
| Pixel value fidelity | Sample 1000 random pixels | Max diff < 1e-4 (float), exact (int) |
| NoData preserved | Compare nodata attribute | Exact match |
| Overview levels present | Check internal overviews | ≥ 3 levels |

### Vector (Shapefile → GeoParquet, GeoJSON → GeoParquet)
| Check | Method | Pass Condition |
|---|---|---|
| Row count preserved | Compare len(gdf) | Exact match |
| CRS preserved | Compare CRS string | Exact match |
| Column names preserved | Compare column sets | Exact match |
| Geometry validity | is_valid.all() | True |
| Geometry fidelity | Sample 100 geometries | Exact WKT match |
| Attribute fidelity | Sample 100 rows | Exact match all fields |
| GeoParquet spec compliance | Check parquet geo metadata | Present and valid |

Validation results displayed as:
- ✅ "8/8 checks passed" (green)
- ⚠️ Warnings for non-critical issues
- ❌ Critical check failed — conversion rejected

---

## Map Preview UI

Built on **deck.gl** (raster, via @maptool/core) and **MapLibre GL JS** (vector, native MVT), with **Chakra UI** for the application shell. Uses the `@maptool/core` library for reusable map components and hooks.

**v1 features:**
- Raster: COG tiles via TiTiler (`useTitiler` + `createCOGLayer`), opacity slider, colormap selector, color-scaled legend
- Vector: MVT tiles via tipg (MapLibre native vector source), fill/line/circle layers for all geometry types, click-to-inspect popup
- Basemap toggle (streets, satellite, dark)
- Auto-zoom to dataset extent on load
- Copy shareable URL button (prominent, in header)
- Credits sidebar (30% width, always visible on desktop)

**Not in v1:**
- Scrollytelling / story authoring
- Time slider
- Side-by-side comparison
- Drawing or editing tools
- User accounts or saved maps
- Attribute-based choropleth styling (deferred)
- Pixel value inspection for rasters (deferred)

---

## Sharing Model

- Every converted dataset gets a UUID-based URL: `sandbox.devseed.com/map/a3f9c2b1`
- URL is live for 30 days from conversion date
- Shared URL opens the same map + credits page
- After 30 days: friendly expiry page with re-upload CTA and "Talk to Dev Seed" option

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Chakra UI v3, @maptool/core (deck.gl + MapLibre), react-router-dom |
| Backend | FastAPI, Python 3.13, pydantic-settings, SSE (sse-starlette) |
| Conversion | rio-cogeo (raster), geopandas (vector), xarray (NetCDF) |
| Tile serving | eoAPI: titiler-pgstac (raster), tipg (vector), pgSTAC (catalog) |
| Storage | AWS S3 / MinIO (local dev), 30-day lifecycle policy |
| Job processing | FastAPI BackgroundTasks (no distributed queue for demo scale) |
| Security | python-magic (magic bytes), slowapi (rate limiting), pydantic URL validation (SSRF) |
| Hosting | Dev Seed managed infra (AWS) |

---

## Infrastructure: eoAPI Stack

The demo service uses **eoAPI** — Dev Seed's bundled geospatial API stack — for all data serving after conversion:

| Service | Port | Purpose |
|---------|------|---------|
| pgSTAC (PostgreSQL + PostGIS) | 5439 | STAC catalog + vector data storage |
| STAC API | 8081 | STAC metadata endpoints |
| titiler-pgstac | 8082 | Raster tile serving (COG → PNG/WebP tiles) |
| tipg | 8083 | Vector tile serving (PostgreSQL → MVT tiles) |
| MinIO | 9000 | S3-compatible storage (local dev) |

Docker Compose manages all services locally. Production uses eoAPI CDK (Lambda + Aurora Serverless + CloudFront).

---

## Product Roadmap

Each version has a complete, standalone value prop. Nothing in v1 is a half-built promise of v1.5.

### v1 — "See your data on the web"
Single file. Upload → convert → map → share. Ship it. Get it in front of scientists. Prove the ingestion pipeline works and the conversion skills are trustworthy.

**The bar:** Upload to shareable map URL in under 5 minutes.

### v1.5 — "See your data change over time"
Multi-file temporal stack. Time slider. Animation. This is the demo you bring to AGU or IGARSS. The one that gets shared by NASA scientists. This is where COG earns its reputation — streaming just the tiles you need, for just the timestep you're looking at, from a stack of files in S3.

**The bar:** A scientist uploads 10 years of annual rasters and watches them animate in a browser without downloading a single file.

### v2 — "Tell a story with your data"
Scrollytelling. Map widgets. Publish to the web. The full VEDA-for-everyone vision. Builds directly on the MDX-based authoring and map components Dev Seed has already built.

**The bar:** A conservationist with no dev background publishes a scrollytelling story about their field data and shares it with their board of directors.

---

## Storage Architecture Note (Designed for v1.5)

Even though v1 is single-file, the S3 storage structure is designed to support multiple files from day one. This makes v1.5 an unlock, not a rewrite.

**Dataset-scoped paths:**
```
sandbox/datasets/{dataset_id}/raw/{filename}
sandbox/datasets/{dataset_id}/converted/{filename}
```

In v1, every dataset has exactly one file. In v1.5, a dataset has N files with temporal metadata. The storage structure, the shareable URL, and the tile integration all stay the same — the UI just gains a time slider.

---

## Success Metrics (v1)

- Upload to shareable map URL in < 5 minutes (p50)
- Validation suite passes on all 4 format pairs with zero data loss
- Shared map URLs circulating in the wild (qualitative signal)
- Inbound inquiries referencing the sandbox (business signal)

---

## Out of Scope (Future)

- Email capture
- User accounts
- Story authoring UI
- Paid tiers
- Batch / directory processing
- HDF4 support (dependency complexity — added post v1)
- Kerchunk / Virtualizarr path for NetCDF
- Write-back to user's own cloud storage
- Self-hosted web UI distribution

---

## Changelog

- v0.1: Initial spec
- v0.2: Removed self-hostable Layer 2. Product is a demo service, not a deployable toolkit. Credits panel elevated to primary design feature. Shared URL reframed as full experience page. Watermark concept replaced by ambient Dev Seed branding throughout. CTA strategy clarified as ambient and moment-based. Expiry page identified as highest-intent CTA surface.
- v0.3: Added v1/v1.5/v2 product roadmap. v1 is single file, v1.5 adds temporal stacks and animation, v2 adds scrollytelling and publishing. Added storage architecture note — dataset-scoped S3 paths required in v1 to avoid rewrite at v1.5.
- v0.4: Updated to reflect implementation decisions. Tailwind → Chakra UI (matches @maptool/core). WebSockets → SSE. Celery+Redis → FastAPI BackgroundTasks. ClamAV deferred to post-v1. Added eoAPI stack details (pgSTAC, titiler-pgstac, tipg). Shared URL is same page as uploader (no separate SharedPage). Credits panel is a sidebar, not collapsible. Updated tech stack table. Added SSRF prevention. Removed references to gdalinfo format detection (uses python-magic). Updated pipeline diagram to match actual implementation.
