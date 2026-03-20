# Storytelling Thin Slice — Design Spec

**Status:** Approved
**Date:** 2026-03-20
**Parent:** [CNG Sandbox Storytelling Spec v0.2](~/Documents/obsidian-notes/Project Docs/CNG Sandbox/cng-sandbox-storytelling-spec.md)
**Prerequisite:** Unified Map Renderer (complete — [plan](../plans/2026-03-20-unified-map-renderer.md))

---

## Summary

Add an in-app scrollytelling story builder to CNG Sandbox. Users create stories from their uploaded datasets: navigate the map, capture views, write narrative text, and preview the result as a scroll-driven map experience. v1 is local-only (localStorage), single-dataset, no sharing or embed.

---

## Architecture

**Approach:** Standalone story pages. New `/story/*` routes with their own page components. Each composes `UnifiedMap` + layer builders independently — same building blocks as MapPage, different orchestration. Story code doesn't touch MapPage. Easy to delete if the experiment fails.

```
Browser → /story/new?dataset={id}  → StoryEditorPage
        → /story/:id               → StoryReaderPage
        → /story/:id/edit          → StoryEditorPage
```

No backend changes. Stories live in localStorage. The dataset API is read-only from the story feature's perspective.

---

## Data Model

```typescript
interface Story {
  id: string;                    // crypto.randomUUID()
  title: string;
  description?: string;
  dataset_id: string;            // single dataset per story (v1)
  chapters: Chapter[];
  created_at: string;            // ISO 8601
  published: boolean;
}

interface Chapter {
  id: string;                    // crypto.randomUUID()
  order: number;
  title: string;                 // displayed as heading in reader
  narrative: string;             // markdown body
  map_state: MapState;
  transition: "fly-to" | "instant";
}

interface MapState {
  center: [number, number];      // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
  basemap: string;               // "streets" | "satellite" | "dark"
}
```

### Simplifications from parent spec

- `dataset_ids[]` → `dataset_id` (one dataset per story)
- `expires_at` removed (stories are local, datasets handle their own expiry)
- `LayerConfig` removed (colormap/opacity/band come from the dataset, not per-chapter in v1)
- `"fade"` transition removed (fly-to and instant are sufficient)

### Storage

localStorage keyed by `story:{id}`. A `story:index` key holds an array of `{ id, title, dataset_id, created_at }` for listing.

```typescript
// CRUD operations in src/lib/story/storage.ts
function listStories(): StoryIndexEntry[]
function getStory(id: string): Story | null
function saveStory(story: Story): void
function deleteStory(id: string): void
```

---

## Routes & Page Components

| Route | Component | Purpose |
|-------|-----------|---------|
| `/story/new?dataset={id}` | `StoryEditorPage` | Create a new story |
| `/story/:id` | `StoryReaderPage` | Read a published story |
| `/story/:id/edit` | `StoryEditorPage` | Edit an existing story |

### Component tree

```
StoryReaderPage
├── scrollama (scroll detection)
├── UnifiedMap (sticky, right 60%)
│   └── layer from dataset (reuses layer builders)
└── ChapterCards (scrolling, left 40%)
    └── ReactMarkdown per chapter

StoryEditorPage
├── ChapterList (left sidebar, 22%)
├── UnifiedMap (top-right, interactive)
│   └── "Capture this view" button
└── NarrativeEditor (bottom-right)
    ├── markdown textarea
    ├── "Draft with AI" button (prompt template only)
    └── Preview / Publish buttons
```

### New files

| File | Purpose |
|------|---------|
| `src/lib/story/types.ts` | Story, Chapter, MapState types |
| `src/lib/story/storage.ts` | localStorage CRUD |
| `src/pages/StoryReaderPage.tsx` | Scrollama + UnifiedMap reader |
| `src/pages/StoryEditorPage.tsx` | Three-panel editor |
| `src/components/ChapterList.tsx` | Sidebar chapter list with drag reorder |
| `src/components/NarrativeEditor.tsx` | Markdown textarea + AI draft button |

### Entry point

The "Turn this into a story →" link in `CreditsPanel.tsx` changes from an external URL to `navigate(`/story/new?dataset=${dataset.id}`)`.

---

## Reader Behavior

### Layout

Full viewport height. Left 40% scrolls. Right 60% is `position: sticky` with `UnifiedMap`. Header bar at top with story title and "Made with CNG Sandbox" branding.

```
┌──────────────────────┬───────────────────────────────┐
│  NARRATIVE (40%)     │         MAP (60%)             │
│  (scrolls)           │    (sticky, transitions       │
│                      │     between chapters)         │
│  ┌────────────────┐  │                               │
│  │ ## The problem │  │                               │
│  │ Since 2015...  │  │                               │
│  └────────────────┘  │                               │
│        ↕ scroll      │    ← map flies to new view    │
│  ┌────────────────┐  │                               │
│  │ ## What we     │  │                               │
│  │    found       │  │                               │
│  └────────────────┘  │                               │
└──────────────────────┴───────────────────────────────┘
```

