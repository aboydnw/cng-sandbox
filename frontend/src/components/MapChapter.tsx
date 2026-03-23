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
      let tileUrl = `${base}${sep}colormap_name=${lc.colormap}`;
      if (dataset.raster_min != null && dataset.raster_max != null) {
        tileUrl += `&rescale=${dataset.raster_min},${dataset.raster_max}`;
      }
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
