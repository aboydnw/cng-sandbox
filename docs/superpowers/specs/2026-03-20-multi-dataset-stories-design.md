# Multi-Dataset Stories — Design Spec

**Status:** Approved
**Date:** 2026-03-20
**Parent:** CNG Sandbox Storytelling Spec v0.4
**Branch:** `feat/storytelling-thin-slice`

---

## Summary

Allow each chapter in a story to reference a different dataset. This enables comparison stories ("deforestation in 2015 vs 2020") and tour stories ("three different project sites") without requiring multi-layer-per-chapter complexity.

## Scope

**In scope:**
- One dataset per chapter (each chapter can pick a different one)
- Dataset picker dropdown in the narrative editor panel
- Reader fetches multiple datasets and builds layers per-chapter
- Graceful degradation when a chapter's dataset expires
- Backward-compatible migration for existing single-dataset stories

**Out of scope:**
- Multiple datasets visible simultaneously in one chapter (overlay/comparison slider)
- Standalone "New Story" entry point (keep existing CTA flow)
- Dataset search or filtering in the picker

---

## Data Model

### Before

```typescript
interface Story {
  id: string;
  title: string;
  description?: string;
  dataset_id: string;        // single dataset for entire story
  chapters: Chapter[];
  created_at: string;
  published: boolean;
}

interface LayerConfig {
  colormap: string;
  opacity: number;
  basemap: string;
  band?: number;
  timestep?: number;
}
```

### After

```typescript
interface Story {
  id: string;
  title: string;
  description?: string;
  dataset_id: string;        // primary dataset (from CTA entry point)
  dataset_ids: string[];     // all referenced datasets (computed from chapters)
  chapters: Chapter[];
  created_at: string;
  published: boolean;
}

interface LayerConfig {
  dataset_id: string;        // NEW: which dataset this chapter shows
  colormap: string;
  opacity: number;
  basemap: string;
  band?: number;
  timestep?: number;
}
```

### Key decisions

- **`Story.dataset_id`** (singular) is retained for backward compatibility and represents the primary dataset that initiated the story via the CTA. It remains the column in the database.
- **`Story.dataset_ids`** (plural) is computed by the API response from the unique `layer_config.dataset_id` values across all chapters. It is not stored in the database — it is derived on read.
- **`LayerConfig.dataset_id`** is the source of truth for which dataset a chapter displays.
- **`DEFAULT_LAYER_CONFIG`** gains a `dataset_id` field, defaulting to empty string `""`. The editor sets it from context when creating chapters.
- **`Story.dataset_ids`** is response-only. It does not appear in `StoryCreate` or `StoryUpdate` schemas, and the frontend should not send it in write payloads. The `saveStoryToServer` function already only sends `title`, `description`, `chapters`, `published` — this remains unchanged.

---

## Backend Changes

### API response changes

The `StoryResponse` Pydantic schema adds a computed `dataset_ids` field:

```python
class StoryResponse(BaseModel):
    id: str
    title: str
    description: str | None
    dataset_id: str              # primary dataset (DB column)
    dataset_ids: list[str]       # computed: unique dataset IDs from chapters
    chapters: list[ChapterPayload]
    published: bool
    created_at: str
    updated_at: str
```

The `_row_to_response` function computes `dataset_ids` by extracting unique `layer_config.dataset_id` values from the chapters JSON.

### No schema migration needed

