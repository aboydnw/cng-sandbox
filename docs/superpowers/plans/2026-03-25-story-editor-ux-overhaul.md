# Story Editor UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the story editor intuitive for first-time, non-technical users by fixing terminology, improving feedback, and guiding the authoring workflow.

**Architecture:** All changes are frontend-only (React components in `frontend/src/`). No backend changes needed. The work is organized into 6 phases, each delivering independently testable improvements. Phases are ordered so earlier ones unblock later ones where dependencies exist.

**Tech Stack:** React 19, Chakra UI v3, TypeScript, Vitest + React Testing Library, Phosphor Icons

---

## Phase 1: Core Interaction Fixes

Fixes the most broken fundamentals — save feedback, title affordance, and the "capture view" model.

---

### Task 1.1: Save Status Indicator

Add a persistent save status in the header that shows "Saving...", "Saved", or "Save failed".

**Files:**
- Create: `frontend/src/components/SaveStatus.tsx`
- Create: `frontend/src/hooks/useSaveStatus.ts`
- Modify: `frontend/src/pages/StoryEditorPage.tsx:183-202` (wire save status into debouncedSave)

- [ ] **Step 1: Create the `useSaveStatus` hook**

```typescript
// frontend/src/hooks/useSaveStatus.ts
import { useCallback, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useSaveStatus() {
  const [state, setState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaving = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("saving");
  }, []);

  const markSaved = useCallback(() => {
    setState("saved");
    timerRef.current = setTimeout(() => setState("idle"), 3000);
  }, []);

  const markError = useCallback(() => {
    setState("error");
  }, []);

  return { saveState: state, markSaving, markSaved, markError };
}
```

- [ ] **Step 2: Create the `SaveStatus` component**

```tsx
// frontend/src/components/SaveStatus.tsx
import { Flex, Text } from "@chakra-ui/react";
import { Check, SpinnerGap, Warning } from "@phosphor-icons/react";
import type { SaveState } from "../hooks/useSaveStatus";

const STATUS_MAP: Record<SaveState, { label: string; color: string; icon: React.ReactNode } | null> = {
  idle: null,
  saving: { label: "Saving...", color: "gray.500", icon: <SpinnerGap size={12} style={{ animation: "spin 1s linear infinite" }} /> },
  saved: { label: "Saved", color: "green.600", icon: <Check size={12} /> },
  error: { label: "Save failed", color: "red.500", icon: <Warning size={12} /> },
};

export function SaveStatus({ state }: { state: SaveState }) {
  const info = STATUS_MAP[state];
  if (!info) return null;
  return (
    <Flex align="center" gap={1}>
      {info.icon}
      <Text fontSize="xs" color={info.color} fontWeight={500}>{info.label}</Text>
    </Flex>
  );
}
```

- [ ] **Step 3: Wire into `StoryEditorPage`**

In `StoryEditorPage.tsx`, replace the silent `debouncedSave` with one that calls `markSaving`/`markSaved`/`markError`. Add `<SaveStatus>` next to the title input in the header.

- [ ] **Step 4: Test manually — create/edit a story, verify save states appear**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useSaveStatus.ts frontend/src/components/SaveStatus.tsx frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: add save status indicator to story editor"
```

---

### Task 1.2: Story Title Affordance

Make the title input visually signal that it's editable.

**Files:**
- Modify: `frontend/src/pages/StoryEditorPage.tsx:390-403`

- [ ] **Step 1: Replace the invisible `<input>` with a styled Chakra Input**

Replace the raw `<input>` with a styled element that has:
- A subtle bottom border on hover
- A pencil (PencilSimple) icon that appears on hover
- Placeholder "Click to name your story" instead of "Story title"
- Slightly larger font than surrounding text

- [ ] **Step 2: Test manually — hover over title, verify affordance appears**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: make story title visually editable with hover affordance"
```

---

### Task 1.3: Auto-Save Map View (Replace "Capture this view")

Flip the mental model: map view auto-saves when the user stops panning. Keep a "Reset view" button to snap back to the last saved state.

**Files:**
- Modify: `frontend/src/pages/StoryEditorPage.tsx:226-248` (replace captureView with auto-capture)
- Modify: `frontend/src/pages/StoryEditorPage.tsx:456-481` (replace Capture button with Reset button)

