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
