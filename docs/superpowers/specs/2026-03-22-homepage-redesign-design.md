# Homepage Redesign — Design Spec

**Version:** 1.0
**Status:** Draft
**Date:** 2026-03-22
**Parent PRD:** CNG_SANDBOX_PRD_v2.1.md

---

## 0. Context

The current homepage (`UploadPage.tsx`) is a single-purpose page: a header and a file upload drop zone. The StoryMap Builder — now a core feature — is only discoverable after uploading data and viewing it on a map (via the CreditsPanel "Turn this into a story" link).

This redesign promotes story building to a first-class entry point alongside file upload, and improves the upload error experience.

---

## 1. What This Changes

- The homepage presents two equal entry points: **Convert a file** and **Build a story**
- File upload, progress tracking, and error handling all happen inline on the homepage — no page navigation until success
- Upload errors show which pipeline stage failed, with retry and bug report actions
- The story path navigates directly to the story editor (`/story/new`)

## 2. What This Doesn't Change

- `FileUploader`, `VariablePicker` components — used as-is
- Story editor, story reader, embed routes
- Map page, datasets page
- Header component
- Backend / ingestion API

---

## 3. Page Structure

### Initial State

```
┌─────────────────────────────────────────────────┐
│  [logo] CNG Sandbox                  Datasets   │  ← Header (unchanged)
├─────────────────────────────────────────────────┤
│                                                 │
│       Test-drive the open source                │  ← HomepageHero
│          geospatial stack                       │
│        Choose your starting point               │
│                                                 │
│   ┌─────────────────┐  ┌─────────────────┐     │
│   │      📁         │  │      📖         │     │
│   │  Convert a file  │  │  Build a story  │     │  ← Two PathCards
│   │                 │  │                 │     │
│   │  Upload a geo-  │  │  Create a scroll│     │
│   │  spatial file   │  │  ytelling narra-│     │
│   │  and we'll con- │  │  tive with your │     │
│   │  vert it to a   │  │  data or from   │     │
│   │  shareable web  │  │  our public     │     │
│   │  map            │  │  library        │     │
│   │                 │  │                 │     │
│   │ [Browse files]  │  │ [Start building]│     │
│   └─────────────────┘  └─────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Expanded State (after clicking "Convert a file")

```
┌─────────────────────────────────────────────────┐
│  [logo] CNG Sandbox                  Datasets   │
├─────────────────────────────────────────────────┤
│                                                 │
│       Test-drive the open source                │
│          geospatial stack                       │
│                                                 │
│   ┌───────────────────────────┐  ┌────────┐    │
│   │  ← Convert a file         │  │  📖    │    │
│   │                           │  │ Build  │    │  ← Right card fades/shrinks
│   │  ┌─────────────────────┐  │  │ a      │    │
│   │  │   Drop a file here  │  │  │ story  │    │
│   │  │   or browse files   │  │  │        │    │  ← FileUploader inside
│   │  │                     │  │  └────────┘    │     expanded left card
│   │  │  GeoTIFF, Shapefile │  │                │
│   │  │  GeoJSON, NetCDF,   │  │                │
│   │  │  HDF5               │  │                │
│   │  └─────────────────────┘  │                │
│   │                           │                │
│   │  Or paste a URL:          │                │
│   │  ┌──────────────┐ [Go]   │                │
│   │  └──────────────┘        │                │
│   └───────────────────────────┘                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Upload Progress State

```
┌───────────────────────────────┐  ┌────────┐
│  Convert a file                │  │  ...   │
│                                │  └────────┘
│  filename.tif (24.5 MB)       │
│                                │
│  ✓ Scanning                   │
│  ✓ Converting                 │
│  ● Validating...              │
│  ○ Ingesting                  │
│  ○ Ready                      │
└────────────────────────────────┘
```

### Error State

```
┌───────────────────────────────┐  ┌────────┐
│  Convert a file                │  │  ...   │
│                                │  └────────┘
│  filename.tif (24.5 MB)       │
│                                │
│  ✓ Scanning                   │
│  ✗ Converting                 │
│    Conversion failed:          │
│    unsupported CRS detected    │
│                                │
│  [Try again]  [Report issue]  │
└────────────────────────────────┘
```

---

## 4. Components

### New: `HomepageHero`

Simple presentational component. Renders the headline and subtitle centered above the cards.

- **Headline:** "Test-drive the open source geospatial stack"
- **Subtitle:** "Choose your starting point"

### New: `PathCard`

Reusable card component with two states: collapsed and expanded.

**Props:**
- `icon`: string (emoji or icon)
- `title`: string
- `description`: string
- `ctaLabel`: string
- `onClick`: callback
- `expanded`: boolean
- `onCollapse`: callback (renders back arrow when expanded)
- `children`: ReactNode (content to show when expanded)
- `faded`: boolean (when the other card is expanded)

**Collapsed state:** Icon, title, description, CTA button. Clickable.

**Expanded state:** Takes ~70% width. Shows back arrow + title in a header row, then renders `children` (the FileUploader, ProgressTracker, etc.). Smooth CSS transition on width, opacity, and padding.

**Faded state:** When the other card is expanded, this card shrinks to ~30% width, reduces opacity, and hides its description and CTA. Still shows icon and title as a reminder it exists.

