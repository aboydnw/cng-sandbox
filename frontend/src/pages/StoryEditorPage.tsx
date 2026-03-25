import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { useTooltipDismiss } from "../hooks/useTooltipDismiss";
import { Box, Button, Flex, Input, Text, Link } from "@chakra-ui/react";
import { PencilSimple, X as XIcon } from "@phosphor-icons/react";
import { FlyToInterpolator } from "@deck.gl/core";
import { UnifiedMap } from "../components/UnifiedMap";
import { ChapterList } from "../components/ChapterList";
import { NarrativeEditor } from "../components/NarrativeEditor";
import { UploadModal } from "../components/UploadModal";
import { PublishDialog } from "../components/PublishDialog";
import { Header } from "../components/Header";
import { BugReportLink } from "../components/BugReportLink";
import { SaveStatus } from "../components/SaveStatus";
import { useSaveStatus } from "../hooks/useSaveStatus";
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
  type ChapterType,
  type LayerConfig,
  DEFAULT_LAYER_CONFIG,
  createStory,
  createChapter,
  createStoryOnServer,
  getStoryFromServer,
  saveStoryToServer,
  migrateStory,
} from "../lib/story";
import type { Dataset } from "../types";
import { config } from "../config";
import { workspaceFetch } from "../lib/api";
import { ArrowCounterClockwise, Check, SpinnerGap } from "@phosphor-icons/react";


function TooltipCard({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <Box
      position="absolute"
      zIndex={100}
      bg="gray.900"
      color="white"
      borderRadius="md"
      px={3}
      py={2}
      fontSize="12px"
      maxW="200px"
      shadow="lg"
      pointerEvents="all"
    >
      <Flex gap={2} align="flex-start">
        <Text flex={1} lineHeight="1.4">{text}</Text>
        <Box
          as="button"
          flexShrink={0}
          opacity={0.7}
          _hover={{ opacity: 1 }}
          mt="1px"
          onClick={onDismiss}
        >
          <XIcon size={12} weight="bold" />
        </Box>
      </Flex>
    </Box>
  );
}

