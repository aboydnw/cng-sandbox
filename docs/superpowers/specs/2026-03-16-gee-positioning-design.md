# CNG Sandbox — GEE Positioning Design Spec

**Date:** 2026-03-16
**Status:** Approved for implementation planning
**Author:** Anthony Boyd / Claude Code

---

## Overview

This spec defines the strategy and user stories for positioning the CNG Sandbox toward Google Earth Engine (GEE) users. The timing is driven by GEE's noncommercial quota tiers taking effect **April 27, 2026**, creating a structural moment where academic and cost-sensitive users are actively evaluating alternatives.

The approach is two-phase:
1. **Content Sprint** — framing, landing page, and one product tweak. Ships before April 27.
2. **v1.75 milestone** — new product features that turn GEE exports into CNG-native data. Depends on v1.5 (temporal stacks) shipping first.

This work inserts between the existing v1.5 (temporal stacks) and v2 (scrollytelling) milestones. The existing roadmap sequence is otherwise unchanged.

---

## Strategic Positioning

**CNG Sandbox is not a GEE replacement.** GEE's planetary-scale compute remains unmatched for its core use cases. The sandbox targets a specific, underserved moment: a GEE user has exported their data, left Google's walled garden, and has no idea what to do next.

The primary message to GEE users: **"Learn the formats that let you stop paying for compute you don't need."** Many operations GEE charges EECU-hours for — tile rendering, collection filtering, app serving — are operations that CNG formats handle without a compute layer at all.

Differentiators over leafmap (the closest existing migration path) for this audience:
- Zero setup (no Python, no Jupyter, no conda)
- Interactive format inspection with teaching moments
- Visual map building, not code
- "Built by the makers" trust from DevSeed's authorship of TiTiler, pgSTAC, tipg, rio-cogeo

---

## Roadmap

| Phase | Milestone | Timing | Description |
|-------|-----------|--------|-------------|
| 0 | v1 | Complete | Single file upload, shareable map, credits sidebar |
| 1 | **Content Sprint** | Now → April 27, 2026 | GEE landing page, blog post, file size bump, sidebar callouts |
| 2 | v1.5 | Q2 2026 (~4–6 weeks post-content sprint) | Temporal stacks, time slider, animation, GIF/MP4 export |
| 3 | **v1.75** | Q3 2026 (after v1.5 ships) | STAC catalog generation, COG optimization teaching, GEE→CNG concept map, multi-tile ingest |
| 4 | v2 | Unchanged | Scrollytelling |
| 5 | v2.5 | Unchanged | Open Data Discovery Panel |
| 6 | v3 | Unchanged | Custom Map Application CTA |

**Note:** v1.75 is blocked on v1.5 shipping. GEE-9 (multi-tile ingest) extends the multi-file upload infrastructure introduced in v1.5 and cannot be scoped or estimated until that architecture is finalized.

---

## GEE-Origin Detection

Several stories (GEE-3, GEE-10, and the expiry page in GEE-4) require knowing whether a dataset originated from GEE. Detection is **heuristic, not authoritative** — the system makes a best-effort determination based on filename patterns. No user registration or checkbox required.

**Detection rule:** A dataset is flagged as GEE-origin if one or more uploaded filenames match any of these patterns:
- GEE tile pattern: `{prefix}-\d{10}-\d{10}\.tif`  (e.g., `image-0000000000-0000000001.tif`)
- GEE date export pattern: `{prefix}_\d{8}\.tif` (e.g., `ndvi_20230601.tif`)
- GEE default export name: starts with `ee-export` or `ee_export`

If detection fires, the `dataset` record gains a `gee_origin: true` flag. This flag drives:
- Credits sidebar "Coming from GEE?" callout (GEE-3)
- Credits sidebar "What's next" compute pathway callout (GEE-10)
- Expiry page GEE-specific copy (GEE-4)

False positives (non-GEE files that match the pattern) are acceptable — the callouts are informational and not harmful if shown incorrectly.

---

## User Stories — Content Sprint

### GEE-B1 — Blog post

**As** Development Seed,
**I want to** publish a post explaining GEE's April 2026 quota changes and how CNG formats address the underlying cost and portability problems,
**so that** GEE-adjacent communities (CNG Forum, geemap community, Spatial Thoughts readers) discover the sandbox at the moment they're looking for alternatives.

