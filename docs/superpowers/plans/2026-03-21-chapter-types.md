# Chapter Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prose and embedded map chapter types to the storymap builder so stories can mix text-only sections, explorable map widgets, and scrollytelling chapters.

**Architecture:** Extend the existing `Chapter` interface with a `type` discriminator field. The reader renders each chapter independently based on type. The editor conditionally shows/hides map preview and layer config fields based on the active chapter's type.

**Tech Stack:** React 19, Chakra UI v3, TypeScript, deck.gl, MapLibre GL JS, Scrollama, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-chapter-types-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/lib/story/types.ts` | Modify | Add `ChapterType` type and `type` field to `Chapter` interface |
| `frontend/src/lib/story/migration.ts` | Modify | Default missing `type` to `"scrollytelling"` |
| `frontend/src/lib/story/index.ts` | Modify | Export `ChapterType` |
| `frontend/src/lib/story/__tests__/migration.test.ts` | Modify | Add test for type migration |
| `frontend/src/components/ChapterList.tsx` | Modify | Show type indicator, update subtitle for non-scrollytelling types |
| `frontend/src/components/NarrativeEditor.tsx` | Modify | Add type dropdown, conditionally show/hide fields |
| `frontend/src/pages/StoryEditorPage.tsx` | Modify | Conditionally show/hide map preview based on chapter type |
| `frontend/src/components/ProseChapter.tsx` | Create | Reader renderer for prose chapters |
| `frontend/src/components/MapChapter.tsx` | Create | Reader renderer for embedded map chapters |
| `frontend/src/pages/StoryReaderPage.tsx` | Modify | Replace Scrollama group with per-chapter type dispatch |
| `ingestion/src/models/story.py` | Modify | Add `type` field to `ChapterPayload` |
| `ingestion/tests/test_story_api.py` | Modify | Add test for round-tripping `type` field (if exists; create if not) |

---

### Task 1: Data model — add `type` field to Chapter

**Files:**
- Modify: `frontend/src/lib/story/types.ts:28-36`
- Modify: `frontend/src/lib/story/types.ts:71-84`
- Modify: `frontend/src/lib/story/index.ts:1`

- [ ] **Step 1: Add `ChapterType` and update `Chapter` interface**

In `frontend/src/lib/story/types.ts`, add the type alias before the `Chapter` interface and add the `type` field:

```typescript
export type ChapterType = "scrollytelling" | "prose" | "map";

export interface Chapter {
  id: string;
  order: number;
  type: ChapterType;
  title: string;
  narrative: string;
  map_state: MapState;
  transition: "fly-to" | "instant";
  layer_config: LayerConfig;
}
```

- [ ] **Step 2: Add `type` default to `createChapter`**

In the same file, add `type: "scrollytelling"` to `createChapter`'s return object (before `...overrides`):

```typescript
export function createChapter(
  overrides: Partial<Chapter> = {},
): Chapter {
  return {
    id: uuid(),
    order: 0,
    type: "scrollytelling",
    title: "Untitled chapter",
    narrative: "",
    map_state: { ...DEFAULT_MAP_STATE },
    transition: "fly-to",
    layer_config: { ...DEFAULT_LAYER_CONFIG },
    ...overrides,
  };
}
```

- [ ] **Step 3: Export `ChapterType` from index**

In `frontend/src/lib/story/index.ts`, add `ChapterType` to the type exports:

```typescript
export type { Story, Chapter, ChapterType, MapState, StoryIndexEntry, LayerConfig } from "./types";
```

- [ ] **Step 4: Verify the project compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors (existing code doesn't reference `type` yet, so the missing field on old data won't cause compile errors — it's set via migration at runtime).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/story/types.ts frontend/src/lib/story/index.ts
git commit -m "feat: add ChapterType discriminator to Chapter interface"
```

---

### Task 2: Migration — default missing `type` to `"scrollytelling"`

**Files:**
- Modify: `frontend/src/lib/story/migration.ts:4-9`
- Test: `frontend/src/lib/story/__tests__/migration.test.ts`