- [ ] **Step 1: Add auto-capture on camera settle**

Add a `useEffect` with a debounce (800ms after last camera change) that auto-saves the current camera + basemap to the active chapter's `map_state`. Store the "last saved" state so we can offer a reset.

```typescript
// After camera stops moving for 800ms, auto-save to active chapter
const autoCaptureRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function handleCameraChange(c: CameraState) {
  setCamera(c);
  setTransitionDuration(undefined);

  // Auto-capture after settle
  if (autoCaptureRef.current) clearTimeout(autoCaptureRef.current);
  autoCaptureRef.current = setTimeout(() => {
    if (!activeChapterId) return;
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId
          ? {
              ...ch,
              map_state: {
                center: [c.longitude, c.latitude] as [number, number],
                zoom: c.zoom,
                bearing: c.bearing,
                pitch: c.pitch,
                basemap,
              },
            }
          : ch,
      ),
    }));
  }, 800);
}
```

- [ ] **Step 2: Replace the "Capture this view" button with a "Reset view" button**

Show a subtle "Reset view" button only when the current camera differs from the chapter's saved `map_state`. Show a small "View saved" confirmation text that appears briefly after auto-capture fires.

- [ ] **Step 3: Remove the `captureFlash` state and old `captureView()` function**

- [ ] **Step 4: Test manually — pan the map, switch chapters, verify auto-save and reset**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: auto-save map view on camera settle, replace Capture with Reset"
```

---

## Phase 2: Terminology & Chapter Type Picker

Rename jargon and add visual chapter type selection.

---

### Task 2.1: Rename Chapter Types

Replace "scrollytelling" → "Guided tour", "prose" → "Text only", "map" → "Interactive map" in the UI. The data model keeps the original values — only display labels change.

**Files:**
- Create: `frontend/src/lib/story/labels.ts`
- Modify: `frontend/src/components/NarrativeEditor.tsx:56-64`
- Modify: `frontend/src/components/ChapterList.tsx:85-89`

- [ ] **Step 1: Create a label mapping file**

```typescript
// frontend/src/lib/story/labels.ts
import type { ChapterType } from "./types";

export const CHAPTER_TYPE_LABELS: Record<ChapterType, string> = {
  scrollytelling: "Guided tour",
  prose: "Text only",
  map: "Interactive map",
};

export const CHAPTER_TYPE_DESCRIPTIONS: Record<ChapterType, string> = {
  scrollytelling: "Reader scrolls through map views with your narration alongside",
  prose: "A text-only section with no map",
  map: "Reader freely explores an interactive map",
};
```

- [ ] **Step 2: Update `NarrativeEditor` type selector to use new labels**

Replace the `<option>` text in the chapter type `<select>` with the human-readable labels from `CHAPTER_TYPE_LABELS`.

- [ ] **Step 3: Update `ChapterList` chapter card metadata to use new labels**

Replace the raw `chapter.type` display with the human-readable label. Remove "zoom X" and "fly-to" metadata — replace with first ~40 chars of narrative text as a preview, or the dataset name if no narrative.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/story/labels.ts frontend/src/components/NarrativeEditor.tsx frontend/src/components/ChapterList.tsx
git commit -m "feat: rename chapter types to plain language labels"
```

---

### Task 2.2: Visual Chapter Type Picker

Replace the type `<select>` dropdown with a 3-card visual picker.

**Files:**
- Create: `frontend/src/components/ChapterTypePicker.tsx`
- Modify: `frontend/src/components/NarrativeEditor.tsx:54-65`

- [ ] **Step 1: Create `ChapterTypePicker` component**

Three clickable cards in a row. Each card shows:
- A small SVG wireframe icon illustrating the layout (text+map side-by-side for guided tour, full-width text for text only, full-width map for interactive map)
- The human-readable label
- The one-line description
- Active card highlighted with blue border