**Acceptance criteria:**
- Published on the DevSeed blog before April 27, 2026
- Cross-posted or announced in the CNG Forum Slack and newsletter
- Covers: what the quota changes mean, the 5 CNG patterns that eliminate EECU costs, and a direct CTA to `sandbox.devseed.com/from-gee`
- Written by a DevSeed staff member *(process note, not a blocking criterion)*

---

### GEE-1 — Landing page

**As a** GEE user who just exported GeoTIFFs and doesn't know what to do next,
**I want to** find a page that speaks directly to my situation,
**so that** I know the sandbox is built for this exact moment.

**Acceptance criteria:**
- Page lives at `sandbox.devseed.com/from-gee`
- Leads with the "exported from GEE, now what?" framing
- Includes a two-column table: "In GEE you… / In CNG you…" covering at minimum: `ee.ImageCollection`, `ee.Image`, `Map.addLayer()`, `Export.image.toDrive()`, `GEE App`
- Explains the 5 CNG patterns that eliminate EECU costs: range requests, STAC search, client-side rendering, selective processing, static hosting
- Includes a "Where do I run my analysis?" section listing: Google Colab (free, familiar), Microsoft Planetary Computer Hub (managed Jupyter), Pangeo JupyterHub (open, scalable). Framing: "CNG Sandbox is the format and catalog layer. These are the compute layers."
- CTA: "Upload your first export →" links to the sandbox upload page
- Mobile-responsive layout (no separate mobile design required — standard responsive CSS is sufficient)

---

### GEE-2 — File size limit

**As a** GEE user,
**I want to** upload exported GeoTIFFs up to 2 GB,
**so that** I don't have to preprocess or split my files before using the sandbox.

**Acceptance criteria:**
- `MAX_UPLOAD_BYTES` in the ingestion service raised from 1,073,741,824 (1 GB) to 2,147,483,648 (2 GB). Same limit applies to URL ingest (`MAX_FETCH_BYTES`).
- Rate limit unchanged (5 uploads/IP/hour)
- Error message for oversized files: "File too large. GEE may split large exports into tiles — upload each tile separately." (Softened from the original to account for variable GEE split thresholds.)

---

### GEE-3 — Credits panel GEE callout

**As a** GEE user viewing my converted data on the map,
**I want to** see a GEE→CNG callout in the credits sidebar,
**so that** I can connect what I already know to what I'm seeing — and know that a fuller concept map exists.

**Acceptance criteria:**
- A "Coming from GEE?" expandable section appears in the credits sidebar when `gee_origin: true` (per GEE-Origin Detection section above)
- Shows one concept mapping relevant to the conversion path: e.g., "In GEE, you'd visualize this with `Map.addLayer(image)`. Here, TiTiler serves the same tiles via HTTP — no EECU cost per view."
- Links to `/from-gee` for the full concept map
- In v1.75, when the full concept map panel (GEE-8) ships, this callout becomes a link to open that panel rather than navigating away. Until GEE-8 ships, it links to `/from-gee`.

---

### GEE-4 — Expiry page GEE copy

**As a** GEE user whose sandbox map has expired,
**I want to** see copy that acknowledges the quota context,
**so that** I'm prompted to think about CNG as an alternative rather than just re-uploading.

**Acceptance criteria:**
- When `gee_origin: true`, the expiry page adds: "Hosting this data as a COG on S3 costs approximately $0.02/month for a 1 GB file (AWS us-east-1 standard storage at $0.023/GB/month, excluding request costs)."
- "Talk to Dev Seed" CTA present as normal

---

## User Stories — v1.75 "Catalog Your Exports"

> **Prerequisite:** All v1.75 stories depend on v1.5 (temporal stacks) shipping first. GEE-9 in particular cannot be estimated until the v1.5 multi-file upload API is finalized.

### GEE-5 — STAC Item generation

**As a** GEE user with multiple exported GeoTIFFs,
**I want to** have the sandbox generate a STAC Item for each file I upload,
**so that** my data becomes described, searchable, and portable in an open format.