The `stories` table is unchanged. `dataset_id` column stays. The per-chapter dataset reference lives inside `chapters_json` (in each chapter's `layer_config` object). The computed `dataset_ids` field is API-only.

---

## Editor Changes

### Dataset fetching

On mount, the editor calls `GET /api/datasets` to fetch all available datasets. These are stored in component state as `Dataset[]` and used for:
1. The dataset picker dropdown options
2. Looking up tile URLs and metadata for the active chapter's dataset

### Dataset picker in NarrativeEditor

A `<select>` dropdown added to the `NarrativeEditor` component, alongside the existing colormap and opacity controls. It sits in the controls row at the bottom of the panel.

Props added to `NarrativeEditor`:
- `datasets: Dataset[]` — all available datasets for the dropdown
- `layerConfig.dataset_id` — the currently selected dataset for this chapter

When the user changes the dataset, the editor:
1. Updates `chapter.layer_config.dataset_id`
2. Rebuilds layers from the new dataset
3. Adjusts available controls — the `datasetType` prop passed to `NarrativeEditor` must be derived from the active chapter's looked-up dataset (`datasets.find(d => d.id === activeChapter.layer_config.dataset_id)?.dataset_type`), not from a single story-level dataset. This ensures colormap/opacity controls only show for raster chapters.

### Layer building

The `useMemo` that builds layers currently uses a single `dataset` variable. It changes to:
1. Look up `activeChapter.layer_config.dataset_id` in the fetched datasets
2. Build layers from that dataset
3. Handle the case where the dataset isn't found (expired/deleted)

### New chapter behavior

When clicking "+ Add chapter", the new chapter inherits the active chapter's `layer_config.dataset_id`. This reduces friction — users only change the dataset when they want a different one.

### Entry point

Unchanged. `"/story/new?dataset={id}"` creates a story with `dataset_id` set to the originating dataset. The `createStory()` factory function must set the first chapter's `layer_config.dataset_id` to the same value (passed as the `datasetId` argument). Users can change it per-chapter in the editor.

---

## Reader Changes

### Multi-dataset fetching

On mount, the reader reads `story.dataset_ids` and fires parallel fetches for each dataset ID. Results are stored in a `Map<string, Dataset | null>`:
- Successful fetch → `Dataset` object
- 404 or error → `null` (dataset expired)

### Per-chapter layer building

When the active chapter changes on scroll, the reader:
1. Reads `chapter.layer_config.dataset_id`
2. Looks up the dataset in the map
3. Builds layers if the dataset exists, or renders nothing if it's `null`

### Graceful degradation

If a chapter's dataset has expired:
- The map area shows a subtle overlay text: "Data no longer available"
- The narrative text still renders normally
- Scrolling still triggers transitions to other chapters
- Other chapters with valid datasets work fine

This replaces the current all-or-nothing error page behavior.

---

## Migration

### Frontend migration function

A `migrateStory(story: Story): Story` function that handles old single-dataset stories:

1. Check if any chapter's `layer_config` is missing `dataset_id`
2. If so, copy `story.dataset_id` into each chapter's `layer_config.dataset_id`
3. Return the updated story

This runs in both the editor and reader when loading a story. If changes were made, the editor saves the migrated story back to the API (reader does not save — it's read-only).

### Backend compatibility

The `StoryCreate` schema still accepts `dataset_id` (required). Old clients that don't send `layer_config.dataset_id` in chapters will have it backfilled by the frontend migration on first edit.

---

## Files Affected

### Modified files

| File | Changes |
|------|---------|
| `frontend/src/lib/story/types.ts` | Add `dataset_id` to `LayerConfig`, add `dataset_ids` to `Story`, update defaults and factory functions |
| `frontend/src/pages/StoryEditorPage.tsx` | Fetch all datasets, pass to NarrativeEditor, look up dataset per chapter for layer building |
| `frontend/src/pages/StoryReaderPage.tsx` | Fetch multiple datasets, per-chapter layer building, graceful degradation overlay |
| `frontend/src/components/NarrativeEditor.tsx` | Add dataset picker dropdown, accept `datasets` prop |
| `ingestion/src/models/story.py` | Add `dataset_ids` computed field to `StoryResponse` |
| `ingestion/src/routes/stories.py` | Compute `dataset_ids` in `_row_to_response` |
| `ingestion/tests/test_stories.py` | Update tests for `dataset_ids` in responses |

### New files

| File | Purpose |
|------|---------|
| `frontend/src/lib/story/migration.ts` | `migrateStory()` function for backward compatibility |
| `frontend/src/lib/story/__tests__/migration.test.ts` | Tests for migration function |
