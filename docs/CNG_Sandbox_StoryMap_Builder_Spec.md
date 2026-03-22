# CNG Sandbox StoryMap Builder — Product Spec

**Version:** 1.1
**Status:** Chapter types shipped · This spec covers next phases (publishing, mapping dictionaries, interactions, "Show Your Work")
**Parent PRD:** CNG_SANDBOX_PRD_v2.1.md
**Purpose:** Spec for implementation by Claude Code / Cursor

---

## 0. What's Already Built

The StoryMap Builder thin slice is live. Before implementing anything in this spec, confirm the current state by reviewing the existing codebase. The following is implemented per PRD v2.0:

**Shipped:**
- Story data model with chapters, map state, layer config
- Visual chapter editor with markdown narrative text
- Map state capture (center, zoom, bearing, pitch) per chapter
- Chapter drag-and-drop reordering
- Scrollama-based reader with fly-to transitions
- Per-chapter layer styling: `LayerConfig` with `colormap`, `opacity`, `basemap`, `band` (optional), `timestep` (optional)
- API-backed persistence (SQLAlchemy + PostgreSQL) with full CRUD
- Story routes: `/story/new`, `/story/:id`, `/story/:id/edit`, `/story/:id/embed`
- Story API: `POST/GET/PATCH/DELETE /api/stories`
- Credits panel "Turn this into a story" → editor link
- Iframe embed route
- **Chapter types** — three distinct chapter types with type-specific rendering:
  - **Scrollytelling** (default): Guided scroll-driven experience. Consecutive scrollytelling chapters auto-group into Scrollama blocks with a shared sticky map and fly-to camera transitions. Map interaction (pan/zoom/rotate) is disabled — the scroll drives the camera.
  - **Prose**: Text-only chapter rendered as centered markdown content, no map. For introductions, conclusions, or narrative sections that don't need a map.
  - **Map**: Narrative text above an interactive embedded map with zoom controls and a legend. Readers can freely pan, zoom, and explore the data.
- **Multi-dataset stories** — each chapter can reference a different dataset via per-chapter `LayerConfig.dataset_id`. Dataset selector and "+ Add" upload button in the editor.
- **Chapter type migration** — old stories without a `type` field are automatically migrated to `"scrollytelling"` on load. Backward compatible.

**In progress:**
- Per-chapter band selection and timestep selection for temporal stories

**Not started (this spec covers these):**
- ~~Static export (downloadable ZIP)~~ → See [Story Publishing Pipeline spec](superpowers/specs/2026-03-21-story-publishing-design.md)
- ~~Vercel / GitHub Pages deploy~~ → See [Story Publishing Pipeline spec](superpowers/specs/2026-03-21-story-publishing-design.md)
- Media embedding (images, video in chapters)
- Story gallery / discovery page
- Mapping dictionary with auto-detection and "Show Your Work" panel
- Chapter-level interactions (swipe comparison, time slider, layer toggle)
- Story templates — pre-built starting points (e.g., "Before/After comparison", "Temporal change narrative", "Regional overview") that pre-configure chapter types, layout patterns, and placeholder narrative prompts so users don't start from a blank canvas

---

## 1. What This Is

The StoryMap Builder's core editing and reading experience is shipped, including chapter types that let stories mix scrollytelling (guided scroll-driven maps), prose (text-only sections), and interactive map chapters. This spec covers the **next phases**: making stories publishable and self-hostable (static export, deploy integrations), adding smart raster rendering (mapping dictionaries, auto-detection, "Show Your Work"), and enriching the storytelling with interactions (swipe, time slider, layer toggles) and media.

This is the v2 feature track in the PRD roadmap. The core concept is proven — users can create multi-format stories with their CNG data. These next phases make the stories *publishable, permanent, and visually compelling* without requiring the user to understand raster band math or tile serving.

### What it replaces / competes with

