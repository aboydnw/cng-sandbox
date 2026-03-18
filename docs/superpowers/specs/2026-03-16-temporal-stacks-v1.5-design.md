# CNG Sandbox v1.5 — Temporal Stacks Design

**Status:** Approved
**Date:** 2026-03-16
**Scope:** US-01 through US-10 from the v1.5 user stories

---

## Resolved Open Questions

| Question | Decision |
|----------|----------|
| Colormap consistency | Fixed global min/max across all frames within a dataset. No per-frame toggle. |
| Max files per temporal upload | 50-file cap, revisable later based on real usage. |
| Sub-daily navigation | Adaptive: single linear slider for daily-or-coarser data, date picker + hour slider when sub-daily timesteps are detected. |
| Multi-variable NetCDF | Out of scope for v1.5. VirtualiZarr planned for later. |
| Upload order confirmation | Deferred. Files upload in auto-detected order; alphabetical fallback if no temporal signal. Known deviation from US-01 AC2 (file list before submission) and US-02 AC3/AC4 (drag-to-reorder, order confirmation). Add these later if ordering issues arise. |

---

## What Changes, What Stays

**Unchanged:**
- Single-file upload (`POST /api/upload`) — untouched
- Vector pipeline (PMTiles, tipg) — temporal is raster-only in v1.5
- MapPage layout (70/30 map/sidebar split)
- All v1 credits, validation, expiry logic

**New:**
- `POST /api/upload-temporal` — new endpoint, up to 50 raster files
- Pipeline extended: convert N files → register one STAC collection with N datetime-stamped items
- `Dataset` model gains temporal fields (`is_temporal`, `timesteps`, `raster_min`, `raster_max`)
- `RasterMap` gains temporal controls: time slider, play/pause, pre-load gating, GIF/MP4 export
- Tile URL gains `datetime` and `rescale` query params
- FileUploader gains multi-file drop support

---

## Backend

### New endpoint: `POST /api/upload-temporal`

- Accepts up to 50 files via multipart form
- Returns `{job_id, dataset_id}` — same shape as existing upload response
- Enforces per-file 1 GB limit; rejects unsupported or non-raster formats immediately
- Same rate limiting as existing upload (5/hour per IP)

### Temporal ordering (US-02)

Extraction priority:
1. Raster metadata (`TIFFTAG_DATETIME` for GeoTIFF, `time` coordinate for NetCDF)
2. Filename patterns via regex: `2015`, `2020-07`, `20231101`, `2021_01_15`
3. Alphabetical fallback if no temporal signal detected

Server is the source of truth for ordering. No client-side confirmation step for v1.5.

### Pipeline: `run_temporal_pipeline`

The existing `run_pipeline` handles single files and is unchanged. A new `run_temporal_pipeline` orchestrates N files:

```
For each file in temporal order:
  → Convert to COG (same converter as v1)
  → Validate (all 8 raster checks must pass per file)
  → Upload COG to MinIO at datasets/{id}/timesteps/{n}/
  → SSE progress: "Converting 3 of 10..."

After all N files:
  → Compute global min/max across all N COGs (rasterio statistics)
  → Register one STAC collection with temporal extent
  → Register N STAC items, each with its datetime property
  → Build Dataset with timesteps[], raster_min, raster_max
```

If any single file fails validation, the whole batch fails. Error message identifies which file failed and why. On failure, cleanup removes any COGs already uploaded to MinIO and any STAC items already registered for this dataset.

### Cross-file validation

After all N files are individually validated, a cross-file validation step checks:
- All files share the same CRS
- All files share the same pixel dimensions (width × height)
- All files share the same band count
- Bounding boxes are within tolerance (same spatial extent)

If cross-file validation fails, the batch fails with an error naming the incompatible file.

### SSE progress for temporal uploads

The existing `Job` model gains two optional fields for temporal progress:

```python
progress_current: int | None = None  # current file index (1-based)
progress_total: int | None = None    # total files in batch
```

SSE events use the same `event: status` format. The payload includes the extra fields when present:

```json
{"status": "converting", "progress_current": 3, "progress_total": 10}
```

The frontend displays this as "Converting 3 of 10…" in the progress tracker.

### Dataset model additions

```python
is_temporal: bool = False
timesteps: list[Timestep] = []   # Timestep = {datetime: str, index: int}
raster_min: float | None = None  # global min across all frames
raster_max: float | None = None  # global max across all frames
```

`Timestep` is a new Pydantic model:

```python
class Timestep(BaseModel):
    datetime: str    # ISO 8601 UTC
    index: int       # 0-based position in temporal order
```

For temporal datasets, `Dataset.filename` is set to the common prefix of uploaded filenames (e.g., `sst_2014.tif` through `sst_2023.tif` → `sst`). Falls back to the first filename if no common prefix.

### STAC registration

One collection per temporal dataset (same pattern as v1, but with full temporal extent). N items, one per timestep, each with:
- `datetime` property set to the timestep's timestamp
- Asset `href` pointing to that timestep's COG in MinIO
- Item ID: `{dataset_id}-{index}` (e.g., `abc123-0`, `abc123-1`)

### Tile URL (temporal)

```
/raster/collections/{collection_id}/tiles/WebMercatorQuad/{z}/{x}/{y}
  ?assets=data
  &datetime=2018-01-01T00:00:00Z   ← timestep lookup
  &rescale={raster_min},{raster_max} ← locked colormap range
  &colormap_name=viridis
```

