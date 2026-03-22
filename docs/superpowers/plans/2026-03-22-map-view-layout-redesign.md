# Map View Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the map view page layout — simplify the header, replace the tabbed right panel with a pinned top section (conversion stats, story CTA, inline upload) + contextual bottom (visualization controls), and rework the bottom "report card" panel into a horizontal tech deep-dive.

**Architecture:** The right panel (`CreditsPanel.tsx`) is replaced by a new `SidePanel.tsx` with two modes: "dataset" (normal view) and "upload" (inline upload flow). The `activeTab` state machine is replaced by a `renderMode` state that decouples map layer rendering from panel UI. The `ReportCard.tsx` is simplified from 4 stat cards to a horizontal row of tech description cards.

**Tech Stack:** React 19, Chakra UI v3, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-map-view-layout-redesign-design.md`

---

## File Structure

### New Files
- `frontend/src/components/SidePanel.tsx` — replaces CreditsPanel, manages dataset/upload modes
- `frontend/src/components/ConversionSummaryCard.tsx` — file size, data fetched, mini pipeline, details link
- `frontend/src/components/StoryCTABanner.tsx` — prominent story creation card
- `frontend/src/components/InlineUpload.tsx` — upload flow wrapper for the side panel
- `frontend/src/components/TechCard.tsx` — reusable card for deep dive panel
- `frontend/src/components/RasterSidebarControls.tsx` — raster controls adapted for sidebar layout
- `frontend/src/lib/techDescriptions.ts` — static tool descriptions keyed by tool name

### Modified Files
- `frontend/src/pages/MapPage.tsx` — header simplification, replace CreditsPanel with SidePanel, replace `activeTab` with `renderMode`, lift `useTileTransferSize` to page level
- `frontend/src/components/ReportCard.tsx` — remove stat cards, replace with horizontal TechCard row
- `frontend/src/lib/story/types.ts` — update `createStory` to accept chapter overrides for story CTA

### Unchanged Files
- `frontend/src/components/Header.tsx` — already renders children, no changes needed
- `frontend/src/components/ExploreTab.tsx` — same component, just rendered without tab wrapper
- `frontend/src/components/UnifiedMap.tsx` — no changes (receives layers from MapPage)
- `frontend/src/components/ShareButton.tsx` — stays in header as-is
- `frontend/src/components/BugReportLink.tsx` — stays in header as-is

---

### Task 1: Create tech descriptions data file

**Files:**
- Create: `frontend/src/lib/techDescriptions.ts`

- [ ] **Step 1: Create the tech descriptions mapping**

```typescript
// frontend/src/lib/techDescriptions.ts

interface TechDescription {
  role: string;
  name: string;
  description: string;
  url: string;
}

