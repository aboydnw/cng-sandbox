# Storytelling Thin Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only scrollytelling story builder to CNG Sandbox — users create scroll-driven map stories from their uploaded datasets.

**Architecture:** Standalone story pages (`/story/*`) composing the existing `UnifiedMap` + layer builders. Story data lives in localStorage. No backend changes. Reader uses scrollama for scroll-triggered map transitions. Editor is a three-panel layout (chapter list, map, narrative textarea).

**Tech Stack:** React 19, deck.gl 9 (FlyToInterpolator for transitions), scrollama (scroll detection), react-markdown (narrative rendering), Chakra UI v3, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-storytelling-thin-slice-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/lib/story/types.ts` | Story, Chapter, MapState interfaces |
| `frontend/src/lib/story/storage.ts` | localStorage CRUD (save, get, list, delete) |
| `frontend/src/lib/story/__tests__/storage.test.ts` | Unit tests for storage module |
| `frontend/src/lib/story/index.ts` | Barrel export |
| `frontend/src/pages/StoryReaderPage.tsx` | Scrollama + UnifiedMap reader (~150 lines) |
| `frontend/src/pages/StoryEditorPage.tsx` | Three-panel editor (~300 lines) |
| `frontend/src/components/ChapterList.tsx` | Sidebar chapter list with drag reorder |
| `frontend/src/components/NarrativeEditor.tsx` | Markdown textarea + AI draft prompt |

### Modified files

| File | Changes |
|------|---------|
| `frontend/src/App.tsx` | Add 3 story routes |
| `frontend/src/components/CreditsPanel.tsx` | Change "Turn this into a story" from external link to internal route |
| `frontend/package.json` | Add `scrollama`, `react-markdown` dependencies |

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install scrollama and react-markdown**

Run: `cd frontend && yarn add scrollama react-markdown`

- [ ] **Step 2: Install scrollama type definitions**

Run: `cd frontend && yarn add -D @types/scrollama`

Note: If `@types/scrollama` doesn't exist, we'll create a local declaration file. Check if the install succeeds — if it fails, create `frontend/src/types/scrollama.d.ts`:

```typescript
declare module "scrollama" {
  interface ScrollamaInstance {
    setup(options: {
      step: string | HTMLElement[];
      offset?: number;
      progress?: boolean;
      debug?: boolean;
    }): ScrollamaInstance;
    onStepEnter(callback: (response: { element: HTMLElement; index: number; direction: string }) => void): ScrollamaInstance;
    onStepExit(callback: (response: { element: HTMLElement; index: number; direction: string }) => void): ScrollamaInstance;
    resize(): void;
    destroy(): void;
  }
  export default function scrollama(): ScrollamaInstance;
}
```

- [ ] **Step 3: Verify install**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors from scrollama or react-markdown

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/yarn.lock
git commit -m "chore: add scrollama and react-markdown dependencies"
```

If a type declaration file was created, also add it:
```bash
git add frontend/src/types/scrollama.d.ts
```

---

## Task 2: Define story types

**Files:**
- Create: `frontend/src/lib/story/types.ts`

- [ ] **Step 1: Create the types file**

Create `frontend/src/lib/story/types.ts`:

```typescript
export interface MapState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  basemap: string;
}

export interface Chapter {
  id: string;
  order: number;
  title: string;
  narrative: string;
  map_state: MapState;
  transition: "fly-to" | "instant";
}

export interface Story {
  id: string;
  title: string;
  description?: string;
  dataset_id: string;
  chapters: Chapter[];
  created_at: string;
  published: boolean;
}

export interface StoryIndexEntry {
  id: string;
  title: string;
  dataset_id: string;
  created_at: string;
}

export const DEFAULT_MAP_STATE: MapState = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
  basemap: "streets",
};

export function createChapter(
  overrides: Partial<Chapter> = {},
): Chapter {
  return {
    id: crypto.randomUUID(),
    order: 0,
    title: "Untitled chapter",
    narrative: "",
    map_state: { ...DEFAULT_MAP_STATE },
    transition: "fly-to",
    ...overrides,
  };
}

export function createStory(
  datasetId: string,
  overrides: Partial<Story> = {},
): Story {
  return {
    id: crypto.randomUUID(),
    title: "Untitled story",
    dataset_id: datasetId,
    chapters: [createChapter({ order: 0, title: "Chapter 1" })],
    created_at: new Date().toISOString(),
    published: false,
    ...overrides,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `story/types.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/story/types.ts
git commit -m "feat: add story data model types"
```

---

## Task 3: Implement localStorage storage with tests

**Files:**
- Create: `frontend/src/lib/story/storage.ts`
- Create: `frontend/src/lib/story/__tests__/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/story/__tests__/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getStory, saveStory, listStories, deleteStory } from "../storage";
import { createStory } from "../types";

beforeEach(() => {
  localStorage.clear();
});

describe("saveStory / getStory", () => {
  it("round-trips a story through localStorage", () => {
    const story = createStory("dataset-1", { title: "Test Story" });
    saveStory(story);
    const loaded = getStory(story.id);
    expect(loaded).toEqual(story);
  });

  it("returns null for unknown id", () => {
    expect(getStory("nonexistent")).toBeNull();
  });

  it("overwrites an existing story on re-save", () => {
    const story = createStory("dataset-1", { title: "Original" });
    saveStory(story);
    story.title = "Updated";
    saveStory(story);
    expect(getStory(story.id)?.title).toBe("Updated");
  });
});