```tsx
// frontend/src/components/ChapterTypePicker.tsx
import { Box, Flex, Text } from "@chakra-ui/react";
import type { ChapterType } from "../lib/story";
import { CHAPTER_TYPE_LABELS, CHAPTER_TYPE_DESCRIPTIONS } from "../lib/story/labels";

const TYPES: ChapterType[] = ["scrollytelling", "prose", "map"];

interface ChapterTypePickerProps {
  value: ChapterType;
  onChange: (type: ChapterType) => void;
}

export function ChapterTypePicker({ value, onChange }: ChapterTypePickerProps) {
  return (
    <Flex gap={2}>
      {TYPES.map((type) => (
        <Box
          key={type}
          flex={1}
          border="1px solid"
          borderColor={value === type ? "blue.400" : "gray.200"}
          bg={value === type ? "blue.50" : "white"}
          borderRadius="6px"
          p={2}
          cursor="pointer"
          onClick={() => onChange(type)}
          _hover={{ borderColor: value === type ? "blue.400" : "gray.300" }}
        >
          {/* Wireframe icon placeholder — small SVG showing layout */}
          <Box h="32px" bg="gray.100" borderRadius="4px" mb={1.5} />
          <Text fontSize="12px" fontWeight={600} color={value === type ? "blue.700" : "gray.700"}>
            {CHAPTER_TYPE_LABELS[type]}
          </Text>
          <Text fontSize="10px" color="gray.500" lineHeight="1.3">
            {CHAPTER_TYPE_DESCRIPTIONS[type]}
          </Text>
        </Box>
      ))}
    </Flex>
  );
}
```

- [ ] **Step 2: Replace the `<select>` in `NarrativeEditor` with `<ChapterTypePicker>`**

- [ ] **Step 3: Add inline SVG wireframe icons for each type**

Replace the gray placeholder boxes with small SVGs (~32px tall) that illustrate each layout:
- Guided tour: narrow text panel on left, map on right
- Text only: full-width text block
- Interactive map: full-width map with small caption below

- [ ] **Step 4: Test manually — switch types, verify visual picker works**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChapterTypePicker.tsx frontend/src/components/NarrativeEditor.tsx
git commit -m "feat: visual chapter type picker with wireframe icons"
```

---

## Phase 3: Editor Panel Redesign

Separate content from styling, improve the text editor and layer controls.

---

### Task 3.1: Content/Style Tabs

Split the NarrativeEditor into two tabs: "Content" (title, narrative) and "Style" (dataset, colormap, opacity).

**Files:**
- Modify: `frontend/src/components/NarrativeEditor.tsx`

- [ ] **Step 1: Add tab state and tab bar UI**

Add `const [activeTab, setActiveTab] = useState<"content" | "style">("content");` to `NarrativeEditor`. Render a two-button tab bar below the `ChapterTypePicker` (or type selector). Use simple styled `<Box as="button">` elements with a bottom-border highlight on the active tab. For prose chapters, only show the "Content" tab (no "Style" tab since prose has no layer config).

```tsx
<Flex gap={0} borderBottom="1px solid" borderColor="gray.200">
  <Box
    as="button"
    px={3} py={1.5}
    fontSize="12px"
    fontWeight={activeTab === "content" ? 600 : 400}
    color={activeTab === "content" ? "blue.600" : "gray.500"}
    borderBottom="2px solid"
    borderColor={activeTab === "content" ? "blue.500" : "transparent"}
    onClick={() => setActiveTab("content")}
  >
    Content
  </Box>
  {chapterType !== "prose" && (
    <Box
      as="button"
      px={3} py={1.5}
      fontSize="12px"
      fontWeight={activeTab === "style" ? 600 : 400}
      color={activeTab === "style" ? "blue.600" : "gray.500"}
      borderBottom="2px solid"
      borderColor={activeTab === "style" ? "blue.500" : "transparent"}
      onClick={() => setActiveTab("style")}
    >
      Style
    </Box>
  )}
</Flex>
```

- [ ] **Step 2: Move existing JSX into tab-conditional blocks**

Wrap the existing content in tab conditionals:
- **Content tab** (`activeTab === "content"`): Render the title `<input>` (line 67-81), the "NARRATIVE" label (lines 83-90), the `<Textarea>` (lines 92-105), and the AI prompt section (lines 165-213).
- **Style tab** (`activeTab === "style"`): Render the layer controls `<Flex>` (lines 107-163) — dataset selector, colormap `<select>`, and opacity `<input type="range">`.
- When switching chapter type to "prose", auto-reset `activeTab` to "content".

- [ ] **Step 3: Test manually — switch tabs, verify content persists, verify prose hides Style tab**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NarrativeEditor.tsx
git commit -m "feat: split editor into Content and Style tabs"
```

