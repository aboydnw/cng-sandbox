# Chapter Types: Prose & Embedded Map

**Status:** Approved design
**Date:** 2026-03-21
**Parent spec:** CNG_Sandbox_StoryMap_Builder_Spec.md

---

## Problem

Every chapter in the storymap builder is a scrollytelling chapter — narrative text paired with a map that animates on scroll. This forces all story content into a single format. Authors need text-only sections (introductions, conclusions, methodology) and explorable map sections (where the reader drives the map, not scroll position). Without these, our tool looks like a StoryMap clone rather than a data storytelling platform.

## Design Decisions

- **Chapter types, not blocks.** Users think in terms of "sections" or "chapters," not "blocks." The data model adds a `type` field to the existing `Chapter` interface rather than introducing a new abstraction.
- **Flat chapter list.** No implicit grouping of consecutive scrollytelling chapters. Each chapter is self-contained and renders independently. This keeps the mental model simple: a story is an ordered list of typed chapters.
- **Type is mutable.** Authors pick a chapter type via a dropdown in the editor, not at creation time. They can change type after the fact without deleting and recreating.
- **Backward compatible.** Existing stories have no `type` field. The migration function defaults missing types to `"scrollytelling"`. No database migration needed — chapters are stored as JSON.

## Data Model

### Chapter type discriminator

```typescript
type ChapterType = "scrollytelling" | "prose" | "map";

interface Chapter {
  id: string;
  order: number;
  type: ChapterType;          // NEW — defaults to "scrollytelling"
  title: string;
  narrative: string;

  // Used by scrollytelling and map chapters; ignored by prose
  map_state: MapState;
  layer_config: LayerConfig;
  transition: "fly-to" | "instant";  // scrollytelling only
}
```

No new types introduced. The `map` chapter type reuses `MapState` and `LayerConfig` since it renders the same kind of map in a different layout.

### Backend schema

`ChapterPayload` Pydantic model in `ingestion/src/models/story.py`:

```python
type: str = "scrollytelling"  # optional field with default
```

No database migration. Chapters are stored as a JSON text column — the new field flows through automatically. The API is unaware of chapter type semantics; it stores and returns whatever the client sends.

### Migration

In `frontend/src/lib/story/migration.ts`, within the existing `migrateStory()` function:

```typescript
// Add type field to chapters missing it
for (const chapter of story.chapters) {
  if (!chapter.type) {
    chapter.type = "scrollytelling";
  }
}
```

## Reader Rendering

The reader iterates `story.chapters` sorted by `order` and renders each chapter based on its `type`. No grouping logic.

### Prose chapter

- Full-width contained section, max-width ~800px, centered horizontally
- Renders `title` as a heading and `narrative` as markdown
- No map, no Scrollama
- Separated from adjacent chapters with vertical padding

### Scrollytelling chapter

- Same layout as today: narrative on the left (~40%), map on the right (~60%)
- Scoped to a single chapter — the map shows that chapter's `map_state` and `layer_config`
- Scrollama drives the entry animation (fly-to or instant when the chapter scrolls into view)
- Each scrollytelling chapter is self-contained with its own map instance

### Map chapter

- Narrative text above: `title` + rendered `narrative` markdown, same max-width as prose (~800px, centered)
- Below the narrative: an interactive map at **constrained width** (~900px max, centered)
- Map is initialized to the chapter's `map_state` and `layer_config`
- Reader can pan, zoom, and explore freely
- **Visually distinct from scrollytelling:** rounded corners, subtle border or shadow, not edge-to-edge
- Visible **zoom controls** (+/− buttons) and a **legend** (colormap + dataset name) to signal interactivity
- Caption below the map (uses `title` or a future caption field)

## Editor Changes

### Chapter list sidebar

Each chapter card shows a type indicator — icon or short label — alongside the chapter number and title. No changes to drag-drop reordering or add/delete behavior.

### Narrative editor panel

New **Type dropdown** at the top of the panel, above the title field. Options: Scrollytelling, Prose, Map.

Changing type shows/hides fields:

| Field | Scrollytelling | Prose | Map |
|-------|:-:|:-:|:-:|
| Type dropdown | ✓ | ✓ | ✓ |
| Title | ✓ | ✓ | ✓ |
| Narrative | ✓ | ✓ | ✓ |
| Dataset selector | ✓ | — | ✓ |
| Colormap | ✓ | — | ✓ |
| Opacity | ✓ | — | ✓ |
| Transition | ✓ | — | — |

### Map preview panel

| Chapter type | Behavior |
|---|---|
| Scrollytelling | Map preview shown, "Capture View" button available |
| Prose | Map preview **hidden**, narrative editor fills full height |
| Map | Map preview shown, "Capture View" button sets the initial view |

### Default type for new chapters

`"scrollytelling"` — preserves current behavior. Users switch via the dropdown.

## Component Architecture

### New components

| Component | Purpose |
|---|---|
| `ProseChapter` | Reader renderer for prose chapters. Markdown-only, no map. |
| `MapChapter` | Reader renderer for map chapters. Narrative above, interactive map below. |
| `ChapterRenderer` | Dispatcher that picks the right renderer based on `chapter.type`. |

### Modified components

| Component | Changes |
|---|---|
| `StoryReaderPage` | Replace single Scrollama group with per-chapter rendering via `ChapterRenderer`. |
| `StoryEditorPage` | Conditionally show/hide map preview based on active chapter type. |
| `NarrativeEditor` | Add Type dropdown. Show/hide fields based on selected type. |
| `ChapterList` | Add type indicator icon/label to each chapter card. |

### Unchanged components

| Component | Why |
|---|---|
| `UnifiedMap` | Map chapters reuse the same map component. No changes needed. |
| Layer builders (`rasterTileLayer`, `vectorLayer`) | Map chapters use the same layer building logic. |
| Story API client (`api.ts`) | API is type-agnostic — it stores/returns the JSON blob. |

## What This Does NOT Cover

- Image/figure chapters (future type)
- Embed/iframe chapters (future type)
- Chart chapters (future type)
- Grouped scrollytelling (multiple chapters sharing a sticky map)
- "Show Your Work" panel
- Publishing/static export

These are intentionally deferred. The `ChapterType` union is designed to be extended with new types later.
