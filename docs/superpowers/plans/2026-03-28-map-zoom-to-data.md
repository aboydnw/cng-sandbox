# Map Zoom to Data Bounds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zoom the map to data bounds in the story editor when a chapter's dataset or connection changes.

**Architecture:** Intercept `updateChapterLayerConfig` in `StoryEditorPage.tsx` to detect when the data source ID changes, look up the new source's bounds, and call `cameraFromBounds()` + `setCamera()`. The existing 800ms auto-save persists the new view.

**Tech Stack:** React, deck.gl (`WebMercatorViewport`), existing `cameraFromBounds` utility

**Spec:** `docs/superpowers/specs/2026-03-28-map-zoom-to-data-design.md`

---

## File Map

- **Modify:** `frontend/src/pages/StoryEditorPage.tsx` — add zoom-to-bounds logic when data source changes

This is a single-file change. The `cameraFromBounds` utility, dataset/connection data maps, and auto-save infrastructure all already exist.

---

### Task 1: Zoom to dataset bounds on dataset change

When the user picks a different dataset from the NarrativeEditor dropdown, `updateChapterLayerConfig` is called with a new `dataset_id`. We need to detect this change and zoom to the new dataset's bounds.

**Files:**
- Modify: `frontend/src/pages/StoryEditorPage.tsx:407-414`

- [ ] **Step 1: Replace `updateChapterLayerConfig` with a version that detects dataset changes and zooms**

The current function at line 407 is:

```typescript
function updateChapterLayerConfig(config: LayerConfig) {
  updateStory((s) => ({
    ...s,
    chapters: s.chapters.map((ch) =>
      ch.id === activeChapterId ? { ...ch, layer_config: config } : ch
    ),
  }));
}
```

Replace it with:

```typescript
function updateChapterLayerConfig(config: LayerConfig) {
  const prevConfig = activeChapter?.layer_config;

  updateStory((s) => ({
    ...s,
    chapters: s.chapters.map((ch) =>
      ch.id === activeChapterId ? { ...ch, layer_config: config } : ch
    ),
  }));

  // Zoom to bounds when dataset changes
  if (config.dataset_id && config.dataset_id !== prevConfig?.dataset_id) {
    const ds = allDatasets.find((d) => d.id === config.dataset_id);
    if (ds?.bounds) {
      setTransitionDuration(1000);
      setCamera(cameraFromBounds(ds.bounds));
    }
  }

  // Zoom to bounds when connection changes
  if (config.connection_id && config.connection_id !== prevConfig?.connection_id) {
    const conn = connectionMap.get(config.connection_id);
    if (conn?.bounds) {
      setTransitionDuration(1000);
      setCamera(cameraFromBounds(conn.bounds));
    }
  }
}
```

This compares the incoming config's `dataset_id` / `connection_id` against the active chapter's current config. If either changed and the new source has bounds, it zooms.

- [ ] **Step 2: Also zoom in `handleDatasetReady` (upload flow)**

The existing `handleDatasetReady` at line 239 fetches the dataset and updates the layer config, but doesn't zoom. Add zoom after the dataset is fetched. The current code is:

```typescript
async function handleDatasetReady(datasetId: string) {
  setUploadModalOpen(false);
  try {
    const resp = await workspaceFetch(
      `${config.apiBase}/api/datasets/${datasetId}`
    );
    if (!resp.ok) return;
    const ds: Dataset = await resp.json();
    setAllDatasets((prev) =>
      prev.some((d) => d.id === ds.id) ? prev : [...prev, ds]
    );
    if (activeChapterId) {
      updateChapterLayerConfig({
        ...(activeChapter?.layer_config ?? DEFAULT_LAYER_CONFIG),
        dataset_id: datasetId,
      });
    }
  } catch (e) {
    console.error("Failed to fetch new dataset", e);
  }
}
```

No code change needed here — `updateChapterLayerConfig` now handles zoom-to-bounds internally when it detects the `dataset_id` changed. The freshly fetched dataset is added to `allDatasets` before calling `updateChapterLayerConfig`, so the lookup will find it.

- [ ] **Step 3: Run the frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All existing tests pass (no test changes needed — this is UI behavior not covered by unit tests).

- [ ] **Step 4: Manual verification**

Start the stack: `docker compose -f docker-compose.yml up -d`

Open `http://localhost:5185`, create a story with a dataset:
1. Verify the first chapter zooms to the dataset bounds (existing behavior)
2. Add a second chapter — verify it inherits the current camera (no zoom)
3. On the second chapter, switch to a different dataset via the dropdown — verify the map zooms to the new dataset's bounds
4. Switch to a connection — verify the map zooms to the connection's bounds (if it has bounds)
5. Switch back to the original dataset — verify it zooms back

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: zoom to data bounds on dataset/connection change in story editor

Closes #62"
```