export default function StoryEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const datasetIdParam = searchParams.get("dataset");

  const [story, setStory] = useState<Story | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>("");
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [basemap, setBasemap] = useState("streets");
  const [viewSavedFlash, setViewSavedFlash] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [transitionDuration, setTransitionDuration] = useState<number | undefined>(undefined);
  const flyToRef = useRef(new FlyToInterpolator());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCaptureRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allDatasets, setAllDatasets] = useState<Dataset[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { saveState, markSaving, markSaved, markError } = useSaveStatus();
  const { shouldShow, dismiss } = useTooltipDismiss();

  const TOOLTIP_KEYS = ["chapters", "map", "narrative"] as const;
  const firstUnseen = TOOLTIP_KEYS.find((k) => shouldShow(k)) ?? null;

  useEffect(() => {
    async function fetchAllDatasets() {
      try {
        const resp = await workspaceFetch(`${config.apiBase}/api/datasets`);
        if (resp.ok) setAllDatasets(await resp.json());
      } catch {
        // ignore fetch errors
      }
    }
    fetchAllDatasets();
  }, []);

  // Load or create story
  useEffect(() => {
    if (!id) return;
    async function loadStory() {
      const loaded = await getStoryFromServer(id!);
      if (!loaded) {
        setError("Story not found");
        setLoading(false);
        return;
      }
      const migrated = migrateStory(loaded);
      setStory(migrated);
      setActiveChapterId(migrated.chapters[0]?.id ?? "");
      if (JSON.stringify(migrated) !== JSON.stringify(loaded)) {
        saveStoryToServer(migrated).catch(console.error);
      }
    }
    loadStory();
  }, [id]);

  // Create new story if this is /story/new
  useEffect(() => {
    if (id || story) return;
    async function createNew() {
      try {
        const draft = createStory(datasetIdParam);
        if (datasetIdParam) {
          const resp = await workspaceFetch(`${config.apiBase}/api/datasets/${datasetIdParam}`);
          if (resp.ok) {
            const data: Dataset = await resp.json();
            setDataset(data);
            if (data.bounds) {
              const cam = cameraFromBounds(data.bounds);
              draft.chapters[0].map_state = {
                center: [cam.longitude, cam.latitude],
                zoom: cam.zoom,
                bearing: 0,
                pitch: 0,
                basemap: "streets",
              };
              setCamera(cam);
            }
          }
        }
        const saved = await createStoryOnServer(draft);
        setStory(saved);
        setActiveChapterId(saved.chapters[0]?.id ?? "");
        navigate(workspacePath(`/story/${saved.id}/edit`), { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create story");
      } finally {
        setLoading(false);
      }
    }
    createNew();
  }, [id, story, datasetIdParam, navigate, workspacePath]);

  // Fetch primary dataset for existing stories
  useEffect(() => {
    const dsId = story?.dataset_id;
    if (!dsId) {
      if (story) setLoading(false);
      return;
    }
    if (dataset?.id === dsId) return;
    async function fetchDataset() {
      try {
        const resp = await workspaceFetch(`${config.apiBase}/api/datasets/${dsId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Dataset = await resp.json();
        setDataset(data);
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
  }, [story?.dataset_id]);

  const datasetMap = useMemo(() => {
    const map = new Map<string, Dataset>();
    for (const ds of allDatasets) map.set(ds.id, ds);
    if (dataset && !map.has(dataset.id)) map.set(dataset.id, dataset);
    return map;
  }, [allDatasets, dataset]);

  async function handleDatasetReady(datasetId: string) {
    setUploadModalOpen(false);
    try {
      const resp = await workspaceFetch(`${config.apiBase}/api/datasets/${datasetId}`);
      if (!resp.ok) return;
      const ds: Dataset = await resp.json();
      setAllDatasets((prev) =>
        prev.some((d) => d.id === ds.id) ? prev : [...prev, ds],
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

  // Debounced auto-save
  const debouncedSave = useCallback(
    (updated: Story) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      markSaving();
      saveTimerRef.current = setTimeout(() => {
        saveStoryToServer(updated).then(markSaved).catch(markError);
      }, 500);
    },
    [markSaving, markSaved, markError],
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
  const activeDataset = activeChapter
    ? datasetMap.get(activeChapter.layer_config.dataset_id) ?? dataset
    : dataset;

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

  function handleCameraChange(c: CameraState) {
    setCamera(c);
    setTransitionDuration(undefined);

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
      setViewSavedFlash(true);
      setTimeout(() => setViewSavedFlash(false), 1500);
    }, 800);
  }

  function resetView() {
    if (!activeChapter) return;
    setBasemap(activeChapter.map_state.basemap);
    setTransitionDuration(1000);
    setCamera({
      longitude: activeChapter.map_state.center[0],
      latitude: activeChapter.map_state.center[1],
      zoom: activeChapter.map_state.zoom,
      bearing: activeChapter.map_state.bearing,
      pitch: activeChapter.map_state.pitch,
    });
  }

  // Add chapter
  function addChapter() {
    const maxOrder = Math.max(...(story?.chapters.map((c) => c.order) ?? [0]));
    const inheritedDatasetId = activeChapter?.layer_config.dataset_id ?? story?.dataset_id ?? "";
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
      layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: inheritedDatasetId },
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

  function updateChapterLayerConfig(config: LayerConfig) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, layer_config: config } : ch,
      ),
    }));
  }

  function updateChapterType(type: ChapterType) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, type } : ch,
      ),
    }));
  }

  // Publish
  function handlePublish() {
    if (!story) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const published = { ...story, published: true };
    setStory(published);
    saveStoryToServer(published);
  }

  function handleUnpublish() {
    if (!story) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const unpublished = { ...story, published: false };
    setStory(unpublished);
    saveStoryToServer(unpublished);
  }

  // Build layers
  const layers = useMemo(() => {
    const ds = activeDataset;
    if (!ds) return [];
    const lc = activeChapter?.layer_config ?? DEFAULT_LAYER_CONFIG;

    if (ds.dataset_type === "raster") {
      const base = ds.tile_url;
      const sep = base.includes("?") ? "&" : "?";
      let tileUrl = `${base}${sep}colormap_name=${lc.colormap}`;
      if (ds.raster_min != null && ds.raster_max != null) {
        tileUrl += `&rescale=${ds.raster_min},${ds.raster_max}`;
      }
      return buildRasterTileLayers({
        tileUrl,
        opacity: lc.opacity,
        isTemporalActive: false,
      });
    }
    return [
      buildVectorLayer({
        tileUrl: ds.tile_url,
        isPMTiles: ds.tile_url.startsWith("/pmtiles/"),
        opacity: lc.opacity,
        minZoom: ds.min_zoom ?? undefined,
        maxZoom: ds.max_zoom ?? undefined,
      }),
    ];
  }, [activeDataset, activeChapter]);

  // --- Loading / error ---
  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center">
        <SpinnerGap size={32} style={{ animation: "spin 1s linear infinite" }} />
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
      <Header>
        <Flex
          align="center"
          gap={1}
          role="group"
          position="relative"
        >
          <Input
            value={story.title}
            onChange={(e) => updateStory((s) => ({ ...s, title: e.target.value }))}
            placeholder="Click to name your story"
            fontSize="15px"
            fontWeight={600}
            border="none"
            borderBottom="2px solid"
            borderColor="transparent"
            borderRadius={0}
            outline="none"
            background="transparent"
            width="300px"
            p={0}
            height="auto"
            _hover={{ borderColor: "gray.300" }}
            _focusVisible={{ borderColor: "brand.orange", boxShadow: "none" }}
            _placeholder={{ color: "gray.400", fontWeight: 400 }}
          />
          <Box
            color="gray.400"
            opacity={0}
            _groupHover={{ opacity: 1 }}
            _groupFocusWithin={{ opacity: 1 }}
            pointerEvents="none"
            flexShrink={0}
          >
            <PencilSimple size={14} />
          </Box>
        </Flex>
        <SaveStatus state={saveState} />
        <Flex gap={2} align="center">
          <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(workspacePath(`/story/${story.id}`), "_blank")}
          >
            Preview
          </Button>
          {story.published ? (
            <Flex align="center" gap={2}>
              <Flex align="center" gap={1.5}>
                <Box w={2} h={2} borderRadius="full" bg="green.500" />
                <Button
                  size="sm"
                  bg="green.500"
                  color="white"
                  _hover={{ bg: "green.600" }}
                  onClick={() => setPublishDialogOpen(true)}
                >
                  Published
                </Button>
              </Flex>
              <Link
                fontSize="xs"
                color="gray.500"
                textDecoration="underline"
                cursor="pointer"
                onClick={handleUnpublish}
              >
                Unpublish
              </Link>
            </Flex>
          ) : (
            <Button
              size="sm"
              bg="brand.orange"
              color="white"
              onClick={() => setPublishDialogOpen(true)}
              _hover={{ bg: "brand.orangeHover" }}
            >
              Publish
            </Button>
          )}
        </Flex>
      </Header>

      {/* Published URL bar */}
      {story.published && (
        <Flex
          align="center"
          gap={2}
          px={4}
          py={1.5}
          bg="green.50"
          borderBottom="1px solid"
          borderColor="green.100"
          fontSize="xs"
          color="green.700"
        >
          <Box w={1.5} h={1.5} borderRadius="full" bg="green.500" flexShrink={0} />
          <Text fontWeight={500}>Published —</Text>
          <Text
            color="green.600"
            fontFamily="mono"
            truncate
            maxW="400px"
          >
            {`${window.location.origin}${workspacePath(`/story/${story.id}`)}`}
          </Text>
          <Button
            size="xs"
            variant="ghost"
            color="green.600"
            _hover={{ bg: "green.100" }}
            px={2}
            h={5}
            onClick={() => {
              const url = `${window.location.origin}${workspacePath(`/story/${story.id}`)}`;
              navigator.clipboard?.writeText(url);
            }}
          >
            Copy
          </Button>
        </Flex>
      )}

      {/* Three-panel layout: Chapters | Map | Editor */}
      <Flex flex={1} overflow="hidden">
        {/* Left: chapter list */}
        <Box
          w="200px"
          flexShrink={0}
          borderRight="1px solid"
          borderColor="gray.200"
          bg="white"
          position="relative"
        >
          {firstUnseen === "chapters" && (
            <TooltipCard
              text="Each chapter is a section of your story. Readers see them in this order."
              onDismiss={() => dismiss("chapters")}
            />
          )}
          <ChapterList
            chapters={story.chapters}
            activeChapterId={activeChapterId}
            onSelect={selectChapter}
            onAdd={addChapter}
            onDelete={deleteChapter}
            onReorder={reorderChapters}
          />
        </Box>

        {/* Center: map (full height) — hidden for prose chapters */}
        {activeChapter?.type !== "prose" ? (
          <Box flex={1} position="relative">
            {firstUnseen === "map" && (
              <TooltipCard
                text="Navigate the map to frame your view. It saves automatically as you go."
                onDismiss={() => dismiss("map")}
              />
            )}
            <UnifiedMap
              camera={camera}
              onCameraChange={handleCameraChange}
              layers={layers}
              basemap={basemap}
              onBasemapChange={setBasemap}
              transitionDuration={transitionDuration}
              transitionInterpolator={transitionDuration ? flyToRef.current : undefined}
            >
              {viewSavedFlash && (
                <Flex
                  position="absolute"
                  bottom={4}
                  left="50%"
                  transform="translateX(-50%)"
                  align="center"
                  gap={1}
                  bg="whiteAlpha.900"
                  px={3}
                  py={1.5}
                  borderRadius="md"
                  shadow="sm"
                  fontSize="xs"
                  color="green.600"
                  fontWeight={500}
                  pointerEvents="none"
                >
                  <Check size={12} /> View saved
                </Flex>
              )}
              {!viewSavedFlash && activeChapter && (() => {
                const ms = activeChapter.map_state;
                const differs =
                  Math.abs(camera.longitude - ms.center[0]) > 0.0001 ||
                  Math.abs(camera.latitude - ms.center[1]) > 0.0001 ||
                  Math.abs(camera.zoom - ms.zoom) > 0.01 ||
                  Math.abs(camera.bearing - ms.bearing) > 0.1 ||
                  Math.abs(camera.pitch - ms.pitch) > 0.1 ||
                  basemap !== ms.basemap;
                return differs ? (
                  <Button
                    position="absolute"
                    bottom={4}
                    left="50%"
                    transform="translateX(-50%)"
                    size="sm"
                    variant="outline"
                    bg="whiteAlpha.900"
                    shadow="md"
                    onClick={resetView}
                    display="flex"
                    alignItems="center"
                    gap={1.5}
                  >
                    <ArrowCounterClockwise size={14} /> Reset view
                  </Button>
                ) : null;
              })()}
            </UnifiedMap>
          </Box>
        ) : (
          <Box flex={1} />
        )}

        {/* Right: editor panel */}
        <Box
          w="340px"
          flexShrink={0}
          borderLeft="1px solid"
          borderColor="gray.200"
          bg="white"
          overflowY="auto"
          position="relative"
        >
          {firstUnseen === "narrative" && (
            <TooltipCard
              text="Write what readers will see alongside the map. Use the toolbar for formatting."
              onDismiss={() => dismiss("narrative")}
            />
          )}
          {activeChapter ? (
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
          ) : (
            <Flex h="100%" align="center" justify="center">
              <Text color="gray.400">Select a chapter to edit</Text>
            </Flex>
          )}
        </Box>
      </Flex>
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDatasetReady={handleDatasetReady}
      />
      <PublishDialog
        open={publishDialogOpen}
        story={story}
        shareUrl={`${window.location.origin}${workspacePath(`/story/${story.id}`)}`}
        onPublish={handlePublish}
        onClose={() => setPublishDialogOpen(false)}
      />
    </Box>
  );
}