const TECH_DESCRIPTIONS: Record<string, TechDescription> = {
  "rio-cogeo": {
    role: "Converted",
    name: "rio-cogeo",
    description:
      "Reorganized your GeoTIFF into a Cloud Optimized GeoTIFF (COG) — a format designed for efficient HTTP range requests. Only the tiles you view are fetched, instead of downloading the entire file.",
    url: "https://github.com/cogeotiff/rio-cogeo",
  },
  xarray: {
    role: "Converted",
    name: "xarray + rio-cogeo",
    description:
      "Extracted variables from your NetCDF file using xarray, then converted each to a Cloud Optimized GeoTIFF for efficient tile-based access.",
    url: "https://github.com/pydata/xarray",
  },
  GeoPandas: {
    role: "Converted",
    name: "GeoPandas",
    description:
      "Read your vector geometries and attributes, reprojected to web-friendly coordinates, and wrote to GeoParquet for efficient columnar access.",
    url: "https://github.com/geopandas/geopandas",
  },
  tippecanoe: {
    role: "Tiled",
    name: "tippecanoe",
    description:
      "Generated PMTiles — a single-file archive of pre-computed vector tiles at every zoom level, optimized for HTTP range requests.",
    url: "https://github.com/felt/tippecanoe",
  },
  MinIO: {
    role: "Stored",
    name: "MinIO (S3-compatible)",
    description:
      "Your converted file is stored in an S3-compatible object store where tilers access it via HTTP range requests — the same protocol used by AWS S3 and Google Cloud Storage.",
    url: "https://github.com/minio/minio",
  },
  pgSTAC: {
    role: "Cataloged",
    name: "pgSTAC + STAC API",
    description:
      "Your dataset is registered in a STAC catalog — a standard for describing geospatial data. This is how the tiler knows where your file is and what area and time it covers.",
    url: "https://github.com/stac-utils/pgstac",
  },
  PostGIS: {
    role: "Cataloged",
    name: "PostGIS",
    description:
      "Your vector data is stored in a PostGIS-enabled PostgreSQL database, enabling spatial queries and dynamic MVT tile generation.",
    url: "https://github.com/postgis/postgis",
  },
  titiler: {
    role: "Displayed",
    name: "titiler + deck.gl",
    description:
      "titiler serves map tiles on demand from your COG, reading only the pixels needed for each tile. deck.gl renders those tiles in your browser with GPU acceleration.",
    url: "https://github.com/developmentseed/titiler",
  },
  tipg: {
    role: "Displayed",
    name: "tipg + MapLibre",
    description:
      "tipg generates vector tiles on the fly from your PostGIS table. MapLibre GL JS renders them in the browser with hardware-accelerated WebGL.",
    url: "https://github.com/developmentseed/tipg",
  },
  "deck.gl": {
    role: "Displayed",
    name: "deck.gl (client-side)",
    description:
      "Reads the COG file directly in your browser using GPU-accelerated rendering — no tile server needed. Powered by @developmentseed/deck.gl-geotiff.",
    url: "https://github.com/visgl/deck.gl",
  },
  PMTiles: {
    role: "Displayed",
    name: "PMTiles + MapLibre",
    description:
      "Pre-computed vector tiles served from a single file via HTTP range requests. MapLibre GL JS renders them in the browser with hardware-accelerated WebGL.",
    url: "https://github.com/protomaps/PMTiles",
  },
};

export function getTechCards(
  credits: { tool: string; role: string; url: string }[],
  formatPair: string,
  tileUrl: string,
): TechDescription[] {
  const cards: TechDescription[] = [];
  const seen = new Set<string>();

  // Conversion tool(s)
  for (const c of credits) {
    const desc = TECH_DESCRIPTIONS[c.tool];
    if (desc && !seen.has(desc.role + desc.name)) {
      seen.add(desc.role + desc.name);
      cards.push(desc);
    }
  }

  // Storage — always MinIO for raster, PostGIS for vector via tipg
  const isVector = formatPair.includes("geoparquet");
  const isPmtiles = tileUrl?.startsWith("/pmtiles/");
  if (isVector && !isPmtiles) {
    if (!seen.has("Cataloged" + "PostGIS")) cards.push(TECH_DESCRIPTIONS["PostGIS"]);
  } else {
    if (!seen.has("Stored" + "MinIO (S3-compatible)")) cards.push(TECH_DESCRIPTIONS["MinIO"]);
    if (!seen.has("Cataloged" + "pgSTAC + STAC API")) cards.push(TECH_DESCRIPTIONS["pgSTAC"]);
  }

  // Display tool
  if (isVector) {
    if (isPmtiles) {
      if (!seen.has("Displayed" + "PMTiles + MapLibre")) cards.push(TECH_DESCRIPTIONS["PMTiles"]);
    } else {
      if (!seen.has("Displayed" + "tipg + MapLibre")) cards.push(TECH_DESCRIPTIONS["tipg"]);
    }
  } else {
    if (!seen.has("Displayed" + "titiler + deck.gl")) cards.push(TECH_DESCRIPTIONS["titiler"]);
  }

  return cards;
}

export type { TechDescription };
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/techDescriptions.ts
git commit -m "feat: add tech description data for deep dive panel"
```

---

### Task 2: Create TechCard component

**Files:**
- Create: `frontend/src/components/TechCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/TechCard.tsx
import { Box, Link, Text } from "@chakra-ui/react";
import type { TechDescription } from "../lib/techDescriptions";