describe("listStories", () => {
  it("returns empty array when no stories exist", () => {
    expect(listStories()).toEqual([]);
  });

  it("returns index entries for saved stories", () => {
    const s1 = createStory("d1", { title: "First" });
    const s2 = createStory("d2", { title: "Second" });
    saveStory(s1);
    saveStory(s2);
    const list = listStories();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.title).sort()).toEqual(["First", "Second"]);
  });
});

describe("deleteStory", () => {
  it("removes story and its index entry", () => {
    const story = createStory("d1", { title: "Doomed" });
    saveStory(story);
    deleteStory(story.id);
    expect(getStory(story.id)).toBeNull();
    expect(listStories()).toHaveLength(0);
  });

  it("is a no-op for unknown id", () => {
    deleteStory("nonexistent");
    expect(listStories()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/story/__tests__/storage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/story/storage.ts`:

```typescript
import type { Story, StoryIndexEntry } from "./types";

const INDEX_KEY = "story:index";

function storyKey(id: string): string {
  return `story:${id}`;
}

function readIndex(): StoryIndexEntry[] {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeIndex(entries: StoryIndexEntry[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function listStories(): StoryIndexEntry[] {
  return readIndex();
}

export function getStory(id: string): Story | null {
  const raw = localStorage.getItem(storyKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStory(story: Story): void {
  localStorage.setItem(storyKey(story.id), JSON.stringify(story));

  const index = readIndex();
  const existing = index.findIndex((e) => e.id === story.id);
  const entry: StoryIndexEntry = {
    id: story.id,
    title: story.title,
    dataset_id: story.dataset_id,
    created_at: story.created_at,
  };

  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }
  writeIndex(index);
}

export function deleteStory(id: string): void {
  localStorage.removeItem(storyKey(id));
  const index = readIndex().filter((e) => e.id !== id);
  writeIndex(index);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/story/__tests__/storage.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Create barrel export**

Create `frontend/src/lib/story/index.ts`:

```typescript
export type { Story, Chapter, MapState, StoryIndexEntry } from "./types";
export { DEFAULT_MAP_STATE, createChapter, createStory } from "./types";
export { listStories, getStory, saveStory, deleteStory } from "./storage";
```

- [ ] **Step 6: Verify full test suite still passes**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/story/
git commit -m "feat: add story localStorage CRUD with tests"
```

---

## Task 4: Extend UnifiedMap to support fly-to transitions

**Files:**
- Modify: `frontend/src/components/UnifiedMap.tsx`

deck.gl supports animated view state transitions via `transitionDuration` and `transitionInterpolator` properties on the viewState object. However, `UnifiedMap` currently strips the viewState down to exactly the 5 `CameraState` fields in its `onViewStateChange` handler, which would cancel in-progress animations. We need to extend the component to support optional transition props.

- [ ] **Step 1: Add transition support to UnifiedMap**

Modify `frontend/src/components/UnifiedMap.tsx` to accept optional transition props and merge them into the viewState passed to DeckGL:

```typescript
import { forwardRef, useCallback } from "react";
import { Box } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView, FlyToInterpolator } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import type { Layer } from "@deck.gl/core";
import type { CameraState } from "../lib/layers/types";
import { BASEMAPS, BasemapPicker } from "./MapShell";

interface UnifiedMapProps {
  camera: CameraState;
  onCameraChange: (camera: CameraState) => void;
  layers: Layer[];
  basemap: string;
  onBasemapChange: (basemap: string) => void;
  transitionDuration?: number;
  transitionInterpolator?: FlyToInterpolator;
  onHover?: (info: any) => void;
  onClick?: (info: any) => void;
  getTooltip?: (info: any) => any;
  children?: React.ReactNode;
}

export const UnifiedMap = forwardRef<any, UnifiedMapProps>(function UnifiedMap(
  {
    camera,
    onCameraChange,
    layers,
    basemap,
    onBasemapChange,
    transitionDuration,
    transitionInterpolator,
    onHover,
    onClick,
    getTooltip,
    children,
  },
  ref,
) {
  const handleViewStateChange = useCallback(
    ({ viewState }: { viewState: any }) => {
      onCameraChange({
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        bearing: viewState.bearing ?? 0,
        pitch: viewState.pitch ?? 0,
      });
    },
    [onCameraChange],
  );

  const viewState = transitionDuration
    ? { ...camera, transitionDuration, transitionInterpolator }
    : camera;

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        ref={ref}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={{ dragRotate: true }}
        layers={layers}
        views={new MapView({ repeat: true })}
        onHover={onHover}
        onClick={onClick}
        getTooltip={getTooltip}
      >
        <Map mapStyle={BASEMAPS[basemap]} />
      </DeckGL>

      <Box
        position="absolute"
        top={3}
        left={3}
        bg="white"
        borderRadius="4px"
        shadow="sm"
        p={1}
      >
        <BasemapPicker value={basemap} onChange={onBasemapChange} />
      </Box>

      {children}
    </Box>
  );
});
```

- [ ] **Step 2: Verify it compiles and existing tests pass**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20 && npx vitest run`
Expected: No errors, all tests pass (UnifiedMap is unchanged for callers that don't pass transition props)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/UnifiedMap.tsx
git commit -m "feat: extend UnifiedMap with optional fly-to transition support"
```

---

## Task 5: Build the story reader page (Phase 2)

**Files:**
- Create: `frontend/src/pages/StoryReaderPage.tsx`
- Reference: `frontend/src/components/UnifiedMap.tsx` (map component)
- Reference: `frontend/src/lib/layers/index.ts` (layer builders)
- Reference: `frontend/src/lib/story/index.ts` (story storage)

This is the core deliverable — the scrollytelling reader. It must:
1. Load a story from localStorage by ID
2. Fetch the dataset from the API
3. Build the appropriate layer (raster or vector)
4. Render chapters as scrollable cards on the left
5. Use scrollama to trigger map fly-to transitions on scroll

- [ ] **Step 1: Create StoryReaderPage**

Create `frontend/src/pages/StoryReaderPage.tsx`:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import scrollama from "scrollama";
import { FlyToInterpolator } from "@deck.gl/core";
import { UnifiedMap } from "../components/UnifiedMap";

import {
  type CameraState,
  DEFAULT_CAMERA,
  cameraFromBounds,
  buildRasterTileLayers,
  buildVectorLayer,
} from "../lib/layers";
import { getStory } from "../lib/story";
import type { Story, Chapter } from "../lib/story";
import type { Dataset } from "../types";
import { config } from "../config";

export default function StoryReaderPage() {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [basemap, setBasemap] = useState("streets");
  const [transitionDuration, setTransitionDuration] = useState<number | undefined>(undefined);
  const flyToRef = useRef(new FlyToInterpolator());
  const stepsRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<ReturnType<typeof scrollama> | null>(null);

  // Load story from localStorage
  useEffect(() => {
    if (!id) return;
    const loaded = getStory(id);
    if (!loaded) {
      setError("Story not found");
      return;
    }
    setStory(loaded);
    // Initialize camera from first chapter (no transition)
    if (loaded.chapters.length > 0) {
      const ch = loaded.chapters[0];
      setCamera({
        longitude: ch.map_state.center[0],
        latitude: ch.map_state.center[1],
        zoom: ch.map_state.zoom,
        bearing: ch.map_state.bearing,
        pitch: ch.map_state.pitch,
      });
      setBasemap(ch.map_state.basemap);
    }
  }, [id]);

  // Fetch dataset from API
  useEffect(() => {
    if (!story) return;
    async function fetchDataset() {
      try {
        const resp = await fetch(
          `${config.apiBase}/api/datasets/${story!.dataset_id}`,
        );
        if (!resp.ok) {
          setError(
            resp.status === 404
              ? "This story's data has expired"
              : `Failed to load dataset (HTTP ${resp.status})`,
          );
          return;
        }
        setDataset(await resp.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      }
    }
    fetchDataset();
  }, [story]);

  // Initialize camera from dataset bounds if first chapter has default state
  useEffect(() => {
    if (dataset?.bounds && story?.chapters[0]) {
      const ch = story.chapters[0];
      if (ch.map_state.center[0] === 0 && ch.map_state.center[1] === 0) {
        setCamera(cameraFromBounds(dataset.bounds));
      }
    }
  }, [dataset, story]);

  // Set up scrollama
  useEffect(() => {
    if (!stepsRef.current || !story || story.chapters.length === 0) return;

    const scroller = scrollama();
    scrollerRef.current = scroller;

    scroller
      .setup({
        step: "[data-step]",
        offset: 0.8,
      })
      .onStepEnter(({ index }) => {
        setActiveChapterIndex(index);
      });

    return () => {
      scroller.destroy();
      scrollerRef.current = null;
    };
  }, [story]);

  // Fly to chapter on active change
  useEffect(() => {
    if (!story) return;
    const chapter = story.chapters[activeChapterIndex];
    if (!chapter) return;

    setBasemap(chapter.map_state.basemap);
    setTransitionDuration(chapter.transition === "fly-to" ? 2000 : undefined);
    setCamera({
      longitude: chapter.map_state.center[0],
      latitude: chapter.map_state.center[1],
      zoom: chapter.map_state.zoom,
      bearing: chapter.map_state.bearing,
      pitch: chapter.map_state.pitch,
    });
  }, [activeChapterIndex, story]);

  // Build layers
  const layers = useMemo(() => {
    if (!dataset) return [];
    if (dataset.dataset_type === "raster") {
      return buildRasterTileLayers({
        tileUrl: dataset.tile_url,
        opacity: 0.8,
        isTemporalActive: false,
      });
    }
    return [
      buildVectorLayer({
        tileUrl: dataset.tile_url,
        isPMTiles: dataset.tile_url.startsWith("/pmtiles/"),
        opacity: 1,
        minZoom: dataset.min_zoom ?? undefined,
        maxZoom: dataset.max_zoom ?? undefined,
      }),
    ];
  }, [dataset]);

  const handleCameraChange = useCallback((c: CameraState) => {
    setCamera(c);
    setTransitionDuration(undefined); // clear so user interaction doesn't re-trigger animation
  }, []);

  // --- Error state ---
  if (error) {
    return (
      <Flex
        h="100vh"
        direction="column"
        align="center"
        justify="center"
        bg="white"
        gap={4}
      >
        <Text color="gray.600" fontSize="lg">
          {error}
        </Text>
        {story && error === "This story's data has expired" && (
          <Text color="gray.500" fontSize="sm">
            The narrative text is preserved below, but the map data is no longer
            available.
          </Text>
        )}
        <Link to="/">
          <Text color="brand.orange" fontWeight={600}>
            ← Back to sandbox
          </Text>
        </Link>
      </Flex>
    );
  }

  if (!story) return null;

  const sortedChapters = [...story.chapters].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {/* Header */}
      <Flex
        h="48px"
        px={5}
        align="center"
        borderBottom="1px solid"
        borderColor="gray.200"
        bg="white"
        flexShrink={0}
      >
        <Heading size="sm" fontWeight={600} color="gray.800">
          {story.title}
        </Heading>
        <Text ml="auto" fontSize="xs" color="gray.500">
          Made with CNG Sandbox
        </Text>
      </Flex>

      {/* Main content */}
      <Flex flex={1} overflow="hidden">
        {/* Left: scrolling narrative */}
        <Box
          w="40%"
          overflowY="auto"
          bg="gray.50"
          ref={stepsRef}
        >
          {sortedChapters.map((chapter, i) => (
            <Box
              key={chapter.id}
              data-step
              px={8}
              pt={i === 0 ? 12 : 4}
              pb="80vh"
              opacity={activeChapterIndex === i ? 1 : 0.3}
              transition="opacity 0.4s ease"
            >
              <Box
                bg="white"
                borderRadius="8px"
                p={6}
                shadow="sm"
                border="1px solid"
                borderColor={
                  activeChapterIndex === i ? "blue.200" : "gray.200"
                }
              >
                <Text
                  fontSize="10px"
                  textTransform="uppercase"
                  letterSpacing="1px"
                  color="blue.500"
                  fontWeight={600}
                  mb={2}
                >
                  Chapter {i + 1}
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
          ))}
        </Box>

        {/* Right: sticky map */}
        <Box w="60%" position="relative">
          {dataset && (
            <UnifiedMap
              camera={camera}
              onCameraChange={handleCameraChange}
              layers={layers}
              basemap={basemap}
              onBasemapChange={setBasemap}
              transitionDuration={transitionDuration}
              transitionInterpolator={transitionDuration ? flyToRef.current : undefined}
            />
          )}
        </Box>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors. If the `CameraState` cast causes type errors, the implementing agent should extend the type or use `as any`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/StoryReaderPage.tsx
git commit -m "feat: add story reader page with scrollama transitions"
```

---

## Task 6: Add story routes

**Files:**
- Modify: `frontend/src/App.tsx:1-14`

- [ ] **Step 1: Add routes**

Add the story routes to `App.tsx`. The file currently has 3 routes — add 3 more:

```typescript
import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import StoryReaderPage from "./pages/StoryReaderPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/map/:id" element={<MapPage />} />
      <Route path="/expired/:id" element={<ExpiredPage />} />
      <Route path="/story/new" element={<StoryEditorPlaceholder />} />
      <Route path="/story/:id" element={<StoryReaderPage />} />
      <Route path="/story/:id/edit" element={<StoryEditorPlaceholder />} />
    </Routes>
  );
}

function StoryEditorPlaceholder() {
  return <div>Story editor — coming in Task 8</div>;
}
```

Note: We use a placeholder for the editor routes. These will be replaced in Task 7.

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add story routes to App.tsx"
```

---

## Task 7: Visual verification of story reader

**Files:** None (manual testing)

Use the dev server and Playwright MCP to verify the reader works end-to-end. This requires a running Docker stack with at least one dataset.

- [ ] **Step 1: Start the Docker stack**

Run: `cd /home/anthony/projects/cng-sandbox && docker compose up -d --build`

- [ ] **Step 2: Create a test story in localStorage via browser console**

Use Playwright MCP to navigate to `http://localhost:5185` and run a script in the browser console to create a test story. The script should:
1. Create a story with 3 chapters at different map positions
2. Save it to localStorage
3. Navigate to `/story/{id}` to verify the reader

Example story data to inject:

```javascript
const story = {
  id: "test-story-1",
  title: "Deforestation in Borneo",
  dataset_id: "<ACTUAL_DATASET_ID>",  // get from /api/datasets
  chapters: [
    {
      id: "ch1", order: 0, title: "The Problem",
      narrative: "## Overview\n\nSince 2015, deforestation in the western corridor has accelerated dramatically.",
      map_state: { center: [109.5, 1.2], zoom: 6, bearing: 0, pitch: 0, basemap: "streets" },
      transition: "fly-to"
    },
    {
      id: "ch2", order: 1, title: "What We Found",
      narrative: "## Key Findings\n\nOur analysis reveals a strong correlation between palm oil expansion and forest loss.",
      map_state: { center: [110.3, 0.8], zoom: 9, bearing: 15, pitch: 30, basemap: "satellite" },
      transition: "fly-to"
    },
    {
      id: "ch3", order: 2, title: "What's Next",
      narrative: "## Looking Forward\n\nConservation efforts need to focus on the remaining primary forest areas.",
      map_state: { center: [108.7, 1.5], zoom: 7, bearing: 0, pitch: 0, basemap: "dark" },
      transition: "fly-to"
    }
  ],
  created_at: new Date().toISOString(),
  published: true
};
localStorage.setItem("story:test-story-1", JSON.stringify(story));
localStorage.setItem("story:index", JSON.stringify([{
  id: story.id, title: story.title, dataset_id: story.dataset_id, created_at: story.created_at
}]));
```

First fetch an actual dataset ID from `/api/datasets` and substitute it into the script.

- [ ] **Step 3: Verify the reader renders**

Navigate to `http://localhost:5185/story/test-story-1`. Verify:
- Story title appears in header
- Chapter cards render with markdown content
- Map renders with the dataset's tiles
- Scrolling triggers fly-to transitions between chapters
- Basemap changes per chapter
- Active chapter card is highlighted, others are dimmed

- [ ] **Step 4: Take screenshots**

Save to `/tmp/story-reader-*.png` for review.

- [ ] **Step 5: Fix any issues found and commit**

```bash
git add frontend/src/
git commit -m "fix: address story reader issues from visual verification"
```

---

## Task 8: Build the story editor page (Phase 3)

**Files:**
- Create: `frontend/src/components/ChapterList.tsx`
- Create: `frontend/src/components/NarrativeEditor.tsx`
- Create: `frontend/src/pages/StoryEditorPage.tsx`
- Modify: `frontend/src/App.tsx` (replace placeholder)

This is the largest task. Build the three sub-components first, then compose them in StoryEditorPage.

- [ ] **Step 1: Create ChapterList component**

Create `frontend/src/components/ChapterList.tsx`:

```typescript
import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import type { Chapter } from "../lib/story";

interface ChapterListProps {
  chapters: Chapter[];
  activeChapterId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onReorder: (chapters: Chapter[]) => void;
}

export function ChapterList({
  chapters,
  activeChapterId,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
}: ChapterListProps) {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
    if (sourceIndex === targetIndex) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onReorder(reordered.map((ch, i) => ({ ...ch, order: i })));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  return (
    <Flex direction="column" h="100%">
      <Box px={3} py={3} borderBottom="1px solid" borderColor="gray.200">
        <Text
          fontSize="10px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="gray.500"
          fontWeight={600}
        >
          Chapters
        </Text>
      </Box>

      <Box flex={1} overflowY="auto" p={2}>
        {sorted.map((chapter, i) => (
          <Box
            key={chapter.id}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragOver={handleDragOver}
            bg={chapter.id === activeChapterId ? "blue.500" : "gray.50"}
            color={chapter.id === activeChapterId ? "white" : "gray.800"}
            borderRadius="6px"
            p={2}
            mb={1}
            cursor="pointer"
            onClick={() => onSelect(chapter.id)}
            _hover={{
              bg: chapter.id === activeChapterId ? "blue.500" : "gray.100",
            }}
          >
            <Text fontSize="12px" fontWeight={600} lineClamp={1}>
              {i + 1}. {chapter.title}
            </Text>
            <Flex justify="space-between" align="center" mt={1}>
              <Text fontSize="10px" opacity={0.7}>
                zoom {chapter.map_state.zoom.toFixed(0)} · {chapter.transition}
              </Text>
              {confirmDeleteId === chapter.id ? (
                <Flex gap={1}>
                  <Text
                    as="button"
                    fontSize="10px"
                    color={chapter.id === activeChapterId ? "white" : "red.500"}
                    fontWeight={600}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(chapter.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    Delete
                  </Text>
                  <Text
                    as="button"
                    fontSize="10px"
                    opacity={0.7}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(null);
                    }}
                  >
                    Cancel
                  </Text>
                </Flex>
              ) : (
                chapters.length > 1 && (
                  <Text
                    as="button"
                    fontSize="10px"
                    opacity={0.5}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(chapter.id);
                    }}
                  >
                    ×
                  </Text>
                )
              )}
            </Flex>
          </Box>
        ))}
      </Box>

      <Box p={2} borderTop="1px solid" borderColor="gray.200">
        <Box
          as="button"
          w="100%"
          border="1px dashed"
          borderColor="gray.300"
          borderRadius="6px"
          p={2}
          textAlign="center"
          color="gray.500"
          fontSize="12px"
          cursor="pointer"
          onClick={onAdd}
          _hover={{ borderColor: "blue.300", color: "blue.500" }}
        >
          + Add chapter
        </Box>
      </Box>
    </Flex>
  );
}
```

- [ ] **Step 2: Create NarrativeEditor component**

Create `frontend/src/components/NarrativeEditor.tsx`:

```typescript
import { Box, Flex, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

interface NarrativeEditorProps {
  title: string;
  narrative: string;
  onTitleChange: (title: string) => void;
  onNarrativeChange: (narrative: string) => void;
}

export function NarrativeEditor({
  title,
  narrative,
  onTitleChange,
  onNarrativeChange,
}: NarrativeEditorProps) {
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [roughNotes, setRoughNotes] = useState("");

  function generatePrompt() {
    const prompt = `Context:
- This is a chapter titled "${title}" in a scrollytelling map story.

My rough notes:
"${roughNotes}"

Task: Write 2-3 paragraphs of narrative text for this chapter of a scrollytelling story about geospatial data. Use clear, accessible language suitable for a non-technical audience. Write in the style of a scientific narrative, not marketing copy. Output as markdown.`;

    navigator.clipboard.writeText(prompt);
    setShowAiPrompt(false);
    setRoughNotes("");
  }

  return (
    <Flex direction="column" h="100%" p={3} gap={2}>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Chapter title"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          borderBottom: "1px solid #e2e8f0",
          padding: "4px 0",
          outline: "none",
          background: "transparent",
        }}
      />

      <Flex justify="space-between" align="center">
        <Text fontSize="10px" color="gray.500" fontWeight={600} letterSpacing="1px" textTransform="uppercase">
          Narrative
        </Text>
        <Text fontSize="10px" color="gray.400">
          Markdown supported
        </Text>
      </Flex>

      <Textarea
        flex={1}
        value={narrative}
        onChange={(e) => onNarrativeChange(e.target.value)}
        placeholder="Write your narrative here... (markdown supported)"
        fontFamily="mono"
        fontSize="13px"
        resize="none"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="6px"
        p={3}
        _focus={{ borderColor: "blue.300", boxShadow: "none" }}
      />

      {showAiPrompt ? (
        <Box border="1px solid" borderColor="gray.200" borderRadius="6px" p={3}>
          <Text fontSize="12px" color="gray.600" mb={2}>
            What's the story here? (rough notes)
          </Text>
          <Textarea
            value={roughNotes}
            onChange={(e) => setRoughNotes(e.target.value)}
            placeholder="deforestation got way worse after 2015, especially near palm oil plantations..."
            fontSize="12px"
            rows={3}
            resize="none"
            mb={2}
          />
          <Flex gap={2} justify="flex-end">
            <Text
              as="button"
              fontSize="11px"
              color="gray.500"
              onClick={() => setShowAiPrompt(false)}
              cursor="pointer"
            >
              Cancel
            </Text>
            <Text
              as="button"
              fontSize="11px"
              color="blue.500"
              fontWeight={600}
              onClick={generatePrompt}
              cursor="pointer"
            >
              Copy prompt to clipboard
            </Text>
          </Flex>
        </Box>
      ) : (
        <Text
          as="button"
          fontSize="11px"
          color="gray.500"
          cursor="pointer"
          textAlign="left"
          onClick={() => setShowAiPrompt(true)}
          _hover={{ color: "blue.500" }}
        >
          ✨ Draft with AI
        </Text>
      )}
    </Flex>
  );
}
```

- [ ] **Step 3: Create StoryEditorPage**

Create `frontend/src/pages/StoryEditorPage.tsx`:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Box, Button, Flex, Spinner, Text } from "@chakra-ui/react";
import { FlyToInterpolator } from "@deck.gl/core";
import { UnifiedMap } from "../components/UnifiedMap";
import { ChapterList } from "../components/ChapterList";
import { NarrativeEditor } from "../components/NarrativeEditor";
import {
  type CameraState,
  DEFAULT_CAMERA,
  cameraFromBounds,
  buildRasterTileLayers,
  buildVectorLayer,
} from "../lib/layers";
import {
  type Story,
  type Chapter,
  createStory,
  createChapter,
  getStory,
  saveStory,
} from "../lib/story";
import type { Dataset } from "../types";
import { config } from "../config";


export default function StoryEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const datasetIdParam = searchParams.get("dataset");

  const [story, setStory] = useState<Story | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>("");
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [basemap, setBasemap] = useState("streets");
  const [captureFlash, setCaptureFlash] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [transitionDuration, setTransitionDuration] = useState<number | undefined>(undefined);
  const flyToRef = useRef(new FlyToInterpolator());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load or create story
  useEffect(() => {
    if (id) {
      const loaded = getStory(id);
      if (!loaded) {
        setError("Story not found");
        setLoading(false);
        return;
      }
      setStory(loaded);
      setActiveChapterId(loaded.chapters[0]?.id ?? "");
    }
    // New story: wait for dataset to load, then create
  }, [id]);

  // Fetch dataset
  useEffect(() => {
    const dsId = story?.dataset_id ?? datasetIdParam;
    if (!dsId) {
      setError("No dataset specified");
      setLoading(false);
      return;
    }
    async function fetchDataset() {
      try {
        const resp = await fetch(`${config.apiBase}/api/datasets/${dsId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Dataset = await resp.json();
        setDataset(data);

        // Create new story if this is /story/new
        if (!id && datasetIdParam) {
          const newStory = createStory(datasetIdParam);
          if (data.bounds) {
            const cam = cameraFromBounds(data.bounds);
            newStory.chapters[0].map_state = {
              center: [cam.longitude, cam.latitude],
              zoom: cam.zoom,
              bearing: 0,
              pitch: 0,
              basemap: "streets",
            };
          }
          setStory(newStory);
          setActiveChapterId(newStory.chapters[0].id);
          saveStory(newStory);
          // Update URL to the edit route
          navigate(`/story/${newStory.id}/edit`, { replace: true });
        }

        // Set initial camera
        if (data.bounds) {
          setCamera(cameraFromBounds(data.bounds));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [story?.dataset_id, datasetIdParam, id, navigate]);

  // Debounced auto-save
  const debouncedSave = useCallback(
    (updated: Story) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveStory(updated);
      }, 500);
    },
    [],
  );

  // Update story helper
  function updateStory(updater: (s: Story) => Story) {
    setStory((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      debouncedSave(updated);
      return updated;
    });
  }

  const activeChapter = story?.chapters.find((c) => c.id === activeChapterId);

  // Select chapter: fly map to its saved state
  function selectChapter(chapterId: string) {
    setActiveChapterId(chapterId);
    const chapter = story?.chapters.find((c) => c.id === chapterId);
    if (chapter) {
      setBasemap(chapter.map_state.basemap);
      setTransitionDuration(1000);
      setCamera({
        longitude: chapter.map_state.center[0],
        latitude: chapter.map_state.center[1],
        zoom: chapter.map_state.zoom,
        bearing: chapter.map_state.bearing,
        pitch: chapter.map_state.pitch,
      });
    }
  }

  // Capture current view into active chapter
  function captureView() {
    if (!activeChapterId) return;
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId
          ? {
              ...ch,
              map_state: {
                center: [camera.longitude, camera.latitude] as [number, number],
                zoom: camera.zoom,
                bearing: camera.bearing,
                pitch: camera.pitch,
                basemap,
              },
            }
          : ch,
      ),
    }));
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 600);
  }

  // Add chapter
  function addChapter() {
    const maxOrder = Math.max(...(story?.chapters.map((c) => c.order) ?? [0]));
    const newCh = createChapter({
      order: maxOrder + 1,
      title: `Chapter ${(story?.chapters.length ?? 0) + 1}`,
      map_state: {
        center: [camera.longitude, camera.latitude],
        zoom: camera.zoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
        basemap,
      },
    });
    updateStory((s) => ({ ...s, chapters: [...s.chapters, newCh] }));
    setActiveChapterId(newCh.id);
  }

  // Delete chapter
  function deleteChapter(chapterId: string) {
    updateStory((s) => {
      const remaining = s.chapters.filter((c) => c.id !== chapterId);
      return { ...s, chapters: remaining.map((ch, i) => ({ ...ch, order: i })) };
    });
    if (activeChapterId === chapterId) {
      const remaining = story?.chapters.filter((c) => c.id !== chapterId);
      setActiveChapterId(remaining?.[0]?.id ?? "");
    }
  }

  // Reorder chapters
  function reorderChapters(reordered: Chapter[]) {
    updateStory((s) => ({ ...s, chapters: reordered }));
  }

  // Update active chapter fields
  function updateChapterTitle(title: string) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, title } : ch,
      ),
    }));
  }

  function updateChapterNarrative(narrative: string) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, narrative } : ch,
      ),
    }));
  }

  // Publish
  function handlePublish() {
    if (!story) return;
    updateStory((s) => ({ ...s, published: true }));
    saveStory({ ...story, published: true });
    const url = `${window.location.origin}/story/${story.id}`;
    navigator.clipboard.writeText(url);
    setPublishFeedback("Published! URL copied to clipboard.");
    setTimeout(() => setPublishFeedback(null), 3000);
  }

  // Build layers
  const layers = useMemo(() => {
    if (!dataset) return [];
    if (dataset.dataset_type === "raster") {
      return buildRasterTileLayers({
        tileUrl: dataset.tile_url,
        opacity: 0.8,
        isTemporalActive: false,
      });
    }
    return [
      buildVectorLayer({
        tileUrl: dataset.tile_url,
        isPMTiles: dataset.tile_url.startsWith("/pmtiles/"),
        opacity: 1,
        minZoom: dataset.min_zoom ?? undefined,
        maxZoom: dataset.max_zoom ?? undefined,
      }),
    ];
  }, [dataset]);

  // --- Loading / error ---
  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center">
        <Spinner size="lg" color="brand.orange" />
      </Flex>
    );
  }
  if (error || !story) {
    return (
      <Flex h="100vh" direction="column" align="center" justify="center" gap={3}>
        <Text color="red.500">{error ?? "Story not found"}</Text>
      </Flex>
    );
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {/* Bottom bar */}
      <Flex
        h="48px"
        px={4}
        align="center"
        borderBottom="1px solid"
        borderColor="gray.200"
        bg="white"
        flexShrink={0}
        justify="space-between"
      >
        <input
          type="text"
          value={story.title}
          onChange={(e) => updateStory((s) => ({ ...s, title: e.target.value }))}
          style={{
            fontSize: "14px",
            fontWeight: 600,
            border: "none",
            outline: "none",
            background: "transparent",
            width: "300px",
          }}
          placeholder="Story title"
        />
        <Flex gap={2}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/story/${story.id}`, "_blank")}
          >
            Preview
          </Button>
          <Button
            size="sm"
            bg="blue.500"
            color="white"
            onClick={handlePublish}
            _hover={{ bg: "blue.600" }}
          >
            Publish
          </Button>
          {publishFeedback && (
            <Text fontSize="xs" color="green.600" fontWeight={500}>
              {publishFeedback}
            </Text>
          )}
        </Flex>
      </Flex>

      {/* Three-panel layout */}
      <Flex flex={1} overflow="hidden">
        {/* Left: chapter list */}
        <Box
          w="220px"
          flexShrink={0}
          borderRight="1px solid"
          borderColor="gray.200"
          bg="white"
        >
          <ChapterList
            chapters={story.chapters}
            activeChapterId={activeChapterId}
            onSelect={selectChapter}
            onAdd={addChapter}
            onDelete={deleteChapter}
            onReorder={reorderChapters}
          />
        </Box>

        {/* Right: map + editor stacked */}
        <Flex flex={1} direction="column" overflow="hidden">
          {/* Map (top) */}
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
              {/* Capture button */}
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

          {/* Editor (bottom) */}
          <Box
            flex={4}
            borderTop="1px solid"
            borderColor="gray.200"
            bg="white"
          >
            {activeChapter ? (
              <NarrativeEditor
                title={activeChapter.title}
                narrative={activeChapter.narrative}
                onTitleChange={updateChapterTitle}
                onNarrativeChange={updateChapterNarrative}
              />
            ) : (
              <Flex h="100%" align="center" justify="center">
                <Text color="gray.400">Select a chapter to edit</Text>
              </Flex>
            )}
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 4: Replace placeholder routes in App.tsx**

Update `frontend/src/App.tsx` to import the real `StoryEditorPage`:

```typescript
import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import MapPage from "./pages/MapPage";
import ExpiredPage from "./pages/ExpiredPage";
import StoryReaderPage from "./pages/StoryReaderPage";
import StoryEditorPage from "./pages/StoryEditorPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/map/:id" element={<MapPage />} />
      <Route path="/expired/:id" element={<ExpiredPage />} />
      <Route path="/story/new" element={<StoryEditorPage />} />
      <Route path="/story/:id" element={<StoryReaderPage />} />
      <Route path="/story/:id/edit" element={<StoryEditorPage />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ChapterList.tsx frontend/src/components/NarrativeEditor.tsx frontend/src/pages/StoryEditorPage.tsx frontend/src/App.tsx
git commit -m "feat: add story editor with chapter list, map capture, and narrative editing"
```

---

## Task 9: Visual verification of story editor

**Files:** None (manual testing)

- [ ] **Step 1: Navigate to the editor**

Use Playwright MCP. Navigate to `http://localhost:5185/map/<DATASET_ID>` first to find a valid dataset, then navigate to `http://localhost:5185/story/new?dataset=<DATASET_ID>`.

- [ ] **Step 2: Verify editor functionality**

Check:
- Three-panel layout renders (chapter list, map, narrative editor)
- Map is interactive (pan, zoom, bearing, pitch)
- "Capture this view" button works (shows flash feedback)
- Chapter list shows chapters, click to select works
- Adding a new chapter works (gets current map position)
- Deleting a chapter shows confirmation, then removes
- Narrative textarea accepts markdown input
- Story title is editable in header
- "Draft with AI" opens notes input, "Copy prompt" copies to clipboard
- "Preview" opens reader in new tab
- "Publish" shows toast and copies URL

- [ ] **Step 3: Verify the full create → preview loop**

1. Create a story with 3 chapters at different map positions
2. Write narrative text in each
3. Click Preview — verify reader opens with correct chapters and transitions
4. Click Publish — verify toast appears

- [ ] **Step 4: Take screenshots**

Save to `/tmp/story-editor-*.png` for review.

- [ ] **Step 5: Fix any issues found and commit**

```bash
git add frontend/src/
git commit -m "fix: address story editor issues from visual verification"
```

---

## Task 10: Wire CTA in CreditsPanel (Phase 4)

**Files:**
- Modify: `frontend/src/components/CreditsPanel.tsx:156-167`

- [ ] **Step 1: Update the "Turn this into a story" link**

In `frontend/src/components/CreditsPanel.tsx`, change the "Turn this into a story" link from an external URL to an internal navigation link. Replace lines 156-167:

Current code:
```typescript
<Link
  display="block"
  color="brand.orange"
  fontSize="13px"
  fontWeight={600}
  mb={2}
  href="https://developmentseed.org/contact"
  target="_blank"
  rel="noopener noreferrer"
>
  Turn this into a story →
</Link>
```

Replace with (using React Router's `Link` for client-side navigation):

First, add the import at the top of the file:
```typescript
import { Link as RouterLink } from "react-router-dom";
```

Then replace the link:
```typescript
<RouterLink to={`/story/new?dataset=${dataset.id}`}>
  <Text
    display="block"
    color="brand.orange"
    fontSize="13px"
    fontWeight={600}
    mb={2}
  >
    Turn this into a story →
  </Text>
</RouterLink>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Verify in browser**

Navigate to a dataset's map page. In the CreditsPanel, click "Turn this into a story →". Verify it navigates to `/story/new?dataset={id}` and the editor loads.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/CreditsPanel.tsx
git commit -m "feat: wire CreditsPanel story CTA to internal editor route"
```

---

## Task 11: Run all tests and final verification

**Files:** None

- [ ] **Step 1: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass (existing layer tests + new storage tests)

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Full E2E walkthrough**

Using Playwright MCP:
1. Navigate to `http://localhost:5185`
2. Upload a GeoTIFF (or use existing dataset)
3. On the map page, click "Turn this into a story →"
4. In the editor: create 3 chapters, navigate map, capture views, write text
5. Click Preview — verify scrollytelling reader works
6. Click Publish — verify toast
7. Navigate directly to the story URL — verify reader loads
8. Take screenshots of each step to `/tmp/story-final-*.png`

- [ ] **Step 4: Fix any remaining issues**

```bash
git add frontend/src/
git commit -m "fix: final polish from E2E testing"
```