---

### Task 3.2: Markdown Formatting Toolbar

Add a minimal toolbar (bold, italic, heading, link) above the narrative textarea.

**Files:**
- Create: `frontend/src/components/MarkdownToolbar.tsx`
- Modify: `frontend/src/components/NarrativeEditor.tsx`

- [ ] **Step 1: Create `MarkdownToolbar` component**

A row of small icon buttons. Each button inserts/wraps markdown syntax at the cursor position in the textarea. Buttons: Bold (B), Italic (I), Heading (H), Link (chain icon).

```tsx
// frontend/src/components/MarkdownToolbar.tsx
import { Flex, IconButton } from "@chakra-ui/react";
import { TextB, TextItalic, TextH, Chain } from "@phosphor-icons/react";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (v: string) => void,
  prefix: string,
  suffix: string,
  placeholder: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end) || placeholder;
  const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
  onChange(newValue);
  // Restore cursor position after React re-render
  requestAnimationFrame(() => {
    textarea.focus();
    const newStart = start + prefix.length;
    textarea.setSelectionRange(newStart, newStart + selected.length);
  });
}

export function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  const actions = [
    { icon: <TextB size={16} weight="bold" />, label: "Bold", prefix: "**", suffix: "**", placeholder: "bold text" },
    { icon: <TextItalic size={16} />, label: "Italic", prefix: "*", suffix: "*", placeholder: "italic text" },
    { icon: <TextH size={16} weight="bold" />, label: "Heading", prefix: "## ", suffix: "", placeholder: "Heading" },
    { icon: <Chain size={16} />, label: "Link", prefix: "[", suffix: "](url)", placeholder: "link text" },
  ];

  return (
    <Flex gap={0.5} borderBottom="1px solid" borderColor="gray.200" pb={1} mb={1}>
      {actions.map((action) => (
        <IconButton
          key={action.label}
          aria-label={action.label}
          size="xs"
          variant="ghost"
          color="gray.500"
          _hover={{ color: "gray.800", bg: "gray.100" }}
          onClick={() => {
            if (!textareaRef.current) return;
            insertMarkdown(textareaRef.current, value, onChange, action.prefix, action.suffix, action.placeholder);
          }}
        >
          {action.icon}
        </IconButton>
      ))}
    </Flex>
  );
}
```

- [ ] **Step 2: Integrate into `NarrativeEditor`**

Add a `useRef<HTMLTextAreaElement>` and pass it to both the `<Textarea>` and `<MarkdownToolbar>`. Remove the "Markdown supported" hint text. Change the textarea `fontFamily` from `"mono"` to `"body"` (less intimidating).

- [ ] **Step 3: Test manually — select text, click Bold, verify markdown wrapping**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MarkdownToolbar.tsx frontend/src/components/NarrativeEditor.tsx
git commit -m "feat: add markdown formatting toolbar to narrative editor"
```

---

### Task 3.3: Colormap Swatches

Show color gradient previews next to colormap names.

**Files:**
- Create: `frontend/src/components/ColormapPicker.tsx`
- Modify: `frontend/src/components/NarrativeEditor.tsx`

- [ ] **Step 1: Create `ColormapPicker` component**

A custom dropdown replacement. Each option shows a small CSS gradient bar (80px wide) next to the colormap name. Use hardcoded CSS gradients that approximate each matplotlib colormap.

```tsx
// frontend/src/components/ColormapPicker.tsx
import { Box, Flex, Text } from "@chakra-ui/react";

const COLORMAP_GRADIENTS: Record<string, string> = {
  viridis: "linear-gradient(90deg, #440154, #31688e, #35b779, #fde725)",
  plasma: "linear-gradient(90deg, #0d0887, #7e03a8, #cc4778, #f89540, #f0f921)",
  inferno: "linear-gradient(90deg, #000004, #420a68, #932667, #dd513a, #fcffa4)",
  magma: "linear-gradient(90deg, #000004, #3b0f70, #8c2981, #de4968, #fcfdbf)",
  cividis: "linear-gradient(90deg, #00224e, #123570, #507aa2, #94a866, #fdea45)",
  terrain: "linear-gradient(90deg, #333399, #00b300, #ffe066, #8b4513, #ffffff)",
  blues: "linear-gradient(90deg, #f7fbff, #6baed6, #08306b)",
  reds: "linear-gradient(90deg, #fff5f0, #fb6a4a, #67000d)",
};