interface TechCardProps {
  tech: TechDescription;
}

export function TechCard({ tech }: TechCardProps) {
  return (
    <Box flex="1" bg="gray.800" borderRadius="md" p={4} borderTopWidth="2px" borderColor="brand.orange">
      <Text fontSize="xs" color="brand.orange" textTransform="uppercase" letterSpacing="wide" fontWeight="bold">
        {tech.role}
      </Text>
      <Text fontSize="sm" color="white" fontWeight="bold" mt={1}>
        {tech.name}
      </Text>
      <Text fontSize="xs" color="gray.400" lineHeight="tall" mt={1}>
        {tech.description}
      </Text>
      <Link href={tech.url} target="_blank" rel="noopener noreferrer" fontSize="xs" color="brand.orange" mt={2} display="block">
        View repo ↗
      </Link>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TechCard.tsx
git commit -m "feat: add TechCard component for deep dive panel"
```

---

### Task 3: Rework ReportCard into deep dive panel

**Files:**
- Modify: `frontend/src/components/ReportCard.tsx`

This task removes the 4 stat cards (FileSizeCard, DataFetchedCard, ShareCard, CapabilitiesCard) and replaces the grid with a horizontal row of TechCards. The transformation bar at top is retained.

- [ ] **Step 1: Rewrite ReportCard.tsx**

Keep: `getTransformationSteps`, `getTileUrlPrefix`, the header, and the transformation bar JSX.

Remove: `FileSizeCard`, `DataFetchedCard`, `ShareCard`, `CapabilitiesCard`, the 2×2 grid, the `onScrollToCredits` prop, the footer "See the full pipeline →" link.

Add: import `getTechCards` and `TechCard`. After the transformation bar, render a horizontal flex row of TechCards:

```tsx
import { getTechCards } from "../lib/techDescriptions";
import { TechCard } from "./TechCard";

// Remove the onScrollToCredits prop from ReportCardProps:
interface ReportCardProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
}

// Inside the component, replace the stat cards grid with:
const techCards = getTechCards(dataset.credits, dataset.format_pair, dataset.tile_url);

// JSX — replace the Grid section and footer with:
<Flex gap={4} mt={6}>
  {techCards.map((tech) => (
    <TechCard key={tech.name} tech={tech} />
  ))}
</Flex>
```

Remove the `useTileTransferSize` import (no longer used here). Remove the `formatDownloadTime` and `formatGeometryLabel` helpers if no longer used.

- [ ] **Step 2: Run tests**

```bash
cd frontend && npx vitest run src/components/ReportCard.test.tsx
```

Update tests to match new structure — the test should verify TechCards render based on dataset credits, not stat cards.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ReportCard.tsx frontend/src/components/ReportCard.test.tsx
git commit -m "feat: rework ReportCard into tech deep dive panel"
```

---

### Task 4: Create ConversionSummaryCard

**Files:**
- Create: `frontend/src/components/ConversionSummaryCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/ConversionSummaryCard.tsx
import { Box, Flex, Text } from "@chakra-ui/react";
import type { Dataset } from "../types";
import { formatBytes } from "../utils/format";

interface ConversionSummaryCardProps {
  dataset: Dataset;
  bytesTransferred: number | null;
  onDetailsClick: () => void;
}

export function ConversionSummaryCard({ dataset, bytesTransferred, onDetailsClick }: ConversionSummaryCardProps) {
  const originalSize = dataset.original_file_size;
  const convertedSize = dataset.converted_file_size;
  const pctSmaller =
    originalSize && convertedSize ? Math.round((1 - convertedSize / originalSize) * 100) : null;

  // Mini pipeline label
  const formatLabel = dataset.format_pair?.split("-to-") ?? [];
  const fromLabel = formatLabel[0] ?? "original";
  const toLabel = formatLabel[1] ?? "converted";

  return (
    <Box bg="gray.800" borderRadius="md" p={4} cursor="pointer" onClick={onDetailsClick} _hover={{ bg: "gray.750" }}>
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
          Conversion summary
        </Text>
        <Text fontSize="xs" color="brand.orange" cursor="pointer">
          Details →
        </Text>
      </Flex>

      {/* Mini pipeline */}
      <Flex align="center" gap={2} mb={3}>
        <Box bg="gray.700" borderRadius="sm" px={2} py={0.5}>
          <Text fontSize="xs" color="gray.300">{fromLabel}</Text>
        </Box>
        <Text fontSize="xs" color="gray.500">→</Text>
        <Box bg="gray.700" borderRadius="sm" px={2} py={0.5}>
          <Text fontSize="xs" color="green.400">{toLabel}</Text>
        </Box>
      </Flex>

      {/* Stats */}
      <Flex gap={6}>
        <Box>
          <Text fontSize="md" color="white" fontWeight="bold">
            {originalSize ? formatBytes(originalSize) : "—"} → {convertedSize ? formatBytes(convertedSize) : "—"}
          </Text>
          {pctSmaller !== null && pctSmaller > 0 && (
            <Text fontSize="xs" color="green.400">{pctSmaller}% smaller</Text>
          )}
        </Box>
        {bytesTransferred !== null && bytesTransferred > 0 && (
          <Box>
            <Text fontSize="md" color="brand.orange" fontWeight="bold">
              {formatBytes(bytesTransferred)} fetched
            </Text>
            <Text fontSize="xs" color="gray.400">
              of {convertedSize ? formatBytes(convertedSize) : "—"} total
            </Text>
          </Box>
        )}
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ConversionSummaryCard.tsx
git commit -m "feat: add ConversionSummaryCard component"
```

---

### Task 5: Create StoryCTABanner

**Files:**
- Create: `frontend/src/components/StoryCTABanner.tsx`
- Modify: `frontend/src/lib/story/types.ts`

- [ ] **Step 1: Update createStory to support custom chapter templates**

Currently `createStory(datasetId)` creates one scrollytelling chapter. The CTA needs to create a story with a prose chapter 1 and a map chapter 2. The simplest approach: pass chapter overrides via the existing `overrides` parameter.

No changes needed to `createStory` or `createChapter` — both already accept overrides. The `StoryCTABanner` will construct the chapters directly.

- [ ] **Step 2: Create the StoryCTABanner component**

```tsx
// frontend/src/components/StoryCTABanner.tsx
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Text } from "@chakra-ui/react";
import { createStory, createChapter, DEFAULT_LAYER_CONFIG } from "../lib/story/types";
import { createStoryOnServer } from "../lib/story/api";
import type { Dataset } from "../types";
import { cameraFromBounds } from "../lib/layers";

interface StoryCTABannerProps {
  dataset: Dataset;
}

export function StoryCTABanner({ dataset }: StoryCTABannerProps) {
  const navigate = useNavigate();

  const handleCreate = useCallback(async () => {
    const cam = dataset.bounds ? cameraFromBounds(dataset.bounds) : null;
    const mapState = cam
      ? { center: [cam.longitude, cam.latitude] as [number, number], zoom: cam.zoom, pitch: 0, bearing: 0, basemap: "streets" }
      : undefined;

    const proseChapter = createChapter({
      order: 0,
      title: "Chapter 1",
      type: "prose",
      narrative: "",
    });

    const mapChapter = createChapter({
      order: 1,
      title: "Chapter 2",
      type: "map",
      layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: dataset.id },
      ...(mapState && { map_state: mapState }),
    });

    const story = createStory(dataset.id, {
      chapters: [proseChapter, mapChapter],
    });

    const created = await createStoryOnServer(story);
    navigate(`/story/${created.id}/edit`);
  }, [dataset, navigate]);

  return (
    <Box
      bg="linear-gradient(135deg, rgba(207,63,2,0.15), transparent)"
      border="1px solid"
      borderColor="brand.orange"
      borderRadius="md"
      p={4}
    >
      <Text fontSize="xs" color="brand.orange" textTransform="uppercase" letterSpacing="wide" fontWeight="bold">
        What's next
      </Text>
      <Text fontSize="md" color="white" fontWeight="bold" mt={1}>
        Tell a story with this data
      </Text>
      <Text fontSize="xs" color="gray.400" mt={1} lineHeight="tall">
        Add annotations, narrative text, and guided map views to create a shareable data story.
      </Text>
      <Button mt={3} size="sm" bg="brand.orange" color="white" onClick={handleCreate}>
        Create story →
      </Button>
    </Box>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StoryCTABanner.tsx
git commit -m "feat: add StoryCTABanner component with prose+map chapter template"
```

---

### Task 6: Create InlineUpload component

**Files:**
- Create: `frontend/src/components/InlineUpload.tsx`

- [ ] **Step 1: Create the component**

This wraps the existing FileUploader, ProgressTracker, and VariablePicker inside the side panel with a cancel button.

```tsx
// frontend/src/components/InlineUpload.tsx
import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { FileUploader } from "./FileUploader";
import { ProgressTracker } from "./ProgressTracker";
import { VariablePicker } from "./VariablePicker";
import { useConversionJob } from "../hooks/useConversionJob";
import { formatBytes } from "../utils/format";

interface InlineUploadProps {
  onCancel: () => void;
}

export function InlineUpload({ onCancel }: InlineUploadProps) {
  const navigate = useNavigate();
  const { state, startUpload, startUrlFetch, startTemporalUpload, confirmVariable } =
    useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({ name: "", size: "" });

  const isProcessing = state.isUploading || (state.jobId !== null && state.status !== "failed");

  // Navigate on success
  useEffect(() => {
    if (state.status === "ready" && state.datasetId) {
      navigate(`/map/${state.datasetId}`);
    }
  }, [state.status, state.datasetId, navigate]);

  const handleFile = useCallback(
    (file: File) => {
      fileRef.current = { name: file.name, size: formatBytes(file.size) };
      startUpload(file);
    },
    [startUpload],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        fileRef.current = {
          name: `${files.length} files`,
          size: formatBytes(files.reduce((sum, f) => sum + f.size, 0)),
        };
        startTemporalUpload(files);
      }
    },
    [startTemporalUpload],
  );

  const handleUrl = useCallback(
    (url: string) => {
      fileRef.current = { name: url.split("/").pop() || "remote file", size: "" };
      startUrlFetch(url);
    },
    [startUrlFetch],
  );

  const showUploader = !isProcessing && !state.scanResult;
  const showProgress = isProcessing || state.status === "failed";
  const showVariablePicker = !!state.scanResult;

  return (
    <Box h="100%" overflowY="auto">
      <Flex align="center" justify="space-between" mb={4}>
        <Text fontSize="sm" fontWeight="bold" color="white">
          Upload a new file
        </Text>
        <Button size="xs" variant="ghost" color="gray.400" onClick={onCancel}>
          ← Back
        </Button>
      </Flex>

      {showUploader && (
        <FileUploader
          onFileSelected={handleFile}
          onFilesSelected={handleFiles}
          onUrlSubmitted={handleUrl}
          embedded
        />
      )}

      {showProgress && (
        <ProgressTracker
          stages={state.stages}
          filename={fileRef.current.name}
          fileSize={fileRef.current.size}
          embedded
        />
      )}

      {showVariablePicker && state.scanResult && (
        <VariablePicker
          variables={state.scanResult.variables}
          onSelect={(variable, group) =>
            confirmVariable(state.scanResult!.scan_id, variable, group)
          }
        />
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/InlineUpload.tsx
git commit -m "feat: add InlineUpload component for side panel upload flow"
```

---

### Task 7: Create RasterSidebarControls

**Files:**
- Create: `frontend/src/components/RasterSidebarControls.tsx`

The existing `RasterControls.tsx` is positioned absolute on the map. This new component renders the same controls in the sidebar layout (vertical, full-width).

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/RasterSidebarControls.tsx
import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import { listColormaps } from "../lib/maptool";

const COLORMAP_NAMES = listColormaps();

interface BandInfo {
  name: string;
  index: number;
}

interface RasterSidebarControlsProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  colormapName: string;
  onColormapChange: (colormap: string) => void;
  showColormap: boolean;
  bands?: BandInfo[];
  hasRgb?: boolean;
  selectedBand: "rgb" | number;
  onBandChange: (band: "rgb" | number) => void;
  showBands: boolean;
  canClientRender?: boolean;
  renderMode?: "server" | "client";
  onRenderModeChange?: (mode: "server" | "client") => void;
}