### Scroll mechanics

Uses **scrollama** (same library as VEDA-UI, vanilla JS, ~5KB).

1. Each chapter renders as a `<div data-step>` with ~80vh bottom padding for scroll distance.
2. Scrollama watches with `offset: 0.8` — triggers when a chapter reaches 80% of viewport.
3. On `onStepEnter`, update `activeChapterId` state.
4. `useEffect` watching `activeChapterId` sets camera via `onCameraChange()`.

### Map transitions

- **fly-to:** deck.gl `FlyToInterpolator` with `transitionDuration: 2000`. Built into deck.gl — no extra code.
- **instant:** Set camera state directly, no transition.

### Layer handling

- On mount, fetch dataset from `/api/datasets/{dataset_id}`.
- Build layer using existing layer builders (same as MapPage).
- Single layer for entire story — only camera moves between chapters.

### Edge cases

- Dataset expired → "This story's data has expired" message, narrative text still readable.
- Dataset not found → 404 page.
- Story not found in localStorage → 404 page.

---

## Editor Behavior

### Layout

Three-panel layout. Chapter list (left, 22%). Map (top-right). Narrative editor (bottom-right).

```
┌──────────────────┬────────────────────────────────────┐
│  CHAPTER LIST    │            MAP                     │
│                  │   (interactive — user navigates)   │
│  [1. The problem]│                                    │
│   2. What we     │                                    │
│      found       │   [📍 Capture this view]           │
│   3. What's next │                                    │
│                  ├────────────────────────────────────┤
│   [+ Add chapter]│   NARRATIVE EDITOR                 │
│                  │   ## The problem                   │
│                  │   Since 2015, deforestation in...  │
│                  │   [✨ Draft with AI]               │
├──────────────────┴────────────────────────────────────┤
│  [Preview]                              [Publish]     │
└───────────────────────────────────────────────────────┘
```

### Chapter list (left sidebar)

- Click to select → highlights chapter, loads narrative, flies map to saved `MapState`.
- Drag to reorder (HTML drag-and-drop API — sufficient for short lists, no library needed).
- Delete with inline confirmation ("are you sure?" toggle, not modal).
- "+ Add chapter" at bottom → creates new chapter with current map position.

### Map (top-right)

- Fully interactive `UnifiedMap` — user pans/zooms to find desired view.
- "Capture this view" button (floating over map) → snapshots `camera` into selected chapter's `map_state`.
- Visual feedback on capture (brief flash or checkmark).
- Selecting a different chapter flies the map to that chapter's saved `MapState`.

### Narrative editor (bottom-right)

- Plain `<textarea>` with monospace font. Markdown input, no live preview (v1).
- Auto-saves to selected chapter's `narrative` on change (debounced 500ms to localStorage).
- "Draft with AI" → opens small input for rough notes, generates a prompt to copy to ChatGPT/Claude. Zero backend work.

### Publish flow

- "Preview" → opens `/story/{id}` in new tab (reads from localStorage).
- "Publish" → sets `story.published = true`, copies reader URL to clipboard, shows toast.
- In v1, "publish" just means "mark as done" — the reader always works locally.

---

## Dependencies

New npm packages:

| Package | Size | Purpose |
|---------|------|---------|
| `scrollama` | ~5KB | Scroll-triggered chapter transitions (same as VEDA-UI) |
| `react-markdown` | ~12KB | Render chapter narrative markdown in reader |

No backend dependencies. No database changes.

---

## What v1 Does NOT Include

- Shareable URLs or embed mode (localStorage is device-local)
- Multi-dataset stories
- Rich text editor or markdown preview
- Image upload
- Undo/redo
- Auto-save indicator
- Collaborative editing
- Server-side persistence
- Story gallery

---

## Build Order

| Phase | Deliverable | Dependencies |
|-------|-------------|--------------|
| 1 | Story data model — types, localStorage CRUD, tests | None |
| 2 | Story reader — scrollama, sticky map, chapter rendering, fly-to | Phase 1 |
| 3 | Story editor — chapter list, map capture, markdown textarea, publish | Phases 1-2 |
| 4 | CTA integration — wire CreditsPanel link to `/story/new?dataset={id}` | Phase 3 |
| 5 | AI drafting — prompt template (copy-paste to ChatGPT/Claude) | Phase 3 |

Reader before editor: the reader is the output people experience. If the scrollytelling transitions aren't compelling, the editor doesn't matter.

---

## Success Criteria

- A user can create a 3-chapter scrollytelling story from a sandbox dataset in under 10 minutes.
- The story reader renders a compelling scroll-driven map experience in the same browser.
- At least one Dev Seed team member creates a story they'd show to someone else.