- **Esri ArcGIS StoryMaps**: Dominant tool. Requires ArcGIS Online license ($100+/yr). No CNG format support. Not self-hostable. Not open source.
- **Mapbox Storytelling Template**: Requires Mapbox access token. Developer-focused (edit `config.js`). No visual builder.
- **MapLibre Storymap (Digital Democracy)**: Open source, MapLibre-based. No visual builder — requires editing code.
- **Knight Lab StoryMapJS**: Free but limited to point markers. No raster imagery, no satellite data layers.

### What makes ours different

- Visual (no-code) chapter editor — not a config file
- Native CNG data sources — COGs from any URL, STAC layer selection, PMTiles basemaps
- "Show your work" rendering — every layer explains how it's visualized and why
- Static site export — self-hostable, no vendor dependency, no ongoing cost
- Built by the team that created TiTiler, eoAPI, and the CNG tools powering NASA VEDA

---

## 2. User Journey

Steps 1–6 are already implemented. Steps 7–8 are the focus of this spec.

```
EXISTING (shipped):
1. User uploads data to sandbox → sees it on map (v1 flow)
2. User clicks "Turn this into a story" in credits sidebar
3. Story editor opens with user's dataset pre-loaded
4. User creates chapters: captures map views, writes narrative text,
   configures per-chapter layer styling (colormap, opacity, basemap)
5. User reorders chapters via drag-and-drop
6. Story is saved via API (PostgreSQL persistence)
   Viewable at /story/:id, embeddable at /story/:id/embed

NEW (this spec):
7. User enriches chapters with:
   - Media (images, video embeds)
   - Interactions (swipe comparison, time slider, layer toggles)
   - Smart raster rendering via mapping dictionary auto-detection
   - "Show Your Work" panels explaining each layer's visualization
8. User clicks "Publish" and chooses an output:
   a. Download as ZIP (self-contained static site)
   b. Deploy to Vercel (one-click)
   c. Deploy to GitHub Pages
   d. Copy embed code (already available as iframe)
   Result: User has a permanent URL independent of the sandbox.
```

---

## 3. Architecture

### 3.1 Story Config Format

The story is defined as a single JSON config file that the rendering engine consumes. This is the portable artifact — anyone with this JSON and the renderer can display the story.