- [ ] **Step 1: Write failing tests**

Add two tests to `frontend/src/lib/story/__tests__/migration.test.ts`:

```typescript
it("backfills chapter type as scrollytelling when missing", () => {
  const old = makeOldStory();
  const migrated = migrateStory(old);
  expect(migrated.chapters[0].type).toBe("scrollytelling");
  expect(migrated.chapters[1].type).toBe("scrollytelling");
});

it("preserves existing chapter type", () => {
  const old = makeOldStory();
  old.chapters[0].type = "prose";
  const migrated = migrateStory(old);
  expect(migrated.chapters[0].type).toBe("prose");
  expect(migrated.chapters[1].type).toBe("scrollytelling");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/story/__tests__/migration.test.ts`
Expected: The "backfills chapter type" test fails (type is undefined).

- [ ] **Step 3: Add migration logic**

In `frontend/src/lib/story/migration.ts`, inside the `chapters.map` callback (around line 4-9), add type defaulting:

```typescript
export function migrateStory(story: any): Story {
  const chapters = (story.chapters ?? []).map((ch: any) => {
    const lc = { ...(ch.layer_config ?? {}) };
    if (!lc.dataset_id) {
      lc.dataset_id = story.dataset_id;
    }
    return { ...ch, layer_config: lc, type: ch.type ?? "scrollytelling" };
  });

  const chapterDatasetIds = chapters
    .map((ch: any) => ch.layer_config.dataset_id)
    .filter((id: string) => id);
  const uniqueIds = [...new Set<string>(chapterDatasetIds)];

  const dataset_ids =
    story.dataset_ids && story.dataset_ids.length > 0
      ? story.dataset_ids
      : uniqueIds.length > 0
        ? uniqueIds
        : [story.dataset_id];

  return { ...story, chapters, dataset_ids };
}
```

The key change is on the return line of the map callback: `type: ch.type ?? "scrollytelling"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/story/__tests__/migration.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/story/migration.ts frontend/src/lib/story/__tests__/migration.test.ts
git commit -m "feat: migrate chapters without type to scrollytelling"
```

---

### Task 3: Backend — add `type` field to `ChapterPayload`

**Files:**
- Modify: `ingestion/src/models/story.py:29-36`

- [ ] **Step 1: Add `type` field to ChapterPayload**

In `ingestion/src/models/story.py`, add to `ChapterPayload`:

```python
class ChapterPayload(BaseModel):
    id: str
    order: int
    type: str = "scrollytelling"
    title: str
    narrative: str
    map_state: dict
    transition: str = "fly-to"
    layer_config: dict | None = None
```

- [ ] **Step 2: Run existing backend tests**

Run: `cd ingestion && uv run pytest -v`
Expected: All existing tests pass (the new field has a default, so nothing breaks).

- [ ] **Step 3: Commit**

```bash
git add ingestion/src/models/story.py
git commit -m "feat: add type field to ChapterPayload with scrollytelling default"
```

---

### Task 4: Editor — type dropdown in NarrativeEditor

**Files:**
- Modify: `frontend/src/components/NarrativeEditor.tsx`

- [ ] **Step 1: Add `chapterType` and `onChapterTypeChange` props**

Update the `NarrativeEditorProps` interface and component signature:

```typescript
import type { ChapterType, LayerConfig } from "../lib/story";

interface NarrativeEditorProps {
  chapterType: ChapterType;
  onChapterTypeChange: (type: ChapterType) => void;
  title: string;
  narrative: string;
  onTitleChange: (title: string) => void;
  onNarrativeChange: (narrative: string) => void;
  layerConfig: LayerConfig;
  onLayerConfigChange: (config: LayerConfig) => void;
  datasetType: "raster" | "vector";
  datasets: Dataset[];
  onAddDataset?: () => void;
}
```

- [ ] **Step 2: Add type dropdown and conditional field visibility**

Add the type selector at the top of the form (before the title input), and wrap the layer config section in a condition:

```tsx
{/* Type selector */}
<Flex gap={2} align="center">
  <Text fontSize="xs" color="gray.500" fontWeight={600}>Type</Text>
  <select
    value={chapterType}
    onChange={(e) => onChapterTypeChange(e.target.value as ChapterType)}
    style={{ fontSize: "13px", padding: "4px 8px" }}
  >
    <option value="scrollytelling">Scrollytelling</option>
    <option value="prose">Prose</option>
    <option value="map">Map</option>
  </select>
</Flex>
```

Wrap the layer config bar (the `<Flex gap={4} px={4} ...>` block at line 88-142) so it only shows for scrollytelling and map chapters:

```tsx
{chapterType !== "prose" && (
  <Flex gap={4} px={4} py={2} borderTop="1px solid" borderColor="gray.100" flexWrap="wrap">
    {/* Dataset selector, colormap, opacity — existing code */}
    {/* ... */}
    {/* Only show transition for scrollytelling (no transition UI exists yet, so this is future-proofing) */}
  </Flex>
)}
```

- [ ] **Step 3: Verify it compiles (will fail until StoryEditorPage passes new props)**

Run: `cd frontend && npx tsc --noEmit`
Expected: Type error in `StoryEditorPage.tsx` — missing `chapterType` and `onChapterTypeChange` props. This is expected and will be fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NarrativeEditor.tsx
git commit -m "feat: add chapter type dropdown to NarrativeEditor"
```

---

### Task 5: Editor — conditional map preview and pass new props

**Files:**
- Modify: `frontend/src/pages/StoryEditorPage.tsx`

- [ ] **Step 1: Add `updateChapterType` handler**

Add alongside the other update functions (after `updateChapterLayerConfig` around line 281-288):

```typescript
function updateChapterType(type: ChapterType) {
  updateStory((s) => ({
    ...s,
    chapters: s.chapters.map((ch) =>
      ch.id === activeChapterId ? { ...ch, type } : ch,
    ),
  }));
}
```

Add the import for `ChapterType`:

```typescript
import {
  type Story,
  type Chapter,
  type ChapterType,
  type LayerConfig,
  // ... rest
} from "../lib/story";
```

- [ ] **Step 2: Conditionally render map preview**

Wrap the map panel (`<Box flex={6} position="relative">` at line 415) in a condition based on the active chapter's type:

```tsx
{/* Map (top) — hidden for prose chapters */}
{activeChapter?.type !== "prose" && (
  <Box flex={6} position="relative">
    <UnifiedMap
      camera={camera}
      onCameraChange={setCamera}
      layers={layers}
      basemap={basemap}
      onBasemapChange={setBasemap}
      transitionDuration={transitionDuration}
      transitionInterpolator={transitionDuration ? flyToRef.current : undefined}
    >
      <Button
        position="absolute"
        bottom={4}
        left="50%"
        transform="translateX(-50%)"
        size="sm"
        bg={captureFlash ? "green.500" : "blue.500"}
        color="white"
        shadow="md"
        onClick={captureView}
        transition="background 0.3s"
        _hover={{ bg: captureFlash ? "green.500" : "blue.600" }}
      >
        {captureFlash ? "✓ Captured!" : "📍 Capture this view"}
      </Button>
    </UnifiedMap>
  </Box>
)}
```

- [ ] **Step 3: Pass new props to NarrativeEditor**

Update the `<NarrativeEditor>` call to include the new props:

```tsx
<NarrativeEditor
  chapterType={activeChapter.type}
  onChapterTypeChange={updateChapterType}
  title={activeChapter.title}
  narrative={activeChapter.narrative}
  onTitleChange={updateChapterTitle}
  onNarrativeChange={updateChapterNarrative}
  layerConfig={activeChapter.layer_config}
  onLayerConfigChange={updateChapterLayerConfig}
  datasetType={activeDataset?.dataset_type ?? "raster"}
  datasets={allDatasets}
  onAddDataset={() => setUploadModalOpen(true)}
