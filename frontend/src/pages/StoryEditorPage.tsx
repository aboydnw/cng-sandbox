import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Box, Button, Flex, Spinner, Text } from "@chakra-ui/react";
import { FlyToInterpolator } from "@deck.gl/core";
import { UnifiedMap } from "../components/UnifiedMap";
import { ChapterList } from "../components/ChapterList";
import { NarrativeEditor } from "../components/NarrativeEditor";
import { UploadModal } from "../components/UploadModal";
import { Header } from "../components/Header";
import { BugReportLink } from "../components/BugReportLink";
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
  const [allDatasets, setAllDatasets] = useState<Dataset[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    async function fetchAllDatasets() {
      try {
        const resp = await fetch(`${config.apiBase}/api/datasets`);
        if (resp.ok) setAllDatasets(await resp.json());
      } catch {}
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
          const resp = await fetch(`${config.apiBase}/api/datasets/${datasetIdParam}`);
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
        navigate(`/story/${saved.id}/edit`, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create story");
      } finally {
        setLoading(false);
      }
    }
    createNew();
  }, [id, story, datasetIdParam, navigate]);

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
        const resp = await fetch(`${config.apiBase}/api/datasets/${dsId}`);
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
      const resp = await fetch(`${config.apiBase}/api/datasets/${datasetId}`);
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
      saveTimerRef.current = setTimeout(() => {
        saveStoryToServer(updated);
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
    const url = `${window.location.origin}/story/${story.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setPublishFeedback("Published! URL copied to clipboard.");
    } else {
      setPublishFeedback(`Published! Reader URL: ${url}`);
    }
    setTimeout(() => setPublishFeedback(null), 5000);
  }

  // Build layers
  const layers = useMemo(() => {
    const ds = activeDataset;
    if (!ds) return [];
    const lc = activeChapter?.layer_config ?? DEFAULT_LAYER_CONFIG;

    if (ds.dataset_type === "raster") {
      const base = ds.tile_url;
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
        <Spinner size="lg" />
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
        <Flex gap={2} align="center">
          <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
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
      </Header>

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

          {/* Editor (bottom) */}
          <Box
            flex={4}
            borderTop="1px solid"
            borderColor="gray.200"
            bg="white"
          >
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
      </Flex>
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDatasetReady={handleDatasetReady}
      />
    </Box>
  );
}