**Acceptance criteria:**
- Multi-file GeoTIFF upload reuses the v1.5 multi-file UI (exact UI flow to be defined in v1.5 spec). Files are grouped into a single dataset via the v1.5 grouping mechanism.
- For each file, the sandbox generates a valid STAC Item with:
  - `bbox` and `geometry`: derived from the file's CRS-projected bounds
  - `datetime`: inferred from filename if it matches `_YYYYMMDD` or `-YYYYMMDD` suffix (e.g., `ndvi_20230601.tif` → `2023-06-01T00:00:00Z`). If no date found, `datetime` is set to `null` with `start_datetime` and `end_datetime` both set to the file's modification time. **Limitation:** the file modification time on the server reflects the upload timestamp, not the original dataset date — the exported STAC catalog will show a 2026 timestamp for data originally created in, say, 2023. A warning is shown in the catalog JSON preview: "No date found in filename. Temporal metadata may be inaccurate — update `datetime` in the exported catalog before publishing."
  - `assets`: single `data` asset with `href` pointing to the COG in MinIO, `type: "image/tiff; application=geotiff; profile=cloud-optimized"`, `roles: ["data"]`
- STAC Items are displayed in the credits sidebar with a collapsible JSON preview
- Items validate against STAC 1.1.0 spec (use `pystac` validation)

---

### GEE-6 — Static STAC catalog export

**As a** GEE user who has generated STAC Items,
**I want to** download a static STAC catalog I can host anywhere,
**so that** my data is accessible to any STAC-compatible tool without depending on GEE or Google Cloud.

**Acceptance criteria:**
- "Export catalog" button in credits sidebar downloads a `.zip` containing: `catalog.json`, `collection.json`, one `{item-id}.json` per file
- Asset `href` values in the exported Items are **relative paths** (e.g., `./data.tif`) rather than absolute MinIO URLs. The catalog is self-contained and portable — users bring their own COG files alongside the catalog, or re-upload them to their own storage.
- A `README.md` is included in the zip explaining: "Update the `href` in each item's `assets` to point to where you've hosted your COG files, then host the catalog on S3, GitHub Pages, or any static server. This can be automated with pystac or a one-liner: `sed -i 's|./data.tif|https://your-bucket/path/data.tif|g' items/*.json`"
- Catalog validates as a valid static STAC catalog per STAC 1.1.0 spec
- A "What can I do with this?" expandable section links to: STAC Browser (for browsing), QGIS native STAC (for desktop GIS), and leafmap (framed as: "If you're comfortable with Python, leafmap can load your catalog in one line of code")

---

### GEE-7 — Non-optimized GeoTIFF detection and teaching

**As a** GEE user who uploaded a standard (non-COG) GeoTIFF,
**I want to** have the sandbox offer to optimize it and show me what changed,
**so that** I understand why COG matters without reading documentation.

**Acceptance criteria:**
- After upload, if `rio-cogeo validate` returns `valid=False`, a banner appears: "This file isn't cloud-optimized yet. Optimize it to COG? [Optimize] [Skip]"
- Optimization is **opt-in** (user clicks "Optimize"), not automatic. "Skip" proceeds with the original file.
- After optimization, the credits sidebar shows a "COG optimization" card with: file size before/after, internal overviews (before: 0 levels, after: N levels), internal tiling (before: none, after: 512×512 tiles)
- Card includes: "Internal tiling lets any viewer fetch only the pixels it needs via HTTP — no full download required."
- The existing 8-check validation suite runs against the optimized output

---

### GEE-8 — GEE → CNG concept map panel

**As a** GEE user exploring a map in the sandbox,
**I want to** open a reference panel that maps GEE concepts to open-stack equivalents,
**so that** I can build on my existing mental model without leaving the sandbox.

**Acceptance criteria:**
- A "Coming from GEE?" button appears in the map page header (desktop) as a secondary action alongside the share and new-upload buttons. On mobile, it appears in the overflow/hamburger menu.
- Button opens a slide-in drawer (not a modal — must not obscure the map on desktop)
- Drawer shows a two-column table: GEE concept → CNG equivalent, covering: `ee.Image`, `ee.ImageCollection`, `ee.Reducer`, `Export.image.toDrive()`, `Map.addLayer()`, `ee.FeatureCollection`, `GEE App`
- Each CNG equivalent links to the relevant tool's homepage
- When GEE-8 ships, GEE-3's credits callout links to open this drawer rather than navigating to `/from-gee`

---

### GEE-9 — Multi-tile export ingest

**As a** GEE user whose large export was auto-split into tiles (e.g., `image-0000000000-0000000000.tif`, `image-0000000000-0000000001.tif`),
**I want to** upload all tiles together as a single dataset,
**so that** I can work with my full export without manually merging files first.