```json
{
  "meta": {
    "title": "Deforestation in the Congo Basin, 2015–2024",
    "subtitle": "A decade of change observed from space",
    "author": "Jane Doe, Conservation International",
    "created": "2026-03-20T00:00:00Z",
    "sandbox_version": "1.5"
  },

  "settings": {
    "theme": "light",
    "alignment": "left",
    "basemap": {
      "type": "pmtiles",
      "url": "https://example.r2.dev/basemap.pmtiles",
      "style": "positron"
    },
    "map_options": {
      "projection": "mercator",
      "terrain_3d": false,
      "navigation_controls": true
    }
  },

  "data_sources": [
    {
      "id": "deforestation-2015",
      "type": "cog",
      "url": "https://example.r2.dev/datasets/deforestation_2015.tif",
      "mapping": {
        "bands": ["B1"],
        "rescale": [0, 100],
        "colormap": "RdYlGn",
        "legend": {
          "title": "Tree Cover %",
          "breaks": [
            { "value": 0,   "label": "No cover",   "color": "#d73027" },
            { "value": 30,  "label": "Sparse",      "color": "#fee08b" },
            { "value": 60,  "label": "Moderate",    "color": "#d9ef8b" },
            { "value": 90,  "label": "Dense forest", "color": "#1a9850" }
          ]
        },
        "how_it_works": {
          "detected_product": "Single-band classified raster",
          "band_description": "Band 1 represents tree canopy cover percentage (0–100)",
          "colormap_rationale": "Red-Yellow-Green diverging ramp where red = deforested, green = intact forest",
          "rescale_rationale": "Full value range 0–100 shown; no clipping needed"
        }
      }
    },
    {
      "id": "deforestation-2024",
      "type": "cog",
      "url": "https://example.r2.dev/datasets/deforestation_2024.tif",
      "mapping": {
        "bands": ["B1"],
        "rescale": [0, 100],
        "colormap": "RdYlGn",
        "legend": {
          "title": "Tree Cover %",
          "breaks": [
            { "value": 0,   "label": "No cover",   "color": "#d73027" },
            { "value": 30,  "label": "Sparse",      "color": "#fee08b" },
            { "value": 60,  "label": "Moderate",    "color": "#d9ef8b" },
            { "value": 90,  "label": "Dense forest", "color": "#1a9850" }
          ]
        }
      }
    },
    {
      "id": "protected-areas",
      "type": "pmtiles",
      "url": "https://example.r2.dev/datasets/protected_areas.pmtiles",
      "style": {
        "fill_color": "rgba(0, 128, 0, 0.2)",
        "stroke_color": "#006400",
        "stroke_width": 2
      }
    }
  ],

  "chapters": [
    {
      "id": "intro",
      "title": "The Congo Basin",
      "text": "The Congo Basin contains the world's second-largest tropical rainforest...",
      "media": null,
      "map_view": {
        "center": [23.5, 0.5],
        "zoom": 5,
        "bearing": 0,
        "pitch": 0
      },
      "layers": [
        { "source_id": "deforestation-2015", "opacity": 1.0, "visible": true }
      ],
      "transition": {
        "type": "fly_to",
        "duration_ms": 2000
      }
    },
    {
      "id": "change",
      "title": "A Decade of Loss",
      "text": "Between 2015 and 2024, satellite data reveals significant forest cover decline...",
      "media": null,
      "map_view": {
        "center": [25.2, 1.8],
        "zoom": 9,
        "bearing": 0,
        "pitch": 30
      },
      "layers": [
        { "source_id": "deforestation-2024", "opacity": 1.0, "visible": true },
        { "source_id": "protected-areas", "opacity": 0.8, "visible": true }
      ],
      "transition": {
        "type": "fly_to",
        "duration_ms": 3000
      },
      "interaction": {
        "type": "swipe",
        "left_source_id": "deforestation-2015",
        "right_source_id": "deforestation-2024",
        "label_left": "2015",
        "label_right": "2024"
      }
    },
    {
      "id": "call-to-action",
      "title": "What Can Be Done",
      "text": "Protected areas show significantly lower rates of deforestation...",
      "media": {
        "type": "image",
        "url": "https://example.com/field-photo.jpg",
        "caption": "Field survey in Salonga National Park, 2024",
        "position": "above"
      },
      "map_view": {
        "center": [20.5, -2.0],
        "zoom": 7,
        "bearing": -15,
        "pitch": 45
      },
      "layers": [
        { "source_id": "deforestation-2024", "opacity": 0.6, "visible": true },
        { "source_id": "protected-areas", "opacity": 1.0, "visible": true }
      ],
      "transition": {
        "type": "fly_to",
        "duration_ms": 2500
      }
    }
  ]
}
```

### 3.2 Mapping Dictionary

> **Relationship to existing `LayerConfig`:** The shipped thin slice stores per-chapter styling via a `LayerConfig` object with fields: `colormap`, `opacity`, `basemap`, `band`, `timestep`. The mapping dictionary described here is a **superset** of `LayerConfig` — it adds `rescale`, `legend`, `expression` (for band math), and `how_it_works` (for the Show Your Work panel). Implementation should extend `LayerConfig` rather than replace it, preserving backward compatibility with existing stories. Fields like `colormap` and `band` in `LayerConfig` map directly to their equivalents in the mapping dictionary.

The `mapping` object inside each data source is the rendering configuration — the "mapping dictionary" that translates raw raster values into visual output. It contains:

- **`bands`**: Which bands to render (array of band IDs or indices)
- **`rescale`**: Value range to map to 0–255 for display `[min, max]`
- **`colormap`**: Named colormap string (must be a colormap supported by both TiTiler and the client-side renderer)
- **`legend`**: Human-readable legend with value breaks and colors
- **`how_it_works`** (optional): Plain-language explanation of rendering choices, displayed in the "Show Your Work" panel

For multi-band RGB composites (e.g., true color satellite imagery):

```json
{
  "bands": ["B04", "B03", "B02"],
  "rescale": [[0, 3000], [0, 3000], [0, 3000]],
  "how_it_works": {
    "detected_product": "Sentinel-2 L2A",
    "band_description": "True color composite: B04 (Red, 665nm), B03 (Green, 560nm), B02 (Blue, 490nm)",
    "rescale_rationale": "Surface reflectance values typically range 0–3000 for clear scenes"
  }
}
```

For computed indices (e.g., NDVI):

```json
{
  "expression": "(B08 - B04) / (B08 + B04)",
  "rescale": [-0.2, 0.8],
  "colormap": "RdYlGn",
  "legend": {
    "title": "NDVI — Vegetation Health",
    "breaks": [
      { "value": -0.2, "label": "Water / bare", "color": "#d73027" },
      { "value":  0.0, "label": "Soil / rock",  "color": "#fee08b" },
      { "value":  0.3, "label": "Sparse vegetation", "color": "#d9ef8b" },
      { "value":  0.6, "label": "Dense vegetation",  "color": "#1a9850" }
    ]
  },
  "how_it_works": {
    "detected_product": "Sentinel-2 L2A",
    "formula_explanation": "NDVI = (NIR - Red) / (NIR + Red). Healthy plants reflect more near-infrared light and absorb more red light.",
    "rescale_rationale": "Values below -0.2 are typically water; values above 0.8 are rare. This range captures meaningful vegetation variation."
  }
}
```

**Auto-detection behavior:** When a user adds a COG data source without specifying a mapping, the sandbox should:
1. Read band metadata (count, data type, nodata value, min/max from overviews)
2. If STAC metadata is available, match against known product profiles (Sentinel-2, Landsat, etc.)
3. Generate a default mapping with sensible rescaling and colormap
4. Present the mapping to the user as an editable suggestion, with the "How It Works" panel explaining each choice
5. Store the final mapping in the story config

### 3.3 Rendering Engine

The published storymap is a static HTML application that uses:

- **MapLibre GL JS** for map rendering (both vector/PMTiles layers and, via maplibre-cog-protocol, client-side COG rendering for smaller datasets)
- **TiTiler** for server-side COG tile rendering (for larger/multi-band datasets that exceed client-side rendering limits). In the sandbox, TiTiler is already running. In the published static site, the story config can point to any TiTiler instance — the sandbox's (temporarily, with expiry caveat) or the user's own.
- **Scrollama** for scroll-driven chapter transitions within scrollytelling blocks
- **deck.gl** (optional) for more complex raster rendering, consistent with the existing sandbox stack

The rendering engine reads the story config JSON and produces the scroll experience. Consecutive scrollytelling chapters are grouped into Scrollama blocks with a shared sticky map and fly-to transitions. Prose and map chapters appear as regular page content between scrollytelling blocks. The engine itself is a standalone JavaScript bundle that can be served from any static host.

### 3.4 "Show Your Work" Panel

Every layer in every chapter has an expandable "How this layer works" disclosure panel. When collapsed, it shows a one-line summary (e.g., "NDVI — Vegetation Health from Sentinel-2"). When expanded, it shows:

1. **Data source**: URL, format, detected product name
2. **Visualization**: Which bands, what formula (if computed), rescale range, colormap name
3. **Why these choices**: Plain-language explanation from the `how_it_works` mapping field
4. **Legend**: Visual legend with color breaks and labels
5. **Export this config**: Buttons to copy the mapping dictionary as:
   - JSON (portable config)
   - TiTiler URL (e.g., `/cog/tiles?url=...&rescale=0,3000&colormap_name=rdylgn`)
   - Python snippet (rasterio + matplotlib)