interface ColormapPickerProps {
  value: string;
  onChange: (colormap: string) => void;
}

export function ColormapPicker({ value, onChange }: ColormapPickerProps) {
  return (
    <Flex direction="column" gap={0.5}>
      {Object.entries(COLORMAP_GRADIENTS).map(([name, gradient]) => (
        <Flex
          key={name}
          align="center"
          gap={2}
          px={2}
          py={1}
          borderRadius="4px"
          cursor="pointer"
          bg={value === name ? "blue.50" : "transparent"}
          border="1px solid"
          borderColor={value === name ? "blue.300" : "transparent"}
          onClick={() => onChange(name)}
          _hover={{ bg: value === name ? "blue.50" : "gray.50" }}
        >
          <Box w="60px" h="12px" borderRadius="2px" bg={gradient} flexShrink={0} />
          <Text fontSize="12px" color="gray.700">{name}</Text>
        </Flex>
      ))}
    </Flex>
  );
}
```

- [ ] **Step 2: Replace the colormap `<select>` in `NarrativeEditor` Style tab with `<ColormapPicker>`**

Use a Popover or inline list to show the swatches. The simplest approach: show the active colormap as a gradient bar + name, clicking it opens a dropdown with all options.

- [ ] **Step 3: Test manually — verify swatches display, selection updates map**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ColormapPicker.tsx frontend/src/components/NarrativeEditor.tsx
git commit -m "feat: colormap picker with gradient swatches"
```

---

### Task 3.4: Basemap Visual Picker

Replace the basemap dropdown with thumbnail swatches, rename to "Background map".

**Files:**
- Modify: `frontend/src/components/MapShell.tsx` (replace `BasemapPicker` component)

- [ ] **Step 1: Replace `BasemapPicker` in `MapShell.tsx` with visual thumbnail buttons**

Replace the `NativeSelect`-based `BasemapPicker` (lines 18-34 of `MapShell.tsx`) with a row of three small square buttons (~36x36px). Each button has a colored background swatch and a label. Active button gets a blue border ring. The component keeps the same `BasemapPickerProps` interface so `UnifiedMap.tsx` (which imports and renders it at line 93) needs no changes.

```tsx
const BASEMAP_OPTIONS = [
  { key: "streets", label: "Light", bg: "#e8e8e8" },
  { key: "satellite", label: "Color", bg: "#a8c8e8" },
  { key: "dark", label: "Dark", bg: "#2d2d2d", color: "white" },
];

export function BasemapPicker({ value, onChange }: BasemapPickerProps) {
  return (
    <Flex gap={1}>
      {BASEMAP_OPTIONS.map((opt) => (
        <Box
          key={opt.key}
          as="button"
          w="36px" h="36px"
          borderRadius="4px"
          bg={opt.bg}
          border="2px solid"
          borderColor={value === opt.key ? "blue.500" : "transparent"}
          onClick={() => onChange(opt.key)}
          title={opt.label}
        />
      ))}
    </Flex>
  );
}
```