### Modified: `ProgressTracker`

Add an enhanced error rendering mode:

- When a stage has `status === "error"`, render it with a red icon and display the error message below the stage name
- Below the stages list, render two action buttons: "Try again" and "Report this issue"
- The existing `StageInfo.detail` field already carries error messages for failed stages — use it as-is for the error text. No new `error` prop needed.
- **New props:**
  - `onRetry: () => void` — resets to the drop zone state
  - `onReport: () => void` — opens the bug report modal (omit if bug report feature not yet available)

### Unchanged: `FileUploader`, `VariablePicker`

Used as-is. Rendered as children inside the expanded `PathCard`. The `FileUploader`'s multi-file upload path (`onFilesSelected` / `startTemporalUpload`) must be preserved in the rewrite — it is wired through to the expanded card just like single-file upload.

---

## 5. State Machine (UploadPage)

The page manages two pieces of state: which card is active, and the upload lifecycle.

```
                    ┌──────────┐
                    │  initial │  ← Two cards, collapsed
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │                     │
         click left            click right
              │                     │
              ▼                     ▼
     ┌────────────────┐     navigate to
     │   upload-idle   │     /story/new
     │  (card expanded,│
     │   drop zone)    │
     └───────┬─────────┘
             │
        file selected
        or URL submitted
             │
             ▼
     ┌────────────────┐
     │   uploading     │  ← ProgressTracker visible
     └───────┬─────────┘
             │
      ┌──────┼──────┐
      │      │      │
   success  error  scan-result
      │      │      │
      ▼      ▼      ▼
   navigate ┌────┐ ┌──────────┐
   /map/:id │error│ │var-picker│
            └──┬─┘ └────┬─────┘
               │        │
          retry │   select var
               │        │
               ▼        ▼
          upload-idle  uploading
```

The "back" affordance (collapse back to two-card view) is available only in `upload-idle` state. Once uploading starts, the back arrow is hidden — the user is committed. There is no way to cancel an in-progress upload.

---

## 6. Animation Details

All animations use CSS transitions for performance. No animation libraries needed.

| Transition | Property | Duration | Easing |
|-----------|----------|----------|--------|
| Card expand | `flex`, `padding`, `opacity` | 300ms | ease-out |
| Card fade (other card) | `flex`, `opacity` | 300ms | ease-out |
| Drop zone → progress | `opacity` (crossfade) | 200ms | ease-in-out |
| Progress → error | stage icon color + error text `opacity` | 200ms | ease-in |
| Card collapse (back) | `flex`, `padding`, `opacity` | 250ms | ease-in |
| Story card click | `transform: scale`, `opacity` | 150ms | ease-in, then navigate |

**Implementation:** The `PathCard` component uses inline `style` with `transition` properties, driven by the `expanded` and `faded` boolean props. The parent container is a `Flex` with `gap`, and each card's `flex` value changes between `1` (collapsed) and `2.3` (expanded) / `0.7` (faded).

---

## 7. Bug Report Integration in Error State

**Prerequisite:** The bug report feature (see `docs/superpowers/plans/2026-03-22-bug-report-button.md`) must be implemented first. If it is not yet available when this redesign is built, the "Report this issue" button should be omitted from the error state and added later once the bug report feature ships.

When the upload pipeline fails:

1. `ProgressTracker` renders the error inline at the failed stage
2. "Report this issue" button opens `BugReportModal` (from the bug report feature)
3. The modal is pre-filled with:
   - `page_url`: current path (`/`)
   - `description`: pre-populated with the error message and failed stage name
   - `console_logs`: from the ring buffer (captured by `consoleCapture.ts`)
   - No `dataset_id` or `story_id` (the upload hasn't completed, so these don't exist yet)

**Note:** The `BugReportModal` currently requires `dataset_id` or `story_id` (backend validation). For the homepage error case, the backend validator needs a small extension: accept a `job_id` field as an alternative context identifier. This is a one-line change to the `require_context` model validator in `bug_report.py`.

---

## 8. Routing

No new routes. The homepage remains at `/`. The story card navigates to the existing `/story/new` route.

---

## 9. File Changes Summary

| Action | Path | Scope |
|--------|------|-------|
| Major rewrite | `frontend/src/pages/UploadPage.tsx` | New layout, state machine, inline progress |
| Create | `frontend/src/components/HomepageHero.tsx` | Headline + subtitle |
| Create | `frontend/src/components/PathCard.tsx` | Expandable card with animation |
| Modify | `frontend/src/components/ProgressTracker.tsx` | Error stage rendering, retry/report buttons |
| Modify | `ingestion/src/routes/bug_report.py` | Accept `job_id` as alternative context |
| Modify | `ingestion/tests/test_bug_report.py` | Test for `job_id` context |

---

## 10. Out of Scope

- **Standard data libraries / public STAC browsing** — noted in PRD Section 9 as a near-term future addition. The "Build a story" card copy mentions "our public library" as forward-looking language; the link goes to the blank editor for now.
- **Story templates** — noted in StoryMap Builder spec as future. The editor opens blank.
- **Changes to the story editor, reader, or map page**
- **Mobile responsiveness** — cards stack vertically on narrow screens (natural flex behavior), but no mobile-specific design work in this pass.
