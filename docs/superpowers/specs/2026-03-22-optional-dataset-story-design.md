# Optional Dataset for Story Creation — Design Spec

## Problem

The story editor requires a `dataset_id` at creation time. The homepage "Build a story" card navigates to `/story/new` without a dataset, hitting a dead end ("No dataset specified"). Stories should be identifiable by their story ID alone, with datasets added per-chapter as needed.

## Design

Make `dataset_id` optional throughout the story creation flow. A new story starts with a single prose chapter (text-only, no map). Users add datasets per-chapter via the existing chapter editor.

## Backend Changes

### Database: Make `dataset_id` nullable

**File:** `ingestion/src/models/story.py:19`

```python
# Before
dataset_id = Column(String, nullable=False)

# After
dataset_id = Column(String, nullable=True)
```

### Schema: Make `dataset_id` optional on create and response

**File:** `ingestion/src/models/story.py:37-62`

`StoryCreate.dataset_id` becomes `str | None = None`.

`StoryResponse.dataset_id` becomes `str | None`.

`StoryIndexEntry` (if used) — same treatment.

### Route: Handle null `dataset_id` in response builder

**File:** `ingestion/src/routes/stories.py:19-38`

In `_row_to_response`, line 27 currently falls back to `[row.dataset_id]` when no chapter datasets exist. When `row.dataset_id` is `None`, this produces `[None]`. Fix:

```python
# Before
dataset_ids = chapter_dataset_ids if chapter_dataset_ids else [row.dataset_id]

# After
dataset_ids = chapter_dataset_ids if chapter_dataset_ids else ([row.dataset_id] if row.dataset_id else [])
```

### Database migration

Create `ingestion/migrations/004_nullable_dataset_id.sql`:

```sql
ALTER TABLE stories ALTER COLUMN dataset_id DROP NOT NULL;
```

Apply in the app startup or via the existing migration mechanism.

### Tests

Add to story tests:
- Test creating a story with no `dataset_id` — should return 201 with `dataset_ids: []`
- Test existing stories with `dataset_id` still work unchanged

## Frontend Changes

### Types: Make `dataset_id` optional

**File:** `frontend/src/lib/story/types.ts`

```typescript
// Story interface (line 44)
dataset_id: string | null;

// StoryIndexEntry (line 54)
dataset_id: string | null;

// createStory function (line 89-103)
export function createStory(
  datasetId?: string | null,
  overrides: Partial<Story> = {},
): Story {
  const proseChapter = createChapter({
    order: 0,
    title: "Chapter 1",
    type: "prose",
    narrative: "",
    layer_config: {
      ...DEFAULT_LAYER_CONFIG,
      dataset_id: datasetId ?? "",
    },
  });

  return {
    id: uuid(),
    title: "Untitled story",
    dataset_id: datasetId ?? null,
    dataset_ids: datasetId ? [datasetId] : [],
    chapters: [proseChapter],
    created_at: new Date().toISOString(),
    published: false,
    ...overrides,
  };
}
```

When `datasetId` is provided, behavior is unchanged (scrollytelling chapter with dataset). When omitted, creates a prose chapter.

### API: Allow null `dataset_id`

**File:** `frontend/src/lib/story/api.ts:6-19`

`createStoryOnServer` already sends `dataset_id: story.dataset_id` — no change needed since the backend now accepts `null`.

### Migration: Handle null `dataset_id`

**File:** `frontend/src/lib/story/migration.ts:17-22`

```typescript
// Before
: [story.dataset_id];

// After
: story.dataset_id ? [story.dataset_id] : [];
```

### StoryEditorPage: Allow dataset-free creation

**File:** `frontend/src/pages/StoryEditorPage.tsx:87-132`

The "Fetch dataset" `useEffect` currently hard-stops when no `dsId`. Restructure:

1. Remove the "No dataset specified" error (lines 90-93)
2. When `/story/new` with no `?dataset` param: create a blank story (prose chapter), save to server, redirect to `/story/{id}/edit`
3. When `/story/new?dataset=X`: existing behavior (create story with that dataset)
4. When loading an existing story with no `dataset_id`: skip the dataset fetch, set `loading = false`

Simplified flow:

```typescript
useEffect(() => {
  // For /story/new (no id yet), create story immediately
  if (!id && !story) {
    async function createNewStory() {
      const draft = createStory(datasetIdParam);
      // If dataset param provided, fetch bounds for initial camera
      if (datasetIdParam) {
        // ... existing dataset fetch + camera setup
      }
      const saved = await createStoryOnServer(draft);
      setStory(saved);
      setActiveChapterId(saved.chapters[0]?.id ?? "");
      setLoading(false);
      navigate(`/story/${saved.id}/edit`, { replace: true });
    }
    createNewStory();
    return;
  }

  // For existing stories, fetch primary dataset if set
  const dsId = story?.dataset_id;
  if (!dsId) {
    setLoading(false);
    return; // No primary dataset — that's fine
  }
  // ... existing dataset fetch logic
}, [/* deps */]);
```

### addChapter: Handle missing story dataset_id

**File:** `frontend/src/pages/StoryEditorPage.tsx:226-242`

Line 228 currently falls back to `story?.dataset_id ?? ""`. This already works when `dataset_id` is null (falls back to `""`), so no change needed.

## What stays the same

- **StoryReaderPage** — already handles missing datasets per-chapter gracefully
- **NarrativeEditor** — already supports per-chapter dataset switching and upload
- **StoryUpdate schema** — doesn't include `dataset_id`
- **Map chapters** — still require a dataset in their `LayerConfig` to render a map
- **Prose chapters** — already supported, no map rendering needed

## Migration safety

Existing stories all have a `dataset_id`. Making the column nullable doesn't affect them. The response builder's fallback logic preserves backward compatibility: stories with a `dataset_id` still return it in `dataset_ids`.