In the **editor**, this panel is always visible and editable — the user can adjust rescaling, change colormaps, and see the explanation update in real time.

In the **published story**, this panel is a reader-facing disclosure — collapsed by default, expandable for readers who want to understand the methodology. This supports open science and reproducibility.

---

## 4. Component Breakdown

### 4.1 Story Editor UI

**Chapter card editor** — a card-based interface where each card represents one chapter.

Card fields (✅ = shipped, 🆕 = this spec):
- ✅ **Chapter type** (dropdown: scrollytelling, prose, map — controls which fields are visible and how the chapter renders in the reader)
- ✅ **Title** (text input, optional)
- ✅ **Narrative text** (markdown textarea)
- 🆕 **Media** (URL input for image or video embed, with position selector: above text, below text, or background)
- ✅ **Map view** (captured from the interactive map — center, zoom, bearing, pitch; hidden for prose chapters)
- ✅ **Layer styling** (colormap, opacity, basemap per chapter via LayerConfig; hidden for prose chapters)
- ✅ **Dataset selector** (choose which dataset this chapter visualizes, with "+ Add" to upload new datasets)
- 🆕 **Layer mapping** (expandable per-layer rendering config — rescale, band selection, legend. Pre-populated from auto-detection, user-editable. Extends existing LayerConfig)
- ✅ **Transition** (fly-to between chapters)
- 🆕 **Transition options** (dropdown: fly_to, jump, fade. Duration slider in ms)
- 🆕 **Interaction** (optional, dropdown: none, swipe comparison, time slider. Additional fields appear based on selection)

✅ Cards are drag-and-drop reorderable.

✅ **Map preview panel** — live MapLibre/deck.gl map that updates as the user edits chapter settings.

🆕 **Story preview mode** — full-width or full-screen preview simulating the scroll experience as a reader would see it. Exit preview returns to the editor. (Currently the reader at `/story/:id` serves this purpose, but an in-editor preview avoids the need to save and navigate.)

**Story settings panel** — global settings:
- ✅ Title (stored in story metadata)
- 🆕 Subtitle, author, description
- ✅ Basemap selection (per-chapter basemap in LayerConfig)
- 🆕 Theme (light/dark/custom)
- 🆕 Default map projection
- 🆕 3D terrain toggle
- 🆕 Footer text / attribution

### 4.2 Data Source Manager

A panel listing all available data sources for the story. Sources can come from:

1. **The user's sandbox uploads** (already converted to CNG formats)
2. **External URLs** (paste a COG URL, a STAC item URL, or a PMTiles URL)
3. **STAC catalog search** (search a STAC API, select items, add them as sources — uses the sandbox's existing STAC search if implemented, or connects to external STAC APIs like Earth Search)

Each data source has:
- A preview thumbnail (auto-generated from the first overview level)
- Its mapping dictionary (auto-detected or user-configured)
- The "How It Works" panel
- A "Remove from story" action

### 4.3 Publishing Pipeline

> **Superseded.** See the standalone [Story Publishing Pipeline spec](superpowers/specs/2026-03-21-story-publishing-design.md) for the full publishing design. Summary: GitHub OAuth login, static reader bundle pushed to a repo under the user's GitHub account, hosted via GitHub Pages, data on Cloudflare R2.

### 4.4 Template Library

Pre-built story templates that auto-configure the chapter structure and interactions:

| Template | Description | Chapters | Key Interaction |
|----------|-------------|----------|-----------------|
| **Guided Tour** | Fly between locations with narrative at each stop | 3–10 location cards | Fly-to transitions |
| **Before / After** | Compare two states of the same area | 2–3 chapters, one with swipe | Swipe comparison |
| **Change Over Time** | Show temporal change with a progression of layers | 4–8 temporal chapters | Layer fade transitions |
| **Data Explorer** | Present multiple datasets with interactive layer toggling | 2–5 thematic chapters | Layer visibility toggles |

Templates provide a starting structure — the user can add, remove, or rearrange chapters freely after selecting one.

---

## 5. Integration with Existing Sandbox

### Already integrated (shipped)

- **Entry point**: "Turn this into a story →" in credits sidebar links to `/story/new` with dataset context. Working.
- **Conversion pipeline**: Files uploaded to the sandbox are converted to CNG formats (COG, PMTiles) before the story editor opens. The story editor consumes these converted outputs.
- **TiTiler**: Tile serving for raster layers during editing and in the hosted reader. Working.
- **MapLibre + deck.gl**: UnifiedMap component provides map rendering. Working.
- **PostgreSQL persistence**: Story CRUD via SQLAlchemy. Working.
- **Scrollama**: Scroll-driven chapter transitions in the reader. Working.
- **Chapter editor UI**: Card-based editor with markdown text, map view capture, drag-and-drop reordering. Working.
- **Per-chapter LayerConfig**: colormap, opacity, basemap, band, timestep. Working (band/timestep selection in progress).

### New integration needed (this spec)

- ~~**Static site bundler**~~ → See [Story Publishing Pipeline spec](superpowers/specs/2026-03-21-story-publishing-design.md)
- ~~**Vercel deploy flow**~~ → Superseded by GitHub Pages approach in publishing spec
- ~~**GitHub Pages deploy**~~ → See [Story Publishing Pipeline spec](superpowers/specs/2026-03-21-story-publishing-design.md)
- **Multi-dataset data source manager** (Phase 2): A panel listing all datasets the user has uploaded. Requires querying `/api/datasets` and letting the user select which ones to include in the story.
- **Band metadata endpoint** (Phase 3): The mapping dictionary auto-detection needs raster band statistics. Check whether `/api/datasets/:id` already returns this, or whether titiler-pgstac's `/info` endpoint can be used directly. May need a new lightweight endpoint.

---

## 6. Data Persistence and Expiry

> **Superseded.** See Section 5 of the [Story Publishing Pipeline spec](superpowers/specs/2026-03-21-story-publishing-design.md) for the data storage and cost model. Summary: Cloudflare R2 replaces MinIO in production, per-user 5GB quota, inactive cleanup after 12 months, zero egress costs.

---

## 7. Interactions (Chapter-Level)

Beyond basic scroll-driven fly-to transitions, the story builder supports these chapter-level interactions:

### Swipe comparison

Two layers rendered side-by-side with a draggable divider. Configured per-chapter:

```json
{
  "interaction": {
    "type": "swipe",
    "left_source_id": "deforestation-2015",
    "right_source_id": "deforestation-2024",
    "label_left": "2015",
    "label_right": "2024",
    "initial_position": 0.5
  }
}
```

Uses MapLibre GL Compare or a custom deck.gl implementation.

### Time slider

Scrub through a temporal stack of layers. Configured per-chapter:

```json
{
  "interaction": {
    "type": "time_slider",
    "source_ids": ["sst-jan", "sst-feb", "sst-mar", "sst-apr"],
    "labels": ["January", "February", "March", "April"],
    "autoplay": true,
    "interval_ms": 1500
  }
}
```

This connects directly to the v1.5 temporal stack feature — if the user has uploaded a temporal stack, the time slider interaction makes it available as a story chapter.

### Layer toggle

Let the reader toggle layers on/off within a chapter:

```json
{
  "interaction": {
    "type": "layer_toggle",
    "toggleable_sources": [
      { "source_id": "protected-areas", "label": "Protected Areas", "default_visible": true },
      { "source_id": "mining-concessions", "label": "Mining Concessions", "default_visible": false }
    ]
  }
}
```

---

## 8. "Show Your Work" — Detailed Spec

### In the editor

When a user adds or configures a data source layer, a panel appears (collapsible, expanded by default on first configuration) showing:

```
┌─────────────────────────────────────────────────┐
│ 🔍 How This Layer Works                   [▼]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Detected product: Sentinel-2 L2A                │
│ Source: earth-search.aws.element84.com          │
│                                                 │
│ Visualization: NDVI — Vegetation Health         │
│                                                 │
│ What's happening:                               │
│ • Band B08 (Near Infrared, 842nm) measures      │
│   light reflected by plant cell structure        │
│ • Band B04 (Red, 665nm) measures light           │
│   absorbed by chlorophyll                        │
│ • Formula: (NIR - Red) / (NIR + Red)            │
│ • Healthy plants → high NDVI (green)            │
│ • Bare soil → low NDVI (red)                    │
│                                                 │
│ Display range: -0.2 to 0.8                      │
│ (Below -0.2 is typically water; above 0.8       │
│  is rare in most environments)                  │
│                                                 │
│ ┌─ Legend ─────────────────────────────────┐    │
│ │ ■ No cover     ■ Sparse   ■ Dense       │    │
│ │ -0.2           0.3         0.8           │    │
│ └──────────────────────────────────────────┘    │
│                                                 │
│ [Copy as JSON] [Copy as TiTiler URL] [Python]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

The user can edit rescale values, change the colormap (dropdown of available colormaps with visual preview), and adjust legend breaks. Changes update the map preview and the explanation text in real time.

### In the published story

Each chapter's map layers have a small info icon (ℹ️) that expands a simplified version of the "How This Layer Works" panel. This is reader-facing — it doesn't include the export buttons, but does include:
- Data source and format
- Visualization method and formula (if applicable)
- Legend
- A note: "This story was built with CNG Sandbox using open-source tools. [Learn more →]"

This last line is the ambient DevSeed credit — not a watermark, but a contextual attribution that appears only when the reader actively seeks methodology information.

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Story creation completion rate | ≥ 40% of users who enter the builder publish a story | Funnel analytics |
| Time to first published story | < 30 minutes (p50) for a 3-chapter story | Session duration tracking |
| Published story engagement | ≥ 50% of published stories are viewed by someone other than the author | Unique viewer tracking (privacy-respecting, e.g., Plausible) |
| "Show Your Work" expansion rate | ≥ 15% of readers expand at least one "How This Layer Works" panel | Click tracking in published stories |
| Story shares | ≥ 30% of published stories generate at least one external share (social, email, embed) | Referrer tracking |
| Inbound to DevSeed | ≥ 1 inquiry/month referencing a sandbox-published storymap | CRM attribution |

---

## 10. Phased Build Plan

> Phase 0 (thin slice) is complete. This plan starts from the shipped state described in Section 0.

### Phase 1: Publishing pipeline (target: 2–3 weeks)

> **See [Story Publishing Pipeline spec](superpowers/specs/2026-03-21-story-publishing-design.md) for full design.**

- GitHub OAuth integration
- Static reader bundle (separate Vite build target)
- Publish flow: create GitHub repo, push reader + story.json, enable GitHub Pages
- Re-publish flow: push updated story.json to existing repo
- "Your Stories" page for logged-in users

### Phase 2: Media + multi-dataset (target: 2–3 weeks after Phase 1)

- **Media embedding**: Image URL and video embed (YouTube/Vimeo iframe) per chapter. Position options: above text, below text, background behind text.
- **Multi-dataset stories**: Add layers from multiple uploaded datasets. The data source manager lists all datasets the user has uploaded to the sandbox. Each can be added as a source and configured per-chapter.
- **Embed code improvements**: The iframe embed route exists (`/story/:id/embed`). Add a "Copy embed code" button in the editor and a responsive sizing option.

### Phase 3: Mapping dictionary + "Show Your Work" (target: 3–4 weeks after Phase 2)

- **Extend `LayerConfig` with mapping dictionary fields**: `rescale`, `legend`, `expression`, `how_it_works`. Backward-compatible — existing stories with only `colormap`/`opacity` continue to work.
- **Auto-detection**: Read COG band metadata and STAC metadata. Match against known product profiles (Sentinel-2, Landsat 8/9, MODIS). Generate default mapping with rescale, colormap, and legend. Present as editable suggestion.
- **"Show Your Work" panel in editor**: Expandable panel per layer showing detected product, band descriptions, formula, rescale rationale, legend. User can edit all fields.
- **"Show Your Work" panel in published stories**: Reader-facing disclosure (collapsed by default) with data source info, visualization method, legend. Includes "Built with CNG Sandbox" attribution.
- **Export mapping config**: Copy as JSON, TiTiler URL, or Python snippet from the editor panel.
- **Community presets**: Pre-built mapping dictionaries for 5–10 common products (Sentinel-2 L2A, Landsat 8/9, MODIS NDVI, NAIP, DEM/hillshade).

### Phase 4: Interactions + templates (target: 3–4 weeks after Phase 3)

- **Swipe comparison**: Two layers with a draggable divider. Configured per-chapter.
- **Time slider**: Scrub through temporal layers (connects to v1.5 temporal stack). Configured per-chapter.
- **Layer toggle**: Reader can toggle layers on/off within a chapter.
- **Template library**: 4 pre-built story structures (Guided Tour, Before/After, Change Over Time, Data Explorer) that auto-configure chapter arrangements and interactions.
- **Story gallery**: Browseable page of published stories on the sandbox.

### Phase 5: Polish + analytics (ongoing)

- **Custom CSS theming** for published stories
- **Analytics integration** (Plausible or equivalent) for published stories — view counts, geographic distribution
- **3D terrain support** in chapters
- **Additional basemap options**
- **Responsive layout improvements** for mobile readers

---

## 11. Open Questions for Implementation

1. **What is the current story config schema in the database?** Before implementing the mapping dictionary extension, audit the existing `LayerConfig` model in SQLAlchemy. The spec proposes adding `rescale`, `legend`, `expression`, and `how_it_works` fields — confirm these can be added as optional JSON fields without a migration that breaks existing stories.

2. **How do we handle TiTiler in published static exports?** During editing, the sandbox's TiTiler serves tiles. In a published static site, options: (a) client-side rendering via maplibre-cog-protocol for all published stories (simplest but has limits with large/multi-band rasters), (b) published stories reference the sandbox TiTiler with an expiry caveat, (c) user provides their own TiTiler URL. Recommend (a) as default — this also aligns with the cost positioning (no tile server = zero compute cost).

3. **Should the static export bundle the scrollama renderer or reference a CDN?** Full bundle is more portable (works offline). CDN version is smaller. Recommend full bundle for ZIP download, CDN for Vercel/GitHub Pages deploy.

4. **How does multi-dataset work with the current story API?** The thin slice creates a story from a single dataset. Multi-dataset stories need a way to reference multiple `dataset_id` values. Check whether the current schema stores dataset references per-chapter or per-story, and whether the story config format needs a `data_sources` array as proposed in Section 3.1.

5. **What does the "Show Your Work" auto-detection need from the backend?** The mapping dictionary auto-detection requires band metadata (count, dtype, min/max, nodata) and optionally STAC metadata (eo extension band descriptions). Check whether the existing `/api/datasets/:id` endpoint returns enough metadata, or whether a new endpoint is needed (e.g., `/api/datasets/:id/band-stats`).

6. **Should published stories have their own URL namespace?** Currently stories live at `/story/:id`. Published (exported) stories are static sites on Vercel/GitHub Pages with their own URLs. Is there a need for a `/published/:id` route on the sandbox that redirects to the user's external URL, for discoverability?