The `datetime` parameter is what makes titiler-pgstac return the correct timestep's tiles. The `rescale` parameter locks the colormap to the global range for consistent coloring.

---

## Frontend

### FileUploader changes

When multiple raster files are dropped or selected:
- Supports both multi-file selection and folder drops (via `webkitGetAsEntry()` for directory traversal)
- Detect that N > 1 files were provided
- Validate all are supported raster formats (.tif, .tiff, .nc)
- Show file count and "Upload N files" button before submission (no individual file list or reorder — deferred)
- Submit to `POST /api/upload-temporal` instead of `/api/upload`
- Single-file drops continue through the existing v1 path

### Dataset type additions

```typescript
interface Timestep {
  datetime: string;  // ISO 8601
  index: number;
}

// Added to Dataset interface:
is_temporal: boolean;
timesteps: Timestep[];
raster_min: number | null;
raster_max: number | null;
```

### TemporalControls component

A compact (~420px) bar, centered at the bottom of the map. Contains:
- **Play/pause button** — circular, brand orange when active
- **Time slider** — range input spanning all timesteps, with tick labels at start/middle/end
- **Speed selector** — 0.5×, 1×, 2× buttons
- **Export buttons** — GIF and MP4

A floating timestamp pill above the bar shows the current timestep label (e.g., "2018" or "Jul 2021").

**Pre-load state:** Before all tiles are cached, the controls are grayed out. A progress bar above the controls shows "Loading 4 of 10 timesteps…". Controls enable once all timesteps are pre-loaded.

### Adaptive navigation (sub-daily detection)

When the system detects sub-daily timesteps (adjacent timestamps < 24 hours apart), the controls switch to a two-part layout:
- Date dropdown (selects the day)
- Hour slider (scrubs within that day)

For daily-or-coarser data, the single linear slider is used.

### Pre-load and caching (US-03)

After the map page loads with a temporal dataset:
1. Frontend iterates through all timesteps and pre-fetches tile images for the current viewport
2. Progress shown in the controls bar
3. On completion, slider and play button enable
4. Scrubbing the slider swaps cached tiles without network requests
5. Rapid scrubbing uses `AbortController` to cancel in-flight requests, preventing stale frame flicker
6. If the user pans or zooms, the cache is invalidated and pre-loading restarts for the new viewport

### Animation playback (US-04)

- Default: one frame every ~800ms
- Speed control: 0.5× (1600ms), 1× (800ms), 2× (400ms)
- Loops at the end
- Pause stops on current frame; play resumes from there
- Play is disabled until pre-load completes

### Temporal gap handling (US-06)

**What is a gap:** After temporal ordering, the system detects the most common interval between adjacent timesteps (the "cadence" — e.g., annual, monthly). Any expected timestep missing from the uploaded set at that cadence is a gap. Example: files for 2015, 2017, 2019 with annual cadence → 2016 and 2018 are gaps. If no regular cadence is detected (irregular spacing), there are no gaps — only the uploaded timesteps exist.

- Gap timesteps shown as muted tick marks on the slider
- When slider lands on a gap, map holds the last valid frame, label shows "(no data)"
- Animation skips gaps rather than showing blank frames
- Gaps excluded from GIF/MP4 export

### Timezone display (US-05)

- Timestamps stored and queried as UTC
- Time slider label converts UTC to user's browser timezone for sub-daily data
- Shows secondary UTC label (e.g., "3:00 PM EDT (19:00 UTC)")
- For daily or coarser data, date is shown as-is with no timezone conversion

### GIF export (US-07)

- Client-side canvas capture of the map viewport
- Each cached timestep → one GIF frame
- Frame duration matches current speed setting
- Target: ≤ 25 MB for ≤ 20 timesteps at standard zoom (best-effort — depends on viewport size and data complexity)
- Gaps excluded from export
- Auto-downloads when ready

### MP4 export (US-08)

- Client-side: canvas frames encoded to H.264 via `mp4-muxer` (MediaRecorder's codec support is browser-dependent — Firefox defaults to VP8/VP9)
- Resolution matches current viewport at 1× pixel density
- Target: completes within 60 seconds for ≤ 20 timesteps (best-effort)
- Gaps excluded

### URL state (US-09)

- Active timestep encoded as `?t=0` (0-based index). The user stories suggest `?t=2018` as an alternative, but index-only is simpler and avoids ambiguity with duplicate timestamps. Deviation noted.
- Slider changes update URL via `history.replaceState` (no new history entries)
- On load, `t` parameter initializes the slider position
- Absent `t` defaults to timestep 0 (earliest)
- `popstate` handler restores timestep correctly

### Credits sidebar (US-10)

Below the existing tool credits:
- "12 timesteps · Jan 2014 – Dec 2023"
- If gaps: "10 of 12 timesteps available"
- Tool credits unchanged (rio-cogeo, TiTiler, pgSTAC, MapLibre)
- Expiry countdown unchanged

---

## Out of Scope for v1.5

| Item | Reason |
|------|--------|
| Vector temporal stacks | Raster-only; animated PMTiles is a separate problem |
| Multi-variable NetCDF | VirtualiZarr planned for later |
| Upload order confirmation UI | Deferred until ordering issues arise in practice |
| More than 50 timesteps | UX and export performance untested at that scale |
| Timestep interpolation | Frame-by-frame only |
| Server-side animation rendering | Client-side export sufficient at demo scale |
| Sub-hourly timesteps | Edge case not needed for target users |
| Low-bandwidth mode | Out of scope; pre-load is the only strategy |
