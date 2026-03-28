# Map Zoom to Data Bounds

**Issue:** [#62](https://github.com/aboydnw/cng-sandbox/issues/62)
**Date:** 2026-03-28

## Problem

The story editor does not zoom the map to data bounds when a chapter's dataset or connection changes. Users have to manually find their data on the map.

The MapPage already handles this correctly for both datasets and connections.

## Scope

Story editor only (`StoryEditorPage.tsx`). No changes to MapPage, StoryReaderPage, or backend.

## Design

### Trigger: dataset change on a chapter

When `handleDatasetReady()` fires (user picks a different dataset for the active chapter):

1. Fetch the dataset (already happens)
2. If the dataset has `bounds`, call `cameraFromBounds(bounds, containerSize)` and `setCamera()`
3. The existing 800ms debounce auto-saves the new map state to the chapter

### Trigger: connection change on a chapter

When a connection is selected for the active chapter:

1. Fetch the connection data
2. If the connection has `bounds`, call `cameraFromBounds(bounds, containerSize)` and `setCamera()`
3. Same auto-save behavior

### What stays the same

- **New chapters** inherit the current camera position (no zoom-to-bounds unless the data source differs from what's already on screen)
- **Clicking between chapters** restores the chapter's saved map state via `selectChapter()`
- **First chapter on story creation** already zooms to bounds (lines 172-182)
- **MapPage** already works for both datasets and connections
- **Story reader** unchanged

### Edge cases

- If the new dataset/connection has `null` bounds, don't change the camera
- Use the map container element's dimensions for accurate zoom calculation (matching MapPage's pattern with `mapContainerRef`)
