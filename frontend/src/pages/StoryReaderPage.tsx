import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Box, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import scrollama from "scrollama";
import { FlyToInterpolator } from "@deck.gl/core";
import { UnifiedMap } from "../components/UnifiedMap";
import { ProseChapter } from "../components/ProseChapter";
import { MapChapter } from "../components/MapChapter";

import {
  type CameraState,
  cameraFromBounds,
  buildRasterTileLayers,
  buildVectorLayer,
} from "../lib/layers";
import { getStoryFromServer, DEFAULT_LAYER_CONFIG, migrateStory } from "../lib/story";
import { BugReportLink } from "../components/BugReportLink";
import type { Story, Chapter } from "../lib/story";
import type { Dataset } from "../types";
import { config } from "../config";

type ContentBlock =
  | { type: "scrollytelling"; chapters: Chapter[]; startIndex: number }
  | { type: "prose"; chapter: Chapter; index: number }
  | { type: "map"; chapter: Chapter; index: number };

function groupChaptersIntoBlocks(chapters: Chapter[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let scrollyGroup: Chapter[] = [];
  let scrollyStartIndex = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (ch.type === "scrollytelling" || !ch.type) {
      if (scrollyGroup.length === 0) scrollyStartIndex = i;
      scrollyGroup.push(ch);
    } else {
      if (scrollyGroup.length > 0) {
        blocks.push({ type: "scrollytelling", chapters: scrollyGroup, startIndex: scrollyStartIndex });
        scrollyGroup = [];
      }
      blocks.push({ type: ch.type, chapter: ch, index: i });
    }
  }
  if (scrollyGroup.length > 0) {
    blocks.push({ type: "scrollytelling", chapters: scrollyGroup, startIndex: scrollyStartIndex });
  }
  return blocks;
}

function buildLayersForChapter(chapter: Chapter, datasetMap: Map<string, Dataset | null>) {
  const ds = datasetMap.get(chapter.layer_config.dataset_id);
  if (!ds) return [];
  const lc = chapter.layer_config ?? DEFAULT_LAYER_CONFIG;

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
}