- [ ] **Step 2: Test manually — verify basemap switches work, UnifiedMap renders correctly**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MapShell.tsx
git commit -m "feat: visual basemap picker with thumbnails"
```

---

## Phase 4: Publishing & Preview

Build confidence in what will be published.

---

### Task 4.1: Publish Confirmation Dialog

Add a confirmation step before publishing with a summary of the story.

**Files:**
- Create: `frontend/src/components/PublishDialog.tsx`
- Modify: `frontend/src/pages/StoryEditorPage.tsx:325-339`

- [ ] **Step 1: Create `PublishDialog` component**

A modal/dialog that shows:
- Story title
- Number of chapters
- List of chapters with completion status (has narrative? has map view?)
- Warning if any chapters are incomplete
- "Publish" (blue) and "Cancel" buttons
- After publishing: shows the shareable URL in a copyable input field with a "Copy" button

- [ ] **Step 2: Wire into `StoryEditorPage`**

Replace the direct `handlePublish()` call on the Publish button with opening the dialog. Move publish logic into the dialog's confirm handler.

- [ ] **Step 3: Add published state indicator**

After publishing, change the Publish button to "Published" (green) with a dot indicator. Add an "Unpublish" option (small text link next to the button). Wire unpublish to set `published: false` and save.

- [ ] **Step 4: Show persistent shareable URL after publishing**

After first publish, show the URL in a small bar below the header (or as a tooltip on the Published button).

- [ ] **Step 5: Test manually — publish, verify dialog, verify URL, verify unpublish**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PublishDialog.tsx frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: publish confirmation dialog with story summary"
```

---

### Task 4.2a: Extract Reader Rendering Logic

Extract the chapter-rendering logic from `StoryReaderPage.tsx` so it can be reused by both the reader and the editor preview.

**Files:**
- Create: `frontend/src/components/StoryRenderer.tsx`
- Modify: `frontend/src/pages/StoryReaderPage.tsx`

- [ ] **Step 1: Extract `groupChaptersIntoBlocks` and `buildLayersForChapter`**

Move the `groupChaptersIntoBlocks` function (lines 30-52 of `StoryReaderPage.tsx`) and `buildLayersForChapter` (lines 54-81) into a new file `frontend/src/lib/story/rendering.ts`. Update `StoryReaderPage.tsx` to import from the new location.

- [ ] **Step 2: Create `StoryRenderer` component**

Extract the content-blocks rendering loop from `StoryReaderPage.tsx` (lines 379-411) into a standalone `StoryRenderer` component. Props: `story: Story`, `datasetMap: Map<string, Dataset | null>`, `onChapterClick?: (chapterId: string) => void`. The `onChapterClick` callback wraps each chapter block in a clickable container.

Note: The `ScrollytellingBlock` is a local component defined inside `StoryReaderPage.tsx` (lines 83-258). It must also be extracted to `StoryRenderer.tsx` for reuse.

- [ ] **Step 3: Verify `StoryReaderPage` works with the extracted component**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/story/rendering.ts frontend/src/components/StoryRenderer.tsx frontend/src/pages/StoryReaderPage.tsx
git commit -m "refactor: extract story rendering logic for reuse"
```

---

### Task 4.2b: Inline Editor Preview

Add a "Preview" toggle that shows the reader experience within the editor using the extracted `StoryRenderer`.

**Files:**
- Create: `frontend/src/components/EditorPreview.tsx`
- Modify: `frontend/src/pages/StoryEditorPage.tsx`

- [ ] **Step 1: Create `EditorPreview` component**

A wrapper around `StoryRenderer` that adds:
- A banner at the top: "Preview — click any chapter to edit it"
- A floating "Exit Preview" button (top-right)
- Passes `onChapterClick` to exit preview and select the clicked chapter

```tsx
interface EditorPreviewProps {
  story: Story;
  datasetMap: Map<string, Dataset | null>;
  onChapterClick: (chapterId: string) => void;
  onExit: () => void;
}
```

- [ ] **Step 2: Add preview toggle state to `StoryEditorPage`**

Add `const [previewMode, setPreviewMode] = useState(false);`. When `previewMode` is true, replace the 3-panel editor layout (the `<Flex flex={1}>` at lines 431-514) with `<EditorPreview>`. Wire `onChapterClick` to set the active chapter and exit preview.

- [ ] **Step 3: Update the Preview button in the header**

Change the existing "Preview" button (line 407-410) to toggle `previewMode` instead of opening a new tab. Add a small "Open in new tab" link next to it as a secondary option.

- [ ] **Step 4: Test manually — toggle preview, scroll through story, click chapter to edit**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EditorPreview.tsx frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: inline reader preview toggle in story editor"
```

---

## Phase 5: Chapter List & Sidebar Improvements

Polish the chapter list with better affordances.

---

### Task 5.1: Chapter Card Redesign

Replace technical metadata with meaningful previews.

**Files:**
- Modify: `frontend/src/components/ChapterList.tsx`

