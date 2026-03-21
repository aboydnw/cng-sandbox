import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Box, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import type { Layer } from "@deck.gl/core";
import { UnifiedMap } from "../components/UnifiedMap";
import { ProseChapter } from "../components/ProseChapter";
import { MapChapter } from "../components/MapChapter";

import {
  type CameraState,
  buildRasterTileLayers,
  buildVectorLayer,
} from "../lib/layers";
import { getStoryFromServer, DEFAULT_LAYER_CONFIG, migrateStory } from "../lib/story";
import type { Story, Chapter } from "../lib/story";
import type { Dataset } from "../types";
import { config } from "../config";

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

  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

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
          <Text ml="auto" fontSize="xs" color="gray.500">
            Made with CNG Sandbox
          </Text>
        </Flex>
      )}

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
    </Box>
  );
}