export function RasterSidebarControls({
  opacity,
  onOpacityChange,
  colormapName,
  onColormapChange,
  showColormap,
  bands,
  hasRgb,
  selectedBand,
  onBandChange,
  showBands,
  canClientRender,
  renderMode,
  onRenderModeChange,
}: RasterSidebarControlsProps) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase" letterSpacing="wide" mb={3}>
        Visualization
      </Text>

      {/* Band selector */}
      {showBands && bands && bands.length > 0 && (
        <Box mb={3}>
          <Text fontSize="xs" color="gray.400" mb={1}>Band</Text>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={String(selectedBand)}
              onChange={(e) => {
                const val = e.target.value;
                onBandChange(val === "rgb" ? "rgb" : Number(val));
              }}
            >
              {hasRgb && <option value="rgb">RGB</option>}
              {bands.map((b) => (
                <option key={b.index} value={b.index}>{b.name}</option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Box>
      )}

      {/* Colormap selector */}
      {showColormap && (
        <Box mb={3}>
          <Text fontSize="xs" color="gray.400" mb={1}>Colormap</Text>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={colormapName}
              onChange={(e) => onColormapChange(e.target.value)}
            >
              {COLORMAP_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Box>
      )}

      {/* Opacity slider */}
      <Box mb={3}>
        <Flex justify="space-between" mb={1}>
          <Text fontSize="xs" color="gray.400">Opacity</Text>
          <Text fontSize="xs" color="gray.400">{Math.round(opacity * 100)}%</Text>
        </Flex>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </Box>

      {/* Client-side rendering toggle */}
      {canClientRender && onRenderModeChange && (
        <Box mb={3}>
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontSize="xs" color="gray.400">Client-side rendering</Text>
              <Text fontSize="2xs" color="gray.500">Reads COG directly in browser</Text>
            </Box>
            <Box
              as="button"
              w="40px"
              h="22px"
              borderRadius="full"
              bg={renderMode === "client" ? "brand.orange" : "gray.600"}
              position="relative"
              cursor="pointer"
              onClick={() => onRenderModeChange(renderMode === "client" ? "server" : "client")}
            >
              <Box
                position="absolute"
                top="2px"
                left={renderMode === "client" ? "20px" : "2px"}
                w="18px"
                h="18px"
                borderRadius="full"
                bg="white"
                transition="left 0.15s"
              />
            </Box>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RasterSidebarControls.tsx
git commit -m "feat: add RasterSidebarControls for sidebar layout"
```

---

### Task 8: Create SidePanel component

**Files:**
- Create: `frontend/src/components/SidePanel.tsx`

This is the main replacement for CreditsPanel. It composes ConversionSummaryCard, StoryCTABanner, InlineUpload, RasterSidebarControls, and ExploreTab.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/SidePanel.tsx
import { useState, type ReactNode } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import type { Dataset } from "../types";
import { ConversionSummaryCard } from "./ConversionSummaryCard";
import { StoryCTABanner } from "./StoryCTABanner";
import { InlineUpload } from "./InlineUpload";
import { daysUntilExpiry } from "../utils/format";

interface SidePanelProps {
  dataset: Dataset;
  bytesTransferred: number | null;
  onDetailsClick: () => void;
  /** Contextual controls for the bottom section — raster or vector */
  children?: ReactNode;
}

export function SidePanel({ dataset, bytesTransferred, onDetailsClick, children }: SidePanelProps) {
  const [mode, setMode] = useState<"dataset" | "upload">("dataset");
  const expiryDays = daysUntilExpiry(dataset.created_at);

  if (mode === "upload") {
    return (
      <Box h="100%" p={4} overflowY="auto">
        <InlineUpload onCancel={() => setMode("dataset")} />
      </Box>
    );
  }

  return (
    <Flex direction="column" h="100%">
      {/* Pinned top */}
      <Box p={4} flexShrink={0}>
        <ConversionSummaryCard
          dataset={dataset}
          bytesTransferred={bytesTransferred}
          onDetailsClick={onDetailsClick}
        />

        <Box mt={4}>
          <StoryCTABanner dataset={dataset} />
        </Box>

        <Button
          mt={4}
          w="100%"
          size="sm"
          variant="outline"
          color="gray.300"
          borderColor="gray.600"
          onClick={() => setMode("upload")}
        >
          New upload
        </Button>

        {expiryDays !== null && (
          <Text fontSize="xs" color="gray.500" mt={3} textAlign="center">
            ⏳ Expires in {expiryDays} day{expiryDays !== 1 ? "s" : ""}
          </Text>
        )}
      </Box>

      {/* Contextual bottom — scrollable */}
      {children && (
        <Box flex={1} overflowY="auto" p={4} borderTopWidth="1px" borderColor="gray.700">
          {children}
        </Box>
      )}
    </Flex>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SidePanel.tsx
git commit -m "feat: add SidePanel component replacing CreditsPanel"
```

---

### Task 9: Rewrite MapPage.tsx

**Files:**
- Modify: `frontend/src/pages/MapPage.tsx`

This is the biggest task — it integrates all new components and replaces `activeTab` with `renderMode`.

- [ ] **Step 1: Update imports**

Remove imports: `CreditsPanel`, `RasterControls` (the map overlay version).

Add imports: `SidePanel`, `RasterSidebarControls`, `ExploreTab`, `useTileTransferSize`.

```tsx
import { SidePanel } from "../components/SidePanel";
import { RasterSidebarControls } from "../components/RasterSidebarControls";
import { ExploreTab } from "../components/ExploreTab";
import { useTileTransferSize } from "../hooks/useTileTransferSize";
```

- [ ] **Step 2: Replace activeTab with renderMode**

Remove `activeTab` state and `onTabChange`. Add:

```tsx
type RenderMode = "server" | "client" | "vector-tiles" | "geojson";
const [renderMode, setRenderMode] = useState<RenderMode>("server");
```

Initialize `renderMode` based on dataset type after dataset loads:

```tsx
useEffect(() => {
  if (dataset) {
    setRenderMode(dataset.dataset_type === "vector" ? "vector-tiles" : "server");
  }
}, [dataset]);
```

- [ ] **Step 3: Lift useTileTransferSize to MapPage**

Currently called inside ReportCard. Move it to MapPage so ConversionSummaryCard can use it:

```tsx
const tileUrlPrefix = dataset?.tile_url ? getTileUrlPrefix(dataset.tile_url) : "";
const bytesTransferred = useTileTransferSize(tileUrlPrefix);
```

Import `getTileUrlPrefix` from ReportCard (or move it to a shared util). Simplest approach: copy the small helper into MapPage or extract to `utils/format.ts`.

- [ ] **Step 4: Update layer building logic**

Replace all `activeTab === "client"` checks with `renderMode === "client"`, and `activeTab === "explore" && geojson` with `renderMode === "geojson" && geojson`. The `arrowTable` `onTableChange` handler should derive `renderMode`:

```tsx
const handleTableChange = useCallback((table: Table | null) => {
  setArrowTable(table);
  if (dataset?.dataset_type === "vector") {
    setRenderMode(table ? "geojson" : "vector-tiles");
  }
}, [dataset]);
```

- [ ] **Step 5: Simplify header**

Replace the current header children. Remove the "See what changed →" button and "New upload" Link. Keep BugReportLink and ShareButton. The Datasets link is already rendered by Header.tsx itself (left side, next to logo), so no changes needed for that:

```tsx
<Header>
  <BugReportLink dataset={dataset} />
  <ShareButton />
</Header>
```

- [ ] **Step 6: Replace right panel**

Replace the `CreditsPanel` box with `SidePanel`. Pass contextual children based on dataset type:

```tsx
<Box flex={3} display={{ base: "none", md: "block" }} bg="gray.900" borderLeftWidth="1px" borderColor="gray.700">
  <SidePanel
    dataset={dataset}
    bytesTransferred={bytesTransferred}
    onDetailsClick={() => setReportCardOpen(true)}
  >
    {dataset.dataset_type === "raster" && (
      <RasterSidebarControls
        opacity={opacity}
        onOpacityChange={setOpacity}
        colormapName={colormapName}
        onColormapChange={setColormapName}
        showColormap={showingColormap}
        bands={selectableBands}
        hasRgb={hasRgb}
        selectedBand={selectedBand}
        onBandChange={setSelectedBand}
        showBands={isMultiBand}
        canClientRender={canClientRender}
        renderMode={renderMode === "client" ? "client" : "server"}
        onRenderModeChange={(mode) => setRenderMode(mode)}
      />
    )}
    {dataset.dataset_type === "vector" && dataset.parquet_url && (
      <ExploreTab
        dataset={dataset}
        active={true}
        onTableChange={handleTableChange}
      />
    )}
  </SidePanel>
</Box>
```

- [ ] **Step 7: Remove RasterControls from map overlay**

Remove the `<RasterControls>` component that was positioned absolute inside the map container. The controls now live in the sidebar.

- [ ] **Step 8: Remove onScrollToCredits ref and handler**

The `creditsPanelRef` and scroll logic can be removed since the ReportCard no longer has a "See the full pipeline →" footer.

- [ ] **Step 9: Update ReportCard usage**

Remove the `onScrollToCredits` prop:

```tsx
<ReportCard dataset={dataset} isOpen={reportCardOpen} onClose={() => setReportCardOpen(false)} />
```

- [ ] **Step 10: Run full test suite**

```bash
cd frontend && npx vitest run
```

Fix any test failures. The ReportCard tests will need the most attention since its props changed.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/MapPage.tsx
git commit -m "feat: restructure MapPage with new SidePanel and renderMode"
```

---

### Task 10: Clean up removed code

**Files:**
- Delete or simplify: `frontend/src/components/CreditsPanel.tsx` (no longer imported)
- Modify: `frontend/src/components/RasterControls.tsx` — keep file but it's no longer used by MapPage; check if imported elsewhere. If not, delete.

- [ ] **Step 1: Check for remaining imports of CreditsPanel and RasterControls**

```bash
cd frontend && grep -r "CreditsPanel\|RasterControls" src/ --include="*.tsx" --include="*.ts"
```

If no other imports exist, delete both files.

- [ ] **Step 2: Delete unused files**

```bash
rm frontend/src/components/CreditsPanel.tsx
rm frontend/src/components/RasterControls.tsx
```

- [ ] **Step 3: Run full test suite**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add -u frontend/src/components/CreditsPanel.tsx frontend/src/components/RasterControls.tsx
git commit -m "chore: remove CreditsPanel and RasterControls (replaced by SidePanel)"
```

---

### Task 11: Visual verification

**Files:** None (testing only)

- [ ] **Step 1: Start the stack**

```bash
docker compose -f docker-compose.yml up -d --build frontend
```

- [ ] **Step 2: Upload a test file and verify the map view**

Use Playwright MCP to navigate to the frontend at http://localhost:5185, upload a GeoTIFF, and screenshot the map view page. Verify:

1. Header shows only: CNG branding, Datasets link, Share button, Bug Report link
2. Right panel pinned top shows: Conversion Summary card, Story CTA banner, New Upload button, expiration notice
3. Right panel contextual bottom shows: raster controls (band, colormap, opacity, client rendering toggle)
4. Clicking "Details →" opens the deep dive bottom panel with horizontal tech cards
5. Clicking "New upload" replaces panel with upload flow; "← Back" returns to dataset view
6. Clicking "Create story →" navigates to story editor with prose ch1 + map ch2

- [ ] **Step 3: Test with a vector dataset**

Upload a GeoJSON and verify the right panel shows the Explore tab content (filters, SQL, feature count) instead of raster controls.

- [ ] **Step 4: Commit any fixes**

Stage specific changed files and commit:

```bash
git commit -m "fix: visual polish for map view layout redesign"
```
