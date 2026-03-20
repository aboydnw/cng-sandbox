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
    if (!dataset) return [];
    if (dataset.dataset_type === "raster") {
      const base = dataset.tile_url;
      const sep = base.includes("?") ? "&" : "?";
      const tileUrl = `${base}${sep}colormap_name=viridis`;
      return buildRasterTileLayers({
        tileUrl,
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
      {/* Top bar */}
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
        <Flex gap={2} align="center">
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
