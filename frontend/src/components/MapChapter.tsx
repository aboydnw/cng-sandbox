import { useCallback, useMemo, useRef, useState } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import { UnifiedMap } from "./UnifiedMap";
import { CalendarPopover } from "./CalendarPopover";
import { RenderModeIndicator } from "./RenderModeIndicator";
import type { Chapter } from "../lib/story";
import type { CameraState } from "../lib/layers/types";
import type { TileCacheEntry } from "../lib/layers";
import type { Connection, Dataset } from "../types";
import { buildLayersForChapter } from "../lib/story/rendering";
import { detectCadence } from "../utils/temporal";
import { displayName } from "../utils/dataset";

interface MapChapterProps {
  chapter: Chapter;
  chapterIndex: number;
  dataset: Dataset | null;
  connection?: Connection;
}

export function MapChapter({
  chapter,
  chapterIndex,
  dataset,
  connection,
}: MapChapterProps) {
  const [camera, setCamera] = useState<CameraState>({
    longitude: chapter.map_state.center[0],
    latitude: chapter.map_state.center[1],
    zoom: chapter.map_state.zoom,
    bearing: chapter.map_state.bearing,
    pitch: chapter.map_state.pitch,
  });
  const [basemap, setBasemap] = useState(chapter.map_state.basemap);

  const defaultTimestep = chapter.layer_config.timestep ?? 0;
  const [activeTimestepIndex, setActiveTimestepIndex] =
    useState(defaultTimestep);

  const isTemporalInteractive =
    dataset?.is_temporal && dataset.timesteps.length > 0;

  const handleCameraChange = useCallback((c: CameraState) => {
    setCamera(c);
  }, []);

  const tileCacheRef = useRef<Map<string, TileCacheEntry>>(new Map());

  const { layers, renderMetadata } = useMemo(() => {
    if (connection) {
      const connMap = new Map([[connection.id, connection]]);
      return buildLayersForChapter(
        chapter,
        new Map() as Map<string, Dataset | null>,
        connMap,
        tileCacheRef
      );
    }

    if (!dataset) return { layers: [] };

    const interactiveChapter: Chapter = {
      ...chapter,
      layer_config: {
        ...chapter.layer_config,
        timestep: activeTimestepIndex,
      },
    };
    const datasetMap = new Map<string, Dataset | null>([[dataset.id, dataset]]);
    return buildLayersForChapter(
      interactiveChapter,
      datasetMap,
      undefined,
      tileCacheRef
    );
  }, [dataset, connection, chapter, activeTimestepIndex]);

  return (
    <Box maxW="900px" mx="auto" px={8} py={12}>
      {/* Narrative above map */}
      <Box maxW="800px" mx="auto" mb={6}>
        <Text
          fontSize="10px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="brand.orange"
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
        {dataset || connection ? (
          <UnifiedMap
            camera={camera}
            onCameraChange={handleCameraChange}
            layers={layers}
            basemap={basemap}
            onBasemapChange={setBasemap}
          >
            {renderMetadata && <RenderModeIndicator {...renderMetadata} />}
            {/* Temporal date picker */}
            {isTemporalInteractive && (
              <Box
                position="absolute"
                top={3}
                left="50%"
                transform="translateX(-50%)"
                zIndex={10}
              >
                <CalendarPopover
                  timesteps={dataset!.timesteps}
                  activeIndex={activeTimestepIndex}
                  onIndexChange={setActiveTimestepIndex}
                  cadence={detectCadence(
                    dataset!.timesteps.map((t) => t.datetime)
                  )}
                />
              </Box>
            )}

            {/* Zoom controls */}
            <Flex
              position="absolute"
              top={renderMetadata ? "52px" : 3}
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
                {connection
                  ? connection.name
                  : dataset
                    ? displayName(dataset)
                    : ""}
              </Text>
              {(dataset?.dataset_type === "raster" ||
                (connection?.connection_type === "cog" &&
                  connection?.band_count === 1)) && (
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