**Acceptance criteria:**
- Multi-file upload (via v1.5 infrastructure) detects GEE tile naming pattern: `{prefix}-\d{10}-\d{10}\.tif`
- If pattern matches: files are treated as **spatial tiles** (not timesteps) and mosaicked into a single COG using GDAL `gdal_merge` or `rio-cogeo` mosaic. User sees a confirmation before mosaicking: "These look like GEE export tiles. Mosaic them into a single image? [Mosaic] [Treat as separate files]"
- If pattern does not match: files are treated as timesteps per standard v1.5 behavior
- Mosaic output: single COG with bounding box spanning all tiles
- Progress tracker adds a `Mosaicking` step: `Scanning → Mosaicking → Converting → Validating → Ingesting → Ready`
- If mosaicking fails (e.g., non-overlapping CRS, incompatible band counts), error message specifies the failure reason and suggests the user re-export from GEE with consistent settings
- **Scope note:** Exact implementation approach (gdal_merge vs. rio-cogeo mosaic vs. VRT) to be decided during v1.5 planning when the multi-file architecture is known. Note: `gdal_merge` does not produce a COG directly — a subsequent `rio-cogeo create` pass is required. COG validity is enforced by the existing 8-check validation suite post-mosaic.

---

### GEE-10 — Compute pathway callout

**As a** GEE user worried that CNG has no compute layer,
**I want to** see a clear explanation of where I can run analysis,
**so that** I understand what the sandbox is for and have a concrete next step beyond it.

**Acceptance criteria:**
- Credits sidebar "What's next" section, when `gee_origin: true`, adds a "Where do I run analysis?" item listing: Google Colab, Microsoft Planetary Computer Hub, Pangeo JupyterHub — each with a one-line description and link
- Framing: "CNG Sandbox handles formats and catalogs. For computation, these platforms work natively with CNG formats."
- Same content is present on the `/from-gee` landing page (GEE-1)

---

## Out of Scope

| Item | Reason |
|------|--------|
| GEE-compatible compute layer | Off-strategy, massively expensive, competes on Google's strongest ground |
| GEE API compatibility shim | Brittle, sends the wrong message — point is to learn the open stack |
| GEE account integration | Adds complexity, ties us to Google's API changes |
| Full STAC API (dynamic) | Static catalog export is sufficient for v1.75; dynamic API is eoAPI's role |
| Competing with leafmap on Python | leafmap already serves Python-comfortable users well — link to it, don't duplicate it |

---

## Success Metrics

| Phase | Metric | Target | Measurement |
|-------|--------|--------|-------------|
| Content Sprint | `/from-gee` page sessions in first 30 days | Baseline (no prior data) | Analytics |
| Content Sprint | Upload volume week-over-week after April 27 | Measurable uplift vs. prior 4-week average | Server logs |
| Content Sprint | Blog post shares / community mentions | ≥ 1 mention in CNG Forum, geemap community, or Spatial Thoughts | Manual tracking |
| v1.75 | STAC catalog exports per week | ≥ 10 in first month post-launch | Server logs |
| v1.75 | Inbound inquiries referencing GEE migration | ≥ 1 per quarter | CRM attribution |

> **Note:** Credits sidebar expansion rate requires frontend event instrumentation not currently in place. This metric is deferred until analytics are added.

---

## Key References

- [GEE Noncommercial Tiers (April 2026)](https://developers.google.com/earth-engine/guides/noncommercial_tiers)
- [CNG Community Challenges 2025](https://cloudnativegeo.org/blog/2025/07/challenges-for-the-cng-community-2025)
- [Spatial Thoughts GEE Quota Monitoring](https://spatialthoughts.com/2026/02/09/gee-quota-monitoring/)
- [Pangeo: Closed Platforms vs. Open Architectures](https://medium.com/pangeo/closed-platforms-vs-open-architectures-for-cloud-native-earth-system-analytics-1ad88708ebb6)
- [GEE Economics (Christopher Ren)](https://christopherren.substack.com/p/the-economics-of-earth-engine)
- [CNG Sandbox PRD v1.0](../CNG_SANDBOX_PRD_v1.0.md)
- [GEE to CNG Migration Opportunity](../GEE_to_CNG_Migration_Opportunity.md)
- [CNG Sandbox Competitive Landscape](../CNG_Sandbox_Competitive_Landscape_and_Market_Opportunity.md)