/>
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: conditionally show map preview based on chapter type"
```

---

### Task 6: Editor — chapter type indicator in ChapterList

**Files:**
- Modify: `frontend/src/components/ChapterList.tsx:78-84`

- [ ] **Step 1: Add type label and update subtitle**

Replace the subtitle line (line 83-84) with type-aware content:

```tsx
<Text fontSize="12px" fontWeight={600} lineClamp={1}>
  {i + 1}. {chapter.title}
</Text>
<Flex justify="space-between" align="center" mt={1}>
  <Text fontSize="10px" opacity={0.7}>
    {chapter.type === "prose"
      ? "prose"
      : chapter.type === "map"
        ? "map · zoom " + chapter.map_state.zoom.toFixed(0)
        : "zoom " + chapter.map_state.zoom.toFixed(0) + " · " + chapter.transition}
  </Text>
  {/* delete button — unchanged */}
</Flex>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChapterList.tsx
git commit -m "feat: show chapter type indicator in sidebar"
```

---

### Task 7: Reader — ProseChapter component

**Files:**
- Create: `frontend/src/components/ProseChapter.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Box, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import type { Chapter } from "../lib/story";

interface ProseChapterProps {
  chapter: Chapter;
  chapterIndex: number;
}

export function ProseChapter({ chapter, chapterIndex }: ProseChapterProps) {
  return (
    <Box maxW="800px" mx="auto" px={8} py={12}>
      <Text
        fontSize="10px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="blue.500"
        fontWeight={600}
        mb={2}
      >
        Chapter {chapterIndex + 1}
      </Text>
      {chapter.title && (
        <Heading size="lg" mb={4} color="gray.800">
          {chapter.title}
        </Heading>
      )}
      <Box
        fontSize="md"
        color="gray.700"
        lineHeight="1.8"
        css={{
          "& p": { marginBottom: "1em" },
          "& h1, & h2, & h3": {
            fontWeight: 600,
            marginBottom: "0.5em",
          },
        }}
      >
        <Markdown>{chapter.narrative}</Markdown>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProseChapter.tsx
git commit -m "feat: add ProseChapter reader component"
```

---

### Task 8: Reader — MapChapter component

**Files:**
- Create: `frontend/src/components/MapChapter.tsx`

This component renders narrative text above an interactive, constrained-width map. The map has visible zoom controls, a legend showing the colormap and dataset name, rounded corners, and a subtle border to distinguish it from full-bleed scrollytelling maps.

- [ ] **Step 1: Create the component**

```tsx
import { useCallback, useMemo, useState } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import { UnifiedMap } from "./UnifiedMap";
import type { Chapter } from "../lib/story";
import type { CameraState } from "../lib/layers/types";
import type { Dataset } from "../types";
import {
  buildRasterTileLayers,
  buildVectorLayer,
} from "../lib/layers";
import { DEFAULT_LAYER_CONFIG } from "../lib/story";

interface MapChapterProps {
  chapter: Chapter;
  chapterIndex: number;
  dataset: Dataset | null;
}

export function MapChapter({ chapter, chapterIndex, dataset }: MapChapterProps) {
  const [camera, setCamera] = useState<CameraState>({
    longitude: chapter.map_state.center[0],
    latitude: chapter.map_state.center[1],
    zoom: chapter.map_state.zoom,
    bearing: chapter.map_state.bearing,
    pitch: chapter.map_state.pitch,
  });
  const [basemap, setBasemap] = useState(chapter.map_state.basemap);

  const handleCameraChange = useCallback((c: CameraState) => {
    setCamera(c);
  }, []);

  const layers = useMemo(() => {
    if (!dataset) return [];
    const lc = chapter.layer_config ?? DEFAULT_LAYER_CONFIG;

    if (dataset.dataset_type === "raster") {
      const base = dataset.tile_url;
      const sep = base.includes("?") ? "&" : "?";
      const tileUrl = `${base}${sep}colormap_name=${lc.colormap}`;
      return buildRasterTileLayers({
        tileUrl,
        opacity: lc.opacity,
        isTemporalActive: false,
      });
    }
    return [
      buildVectorLayer({
        tileUrl: dataset.tile_url,
        isPMTiles: dataset.tile_url.startsWith("/pmtiles/"),
        opacity: lc.opacity,
        minZoom: dataset.min_zoom ?? undefined,
        maxZoom: dataset.max_zoom ?? undefined,
      }),
    ];
  }, [dataset, chapter.layer_config]);

  return (
    <Box maxW="900px" mx="auto" px={8} py={12}>
      {/* Narrative above map */}
      <Box maxW="800px" mx="auto" mb={6}>
        <Text
          fontSize="10px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="blue.500"
          fontWeight={600}
          mb={2}
        >
          Chapter {chapterIndex + 1}
        </Text>
        {chapter.title && (
          <Heading size="lg" mb={4} color="gray.800">
            {chapter.title}
          </Heading>
        )}
        {chapter.narrative && (
          <Box
            fontSize="md"
            color="gray.700"
            lineHeight="1.8"
            css={{
              "& p": { marginBottom: "1em" },
              "& h1, & h2, & h3": {
                fontWeight: 600,
                marginBottom: "0.5em",
              },
            }}
          >
            <Markdown>{chapter.narrative}</Markdown>
          </Box>
        )}
      </Box>

      {/* Interactive map */}
      <Box
        h="500px"
        borderRadius="12px"
        overflow="hidden"
        border="1px solid"
        borderColor="gray.200"
        shadow="sm"
        position="relative"
      >
        {dataset ? (
          <UnifiedMap
            camera={camera}
            onCameraChange={handleCameraChange}
            layers={layers}
            basemap={basemap}
            onBasemapChange={setBasemap}
          >
            {/* Zoom controls */}
            <Flex
              position="absolute"
              top={3}
              right={3}
              direction="column"
              gap={1}
              zIndex={10}
            >
              <Box
                as="button"
                bg="white"
                border="1px solid"
                borderColor="gray.300"
                borderRadius="6px"
                w="32px"
                h="32px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                fontSize="18px"
                fontWeight={700}
                color="gray.600"
                _hover={{ bg: "gray.50" }}
                onClick={() =>
                  setCamera((c) => ({ ...c, zoom: Math.min(c.zoom + 1, 20) }))
                }
              >
                +
              </Box>
              <Box
                as="button"
                bg="white"
                border="1px solid"
                borderColor="gray.300"
                borderRadius="6px"
                w="32px"
                h="32px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                fontSize="18px"
                fontWeight={700}
                color="gray.600"
                _hover={{ bg: "gray.50" }}
                onClick={() =>
                  setCamera((c) => ({ ...c, zoom: Math.max(c.zoom - 1, 1) }))
                }
              >
                −
              </Box>
            </Flex>

            {/* Legend */}
            <Box
              position="absolute"
              bottom={3}
              left={3}
              bg="white"
              borderRadius="8px"
              border="1px solid"
              borderColor="gray.200"
              px={3}
              py={2}
              zIndex={10}
              maxW="250px"
            >
              <Text fontSize="11px" fontWeight={600} color="gray.700" mb={1}>
                {dataset.filename}
              </Text>
              {dataset.dataset_type === "raster" && (
                <Text fontSize="10px" color="gray.500">
                  Colormap: {chapter.layer_config?.colormap ?? "viridis"}
                </Text>
              )}
              <Text fontSize="10px" color="gray.400" mt={1}>
                Pan and zoom to explore
              </Text>
            </Box>
          </UnifiedMap>
        ) : (
          <Flex h="100%" align="center" justify="center" bg="gray.100">
            <Text color="gray.500">Data no longer available</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MapChapter.tsx
git commit -m "feat: add MapChapter reader component with zoom controls and legend"
```

---

### Task 9: Reader — replace Scrollama group with per-chapter dispatch

**Files:**
- Modify: `frontend/src/pages/StoryReaderPage.tsx`

This is the largest change. The current reader renders all chapters in a single Scrollama-driven layout with a shared sticky map. The new reader renders each chapter independently based on its type.

- [ ] **Step 1: Add imports for new chapter components**

```typescript
import { ProseChapter } from "../components/ProseChapter";
import { MapChapter } from "../components/MapChapter";
```

- [ ] **Step 2: Replace the main content layout**

Replace the `{/* Main content */}` section (the `<Flex flex={1} overflow="hidden">` block, lines 239-327) with per-chapter type dispatch.

For scrollytelling chapters, keep the existing Scrollama behavior but scoped to individual chapters. For prose and map chapters, render their dedicated components.

```tsx
{/* Main content */}
<Box flex={1} overflowY="auto">
  {sortedChapters.map((chapter, i) => {
    if (chapter.type === "prose") {
      return (
        <ProseChapter
          key={chapter.id}
          chapter={chapter}
          chapterIndex={i}
        />
      );
    }

    if (chapter.type === "map") {
      const ds = datasetMap.get(chapter.layer_config.dataset_id) ?? null;
      return (
        <MapChapter
          key={chapter.id}
          chapter={chapter}
          chapterIndex={i}
          dataset={ds}
        />
      );
    }

    // scrollytelling — individual map + narrative side by side
    const ds = datasetMap.get(chapter.layer_config.dataset_id);
    const lc = chapter.layer_config ?? DEFAULT_LAYER_CONFIG;
    const chapterLayers = ds
      ? ds.dataset_type === "raster"
        ? buildRasterTileLayers({
            tileUrl: `${ds.tile_url}${ds.tile_url.includes("?") ? "&" : "?"}colormap_name=${lc.colormap}`,
            opacity: lc.opacity,
            isTemporalActive: false,
          })
        : [
            buildVectorLayer({
              tileUrl: ds.tile_url,
              isPMTiles: ds.tile_url.startsWith("/pmtiles/"),
              opacity: lc.opacity,
              minZoom: ds.min_zoom ?? undefined,
              maxZoom: ds.max_zoom ?? undefined,
            }),
          ]
      : [];

    return (
      <ScrollytellingChapter
        key={chapter.id}
        chapter={chapter}
        chapterIndex={i}
        layers={chapterLayers}
        dataset={ds ?? null}
      />
    );
  })}
</Box>
```

- [ ] **Step 3: Extract ScrollytellingChapter as an inline component**

Add a `ScrollytellingChapter` component within the same file (above the default export) to encapsulate the per-chapter scrollytelling behavior. Each scrollytelling chapter manages its own camera state and renders a side-by-side layout.

**Note:** This is a deliberate simplification from the old shared-sticky-map Scrollama approach. Since each chapter is now self-contained, the scrollytelling chapter renders a static side-by-side view (narrative left, map right) without scroll-driven animations. The map initializes to the chapter's `map_state`. Scroll-driven transitions within grouped chapters can be re-added as a future enhancement if needed.

```tsx
function ScrollytellingChapter({
  chapter,
  chapterIndex,
  layers,
  dataset,
}: {
  chapter: Chapter;
  chapterIndex: number;
  layers: Layer[];
  dataset: Dataset | null;
}) {
  const [chapterCamera, setChapterCamera] = useState<CameraState>({
    longitude: chapter.map_state.center[0],
    latitude: chapter.map_state.center[1],
    zoom: chapter.map_state.zoom,
    bearing: chapter.map_state.bearing,
    pitch: chapter.map_state.pitch,
  });
  const [chapterBasemap, setChapterBasemap] = useState(chapter.map_state.basemap);

  const handleCameraChange = useCallback((c: CameraState) => {
    setChapterCamera(c);
  }, []);

  return (
    <Flex h="80vh" overflow="hidden">
      {/* Left: narrative */}
      <Box w="40%" overflowY="auto" bg="gray.50" p={8}>
        <Box
          bg="white"
          borderRadius="8px"
          p={6}
          shadow="sm"
          border="1px solid"
          borderColor="gray.200"
        >
          <Text
            fontSize="10px"
            textTransform="uppercase"
            letterSpacing="1px"
            color="blue.500"
            fontWeight={600}
            mb={2}
          >
            Chapter {chapterIndex + 1}
          </Text>
          <Heading size="md" mb={3} color="gray.800">
            {chapter.title}
          </Heading>
          <Box
            fontSize="sm"
            color="gray.700"
            lineHeight="1.7"
            css={{
              "& p": { marginBottom: "1em" },
              "& h1, & h2, & h3": {
                fontWeight: 600,
                marginBottom: "0.5em",
              },
            }}
          >
            <Markdown>{chapter.narrative}</Markdown>
          </Box>
        </Box>
      </Box>

      {/* Right: map */}
      <Box w="60%" position="relative">
        {dataset ? (
          <UnifiedMap
            camera={chapterCamera}
            onCameraChange={handleCameraChange}
            layers={layers}
            basemap={chapterBasemap}
            onBasemapChange={setChapterBasemap}
          />
        ) : (
          <Flex h="100%" align="center" justify="center" bg="gray.200">
            <Text color="gray.500">Data no longer available</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
```

Add the required imports at the top of the file:

```typescript
import type { Layer } from "@deck.gl/core";
import type { Chapter } from "../lib/story";
```

- [ ] **Step 4: Clean up unused imports and state**

Remove from `StoryReaderPage`:
- `scrollama` import
- `FlyToInterpolator` import
- `activeChapterIndex` state
- `transitionDuration` state
- `flyToRef` ref
- `stepsRef` ref
- `scrollerRef` ref
- The Scrollama setup `useEffect` (lines 107-127)
- The "fly to chapter on active change" `useEffect` (lines 130-144)
- The "initialize camera from dataset bounds" `useEffect` (lines 91-99)
- The `layers` useMemo (layer building moves into per-chapter components)
- The `handleCameraChange` callback
- The `activeChapterDataset` variable
- The `camera` and `basemap` state (each chapter manages its own)

Keep:
- Story loading `useEffect`
- Dataset fetching `useEffect`
- `sortedChapters` useMemo
- Loading/error states

**Important:** `useState` and `useCallback` must remain imported — `ScrollytellingChapter` uses them.

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/StoryReaderPage.tsx
git commit -m "feat: render chapters by type — prose, map, scrollytelling"
```

---

### Task 10: Integration test — visual verification

**Files:** None (manual verification via Playwright MCP)

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && yarn dev` (background)

- [ ] **Step 2: Navigate to an existing story editor**

Use Playwright MCP to navigate to the story editor. Verify:
- The type dropdown appears in the narrative editor
- Switching to "Prose" hides the map preview panel
- Switching to "Map" shows the map preview panel
- Switching back to "Scrollytelling" restores the original layout

- [ ] **Step 3: Create a story with mixed chapter types**

Create a story with at least 3 chapters:
1. A prose chapter (introduction)
2. A scrollytelling chapter (map animation)
3. A map chapter (explorable map)

Save and open the reader view.

- [ ] **Step 4: Verify reader rendering**

In the reader, verify:
- Prose chapter renders as centered text, no map
- Scrollytelling chapter renders with side-by-side map + narrative
- Map chapter renders with text above a contained, bordered map with zoom controls and legend
- Vertical flow between chapter types looks clean

- [ ] **Step 5: Take a screenshot and commit**

Save screenshot to `/tmp/chapter-types-reader.png` for review.

```bash
git add -A
git commit -m "feat: chapter types — prose and embedded map support"
```

---

### Task 11: Run full test suite

- [ ] **Step 1: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run backend tests**

Run: `cd ingestion && uv run pytest -v`
Expected: All tests pass.

- [ ] **Step 3: Fix any failures and commit**

If any tests fail due to the changes (e.g., snapshot tests or tests that assert on chapter structure without the `type` field), update them and commit.