function ScrollytellingBlock({
  chapters,
  startIndex,
  datasetMap,
}: {
  chapters: Chapter[];
  startIndex: number;
  datasetMap: Map<string, Dataset | null>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [camera, setCamera] = useState<CameraState>({
    longitude: chapters[0].map_state.center[0],
    latitude: chapters[0].map_state.center[1],
    zoom: chapters[0].map_state.zoom,
    bearing: chapters[0].map_state.bearing,
    pitch: chapters[0].map_state.pitch,
  });
  const [basemap, setBasemap] = useState(chapters[0].map_state.basemap);
  const [transitionDuration, setTransitionDuration] = useState<number | undefined>(undefined);
  const flyToRef = useRef(new FlyToInterpolator());
  const stepsRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<ReturnType<typeof scrollama> | null>(null);

  // Initialize camera from dataset bounds if first chapter has default state
  useEffect(() => {
    if (datasetMap.size === 0) return;
    const firstChapter = chapters[0];
    const ds = datasetMap.get(firstChapter.layer_config.dataset_id);
    if (ds?.bounds && firstChapter.map_state.center[0] === 0 && firstChapter.map_state.center[1] === 0) {
      setCamera(cameraFromBounds(ds.bounds));
    }
  }, [datasetMap, chapters]);

  // Set up scrollama
  useEffect(() => {
    if (!stepsRef.current || chapters.length === 0) return;

    const scroller = scrollama();
    scrollerRef.current = scroller;

    scroller
      .setup({
        step: stepsRef.current.querySelectorAll("[data-step]") as unknown as HTMLElement[],
        offset: 0.8,
      })
      .onStepEnter(({ index }) => {
        setActiveIndex(index);
      });

    return () => {
      scroller.destroy();
      scrollerRef.current = null;
    };
  }, [chapters]);

  // Fly to chapter on active change
  useEffect(() => {
    const chapter = chapters[activeIndex];
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
  }, [activeIndex, chapters]);

  const layers = useMemo(
    () => buildLayersForChapter(chapters[activeIndex], datasetMap),
    [datasetMap, activeIndex, chapters],
  );

  const handleCameraChange = useCallback((c: CameraState) => {
    setCamera(c);
    setTransitionDuration(undefined);
  }, []);

  const activeDataset = chapters[activeIndex]
    ? datasetMap.get(chapters[activeIndex].layer_config.dataset_id)
    : undefined;

  return (
    <Flex h="100vh" overflow="hidden" position="relative">
      {/* Left: scrolling narrative */}
      <Box
        w="40%"
        overflowY="auto"
        bg="gray.50"
        ref={stepsRef}
      >
        {chapters.map((chapter, i) => (
          <Box
            key={chapter.id}
            data-step
            px={8}
            pt={i === 0 ? 12 : 4}
            pb="80vh"
            opacity={activeIndex === i ? 1 : 0.3}
            transition="opacity 0.4s ease"
          >
            <Box
              bg="white"
              borderRadius="8px"
              p={6}
              shadow="sm"
              border="1px solid"
              borderColor={activeIndex === i ? "blue.200" : "gray.200"}
            >
              <Text
                fontSize="10px"
                textTransform="uppercase"
                letterSpacing="1px"
                color="blue.500"
                fontWeight={600}
                mb={2}
              >
                Chapter {startIndex + i + 1}
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
      <Box w="60%" position="sticky" top={0} h="100vh">
        {datasetMap.size > 0 && (
          <UnifiedMap
            camera={camera}
            onCameraChange={handleCameraChange}
            layers={layers}
            basemap={basemap}
            onBasemapChange={setBasemap}
            transitionDuration={transitionDuration}
            transitionInterpolator={transitionDuration ? flyToRef.current : undefined}
            interactive={false}
          />
        )}
        {activeDataset === null && (
          <Flex
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            bg="blackAlpha.600"
            zIndex={10}
          >
            <Text color="white" fontSize="lg" fontWeight={500}>
              Data no longer available
            </Text>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}

export default function StoryReaderPage({ embed = false }: { embed?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [datasetMap, setDatasetMap] = useState<Map<string, Dataset | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load story from API
  useEffect(() => {
    if (!id) return;
    async function loadStory() {
      try {
        const loaded = await getStoryFromServer(id!);
        if (!loaded) {
          setError("Story not found");
          setLoading(false);
          return;
        }
        const migrated = migrateStory(loaded);
        setStory(migrated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load story");
        setLoading(false);
      }
    }
    loadStory();
  }, [id]);

  // Fetch all datasets referenced by the story
  useEffect(() => {
    if (!story) return;
    async function fetchDatasets() {
      const ids = story!.dataset_ids ?? [story!.dataset_id];
      const uniqueIds = [...new Set(ids)];
      const entries = await Promise.all(
        uniqueIds.map(async (dsId) => {
          try {
            const resp = await fetch(`${config.apiBase}/api/datasets/${dsId}`);
            if (!resp.ok) return [dsId, null] as const;
            return [dsId, await resp.json() as Dataset] as const;
          } catch {
            return [dsId, null] as const;
          }
        }),
      );
      setDatasetMap(new Map(entries));
      setLoading(false);
    }
    fetchDatasets();
  }, [story]);

  const sortedChapters = useMemo(
    () => (story ? [...story.chapters].sort((a, b) => a.order - b.order) : []),
    [story],
  );

  const contentBlocks = useMemo(
    () => groupChaptersIntoBlocks(sortedChapters),
    [sortedChapters],
  );

  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

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
        <Link to="/">
          <Text color="brand.orange" fontWeight={600}>
            ← Back to sandbox
          </Text>
        </Link>
      </Flex>
    );
  }

  if (!story) return null;

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {!embed && (
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
          <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
          <Text ml="auto" fontSize="xs" color="gray.500">
            Made with CNG Sandbox
          </Text>
        </Flex>
      )}

      {/* Main content */}
      <Box flex={1} overflowY="auto">
        {contentBlocks.map((block, blockIndex) => {
          if (block.type === "prose") {
            return (
              <ProseChapter
                key={block.chapter.id}
                chapter={block.chapter}
                chapterIndex={block.index}
              />
            );
          }

          if (block.type === "map") {
            const ds = datasetMap.get(block.chapter.layer_config.dataset_id) ?? null;
            return (
              <MapChapter
                key={block.chapter.id}
                chapter={block.chapter}
                chapterIndex={block.index}
                dataset={ds}
              />
            );
          }

          return (
            <ScrollytellingBlock
              key={`scrolly-${blockIndex}`}
              chapters={block.chapters}
              startIndex={block.startIndex}
              datasetMap={datasetMap}
            />
          );
        })}
      </Box>
    </Box>
  );
}
