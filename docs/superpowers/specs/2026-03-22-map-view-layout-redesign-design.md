# Map View Layout Redesign

**Date**: 2026-03-22
**Status**: Draft

## Problem

The map view page (shown after uploading a dataset) has several layout issues:

1. The right panel's most valuable content — file size reduction and live data-fetched stats — is hidden behind a "See what's changed" button in the header, rather than being immediately visible.
2. The Story Publishing CTA is buried as a small text link in the credits panel.
3. Header buttons (Datasets, New Upload, See What's Changed, Bug Report) are styled inconsistently and the header is crowded.
4. "New Upload" navigates away to the homepage, breaking context.
5. The right panel uses tabs (Credits, Explore, Client Rendering) that don't map to how users think about the page.
6. The "See what's changed" panel mixes value-proof stats with technology links, diluting both.

## Design

### Header

Simplified to four items:

- **CNG branding** (left)
- **Share button** (right) — retained until story publishing provides its own sharing
- **Datasets** link (right)
- **Bug Report** link (right) — retains the beta signal

All other items move to the right panel or deep dive panel. The links should be styled consistently.

### Right Panel — Pinned Top

The top section of the right panel is always visible (fixed, not scrollable). It replaces the current tab-based CreditsPanel. Contents in order:

#### 1. Conversion Summary Card

A single card that bundles:

- **File size stat**: original → converted size with percentage reduction (e.g., "2.1 MB → 840 KB, 60% smaller")
- **Data fetched stat**: live counter showing bytes fetched vs total file size (e.g., "128 KB of 840 KB")
- **Mini pipeline graphic**: compact version of the transformation bar (e.g., ".tif GeoTIFF → .tif COG")
- **"Details →" link**: opens the deep dive bottom panel

This card replaces the file size and data-fetched stat cards that currently live inside the ReportCard bottom panel.

#### 2. Story CTA Banner

A visually prominent card with:

- "What's next" label
- "Tell a story with this data" heading
- One-line description: "Add annotations, narrative text, and guided map views to create a shareable data story."
- "Create story →" button (filled, brand-colored). Clicking it creates a new story pre-loaded with the current dataset, with a prose chapter 1 and a map chapter 2, then navigates to the story editor.

This replaces the small "Turn this into a story →" text link currently in the Credits tab.

#### 3. New Upload Button

A button that triggers an inline upload flow within the right panel. Clicking it replaces the right panel content with the upload experience. The panel manages two modes via a state flag (e.g., `panelMode: "dataset" | "upload"`):

- **"dataset" mode** (default): shows the normal pinned top + contextual bottom
- **"upload" mode**: shows the upload flow

The upload flow reuses the existing upload components (FileUploader, ProgressTracker, VariablePicker) from UploadPage.tsx, rendered inside the right panel instead of the full page. These components are already standalone — they accept props and callbacks and don't depend on UploadPage layout or routing. The `useConversionJob` hook manages all upload API interactions and can be called from any component. The only adaptation needed is constraining the components to fit the narrower panel width (the current FileUploader drop zone and ProgressTracker are designed for a full-page layout).

A clear cancel/back button at the top of the upload view returns to "dataset" mode. On upload completion, the page navigates to the new dataset's map view (same as the current behavior after upload on the homepage).

This replaces the current "New Upload" button in the header that navigated to the homepage.

#### 4. Expiration Notice

Subtle line at the bottom of the pinned section (e.g., "⏳ Expires in 6 days"). Carried over from the current CreditsPanel.

### Right Panel — Contextual Bottom

Below the pinned top, a scrollable area that adapts based on dataset type. No tabs, no accordions — the system shows the right controls automatically.

#### Raster Datasets

- Band selector (if multi-band)
- Colormap dropdown (if single-band or selected single band)
- Opacity slider
- Client-side rendering toggle (for eligible single-band rasters) — an inline switch rather than a separate tab. Toggling this switch replaces the `activeTab`-based state machine: a new state variable (e.g., `renderMode: "server" | "client"`) controls which map layer is rendered. When "client" is selected, the map switches to the COG/deck.gl layer; when "server" is selected, it uses the titiler tile layer. This decouples the rendering mode from the panel UI.

These controls currently live as a floating overlay (RasterControls) on the map. They move to the right panel.

**Map layer coordination**: The current implementation uses `activeTab` state to drive both the right panel UI and the map rendering mode (e.g., `activeTab === "client"` triggers COG rendering, `activeTab === "explore"` switches to GeoJSON). With tabs removed, these are decoupled into separate concerns:
- **Rendering mode** (`renderMode`): controls which map layer is active. For raster: "server" (titiler tiles) or "client" (COG/deck.gl). For vector: "vector-tiles" (tipg MVT) or "geojson" (filtered GeoJSON from Explore).
- **Panel content**: determined by dataset type, not by rendering mode. The contextual bottom always shows the relevant controls for the dataset type.
- Vector datasets switch to GeoJSON rendering when the user applies filters or a SQL query in the Explore UI, and revert to vector tiles when filters are cleared. The mechanism: ExploreTab already calls `onTableChange(table)` when query results change. MapPage derives the vector rendering mode from whether `arrowTable` is non-null — if a table is present, render GeoJSON from it; if null, render vector tiles. MapPage owns `renderMode` state; ExploreTab does not set it directly.

#### Vector Datasets

- Feature count display
- Filter UI (dynamic filters from column stats)
- SQL editor
- Column stats

This is the current Explore tab content, now shown directly without a tab.

### Deep Dive Bottom Panel

A full-width bottom panel triggered by the "Details →" link in the Conversion Summary card. Same position and behavior as the current ReportCard (slides up from bottom, max 70vh height).

#### Header

- Title: "Your data, transformed"
- Filename
- Close button (✕)

#### Transformation Bar

The existing pipeline graphic showing the conversion flow with format labels, tool names, and arrows. Retained as-is from the current ReportCard.

#### Horizontal Cards Row

Four cards in a horizontal row, reading left-to-right following the pipeline order:

1. **Converted** — tool name (e.g., rio-cogeo), 1-2 sentence description of what it did and why, repo link
2. **Stored** — tool name (e.g., MinIO), description, repo link
3. **Cataloged** — tool name (e.g., pgSTAC + STAC API), description, repo link
4. **Displayed** — tool names (e.g., titiler + deck.gl), description, repo links

The descriptions should explain what the tool does and why it was chosen, in plain language. Not a full docs page — just enough for a curious user to understand the pipeline.

The specific tools shown are dynamic based on the dataset's actual conversion pipeline (raster vs vector datasets use different tools).

### Removed Elements

| Element | Disposition |
|---------|------------|
| Right panel tabs (Credits, Explore, Client Rendering) | Replaced by pinned top + contextual bottom |
| "How this was made" links in CreditsPanel | Replaced by deep dive panel's richer descriptions |
| Validation badge in CreditsPanel | Removed (developer-facing, not user-facing) |
| File size stat card in ReportCard | Moved to Conversion Summary card in right panel |
| Data fetched stat card in ReportCard | Moved to Conversion Summary card in right panel |
| Share stat card in ReportCard | Dropped (self-evident from using the product) |
| Capabilities stat card in ReportCard | Dropped (self-evident from using the product) |
| "See what's changed" button in header | Replaced by "Details →" in Conversion Summary card |
| "New Upload" button in header | Replaced by inline upload in right panel |
| ShareButton in header | Kept in header (story publishing is not yet built, so this remains the sharing mechanism) |
| "Talk to Development Seed" link in CreditsPanel | Removed (not relevant to the core user flow) |
| RasterControls map overlay | Moved to right panel contextual bottom |

## Component Changes

### Files Modified

- **MapPage.tsx** — restructure layout: simplified header, new right panel composition
- **CreditsPanel.tsx** — major rewrite or replace: remove tabs, implement pinned top + contextual bottom
- **ReportCard.tsx** — simplify: remove stat cards, replace with horizontal tech cards layout
- **Header.tsx** — may need updates if header is shared across pages
- **RasterControls.tsx** — relocate from map overlay to right panel

### New Components

- **ConversionSummaryCard** — bundles file size, data fetched, mini pipeline, and details link
- **StoryCTABanner** — the prominent story publishing call-to-action
- **InlineUpload** — upload flow embedded in the right panel with cancel affordance
- **TechCard** — reusable card for the deep dive horizontal row (role label, tool name, description, link)

### Files Potentially Unchanged

- **UnifiedMap.tsx** — map rendering itself doesn't change (but will read `renderMode` instead of `activeTab`)
- **ExploreTab.tsx** — content stays the same, just rendered without a tab wrapper
- **BugReportLink.tsx** — stays in header
- **ShareButton.tsx** — stays in header (retained until story publishing provides its own sharing)

## Data Flow

The Conversion Summary card needs two pieces of data that currently live in different places:

- **File size stats**: available from the dataset object (original_size, converted_size)
- **Data fetched**: currently tracked by a live counter in the ReportCard. This state needs to be lifted up or shared so the Conversion Summary card in the right panel can display it.
- **Pipeline tools**: available from the dataset's credits array, which already describes which tools were used

The deep dive panel's tech card descriptions will be derived from the credits array, supplemented with static description text mapped to each known tool.