- [ ] **Step 1: Replace "zoom X · fly-to" metadata**

Show instead:
- Chapter type as a small icon + label (using labels from Task 2.1)
- First ~40 characters of the narrative text (truncated) as a preview, or "No narrative yet" in gray italic if empty

- [ ] **Step 2: Add a drag handle icon**

Add a `DotsSixVertical` icon (from Phosphor) on the left side of each chapter card to indicate draggability.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChapterList.tsx
git commit -m "feat: chapter cards with narrative preview and drag handles"
```

---

### Task 5.2: Arrow Button Reordering

Add up/down arrow buttons as an alternative to drag-and-drop.

**Files:**
- Modify: `frontend/src/components/ChapterList.tsx`

- [ ] **Step 1: Add CaretUp/CaretDown buttons on each chapter card**

Show on hover or always visible for the active chapter. Up button disabled on first chapter, down disabled on last.

- [ ] **Step 2: Wire arrow buttons to reorder logic**

```typescript
function moveChapter(index: number, direction: "up" | "down") {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const reordered = [...sorted];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  onReorder(reordered.map((ch, i) => ({ ...ch, order: i })));
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChapterList.tsx
git commit -m "feat: add arrow buttons for chapter reordering"
```

---

### Task 5.3: Improved Delete Confirmation

Replace tiny text buttons with a proper confirmation.

**Files:**
- Modify: `frontend/src/components/ChapterList.tsx`

- [ ] **Step 1: Replace inline delete confirmation with a popover**

When the X is clicked, show a small popover with:
- "Delete this chapter?" text
- Red "Delete" button (proper Button, not text)
- Gray "Cancel" button
- Larger hit targets (at least 28px height)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ChapterList.tsx
git commit -m "feat: improved delete confirmation with larger targets"
```

---

## Phase 6: Onboarding & AI

Guide first-time users and fix the AI integration.

---

### Task 6.1a: Wizard Shell and Step 1 (Title)

Create the wizard framework and the first step.

**Files:**
- Create: `frontend/src/components/StoryWizard.tsx`

- [ ] **Step 1: Create `StoryWizard` component with step navigation**

A centered card overlay (max-width 600px, centered vertically and horizontally with a semi-transparent backdrop). Manages `step` state (1, 2, or 3). Has Back/Next buttons at the bottom. Props:

```tsx
interface StoryWizardProps {
  datasets: Dataset[];
  onComplete: (title: string, datasetId: string, camera: CameraState, basemap: string) => void;
  onCancel: () => void;
}
```

- [ ] **Step 2: Implement Step 1 — "What's your story about?"**

A title input (large, centered) with placeholder "My data story..." and an optional description textarea. "Next" button is disabled until title is non-empty. A step indicator (1/3, 2/3, 3/3) shows progress at the top.

- [ ] **Step 3: Test manually — render wizard, type title, verify Next enables**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StoryWizard.tsx
git commit -m "feat: story wizard shell with title step"
```

---

### Task 6.1b: Wizard Step 2 (Dataset Picker)

Add the dataset selection step to the wizard.

**Files:**
- Modify: `frontend/src/components/StoryWizard.tsx`

- [ ] **Step 1: Implement Step 2 — "Pick a dataset"**

A grid of dataset cards (2-3 columns). Each card shows: filename, dataset type icon (raster = grid icon, vector = polygon icon), and upload date. Include an "Upload new" card (dashed border, plus icon) that opens the existing `UploadModal`. "Next" is disabled until a dataset is selected.

- [ ] **Step 2: Test manually — verify dataset grid renders, selection highlights, upload opens modal**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StoryWizard.tsx
git commit -m "feat: wizard dataset picker step"
```

---

### Task 6.1c: Wizard Step 3 (Map Framing) and Integration

Add the map framing step and wire the wizard into StoryEditorPage.

**Files:**
- Modify: `frontend/src/components/StoryWizard.tsx`
- Modify: `frontend/src/pages/StoryEditorPage.tsx`

- [ ] **Step 1: Implement Step 3 — "Frame your starting view"**

Show the `UnifiedMap` component with the selected dataset's layers. Auto-zoom to dataset bounds if available. A "Looks good" button confirms and calls `onComplete` with the wizard state (title, datasetId, camera, basemap).

- [ ] **Step 2: Wire wizard into `StoryEditorPage`**

Add `const [showWizard, setShowWizard] = useState(false);`. Show the wizard when navigating to `/story/new` without a `?dataset=` query param (i.e., when `!id && !datasetIdParam`). On wizard complete, create the story using `createStory` + `createStoryOnServer` with the wizard's output, then navigate to the edit URL. Skip the wizard entirely when `?dataset=<id>` is present (existing seeded behavior).

- [ ] **Step 3: Test manually — visit /story/new, complete all 3 wizard steps, verify story creation**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StoryWizard.tsx frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: complete first-run wizard with map framing step"
```

---

### Task 6.2: Contextual Tooltips

Add first-use tooltips for key UI elements.

**Dependency:** The map tooltip text references auto-save (Task 1.3). Implement Phase 1 before this task.

**Files:**
- Create: `frontend/src/hooks/useTooltipDismiss.ts`
- Modify: `frontend/src/components/ChapterList.tsx`
- Modify: `frontend/src/components/NarrativeEditor.tsx`
- Modify: `frontend/src/pages/StoryEditorPage.tsx`

- [ ] **Step 1: Create `useTooltipDismiss` hook**

Manages which tooltips have been dismissed. Uses `localStorage` key `story-editor-tooltips-seen`. Returns `{ shouldShow(key: string): boolean, dismiss(key: string): void }`.

- [ ] **Step 2: Add tooltips to key elements**

Three tooltips, shown one at a time (only the first unseen tooltip shows):

1. **Chapter list**: "Each chapter is a section of your story. Readers see them in this order." — anchored to CHAPTERS header.
2. **Map area**: "Navigate the map to frame your view. It saves automatically as you go." — anchored to map.
3. **Narrative textarea**: "Write what readers will see alongside the map. Use the toolbar for formatting." — anchored to textarea.

Implement as small floating cards with a dismiss X button, positioned relative to their anchor.

- [ ] **Step 3: Test manually — load editor, verify tooltips show sequentially, dismiss persists across reload**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useTooltipDismiss.ts frontend/src/components/ChapterList.tsx frontend/src/components/NarrativeEditor.tsx frontend/src/pages/StoryEditorPage.tsx
git commit -m "feat: contextual first-use tooltips for story editor"
```

---

### Task 6.3: Fix "Draft with AI"

Either integrate a real LLM call or honestly rename the feature.

**Files:**
- Modify: `frontend/src/components/NarrativeEditor.tsx:165-213`

- [ ] **Step 1: Rename and clarify the feature**

Change "Draft with AI" to "Get a writing prompt". Update the expanded state to clearly explain: "We'll create a prompt you can paste into ChatGPT, Claude, or any AI assistant." Change the action button from "Copy prompt to clipboard" to "Copy to clipboard" with a checkmark confirmation.

- [ ] **Step 2: Improve the generated prompt**

Include more context in the prompt: dataset name (if available), map location description (approximate center coordinates + zoom level), chapter number in story. This makes the copied prompt more useful.

- [ ] **Step 3: Add a "Paste result here" affordance**

After copying, show a brief helper: "Paste the AI's response into the narrative field above" with an arrow pointing up.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NarrativeEditor.tsx
git commit -m "feat: rename Draft with AI to Get a writing prompt, improve prompt quality"
```

---

## Phase Summary

| Phase | Tasks | Key Deliverable |
|-------|-------|----------------|
| 1 | 1.1–1.3 | Save indicator, title affordance, auto-save views |
| 2 | 2.1–2.2 | Plain language labels, visual type picker |
| 3 | 3.1–3.4 | Content/Style tabs, markdown toolbar, colormap swatches, basemap picker |
| 4 | 4.1, 4.2a, 4.2b | Publish dialog, extract renderer, inline preview |
| 5 | 5.1–5.3 | Chapter card redesign, arrow reorder, delete UX |
| 6 | 6.1a–c, 6.2, 6.3 | Onboarding wizard (3 tasks), tooltips, AI prompt fix |

**Total: 19 tasks across 6 phases.** Each phase can be deployed independently. Phase 1 is highest priority — ship it first and iterate.
