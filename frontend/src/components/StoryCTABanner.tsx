import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { Box, Flex, Text } from "@chakra-ui/react";
import { ArrowRight } from "@phosphor-icons/react";
import {
  transition,
  cardHover,
  cardActive,
  focusRing,
} from "../lib/interactionStyles";
import {
  createStory,
  createChapter,
  DEFAULT_LAYER_CONFIG,
} from "../lib/story/types";
import { createStoryOnServer } from "../lib/story/api";
import type { Dataset, Connection } from "../types";
import { cameraFromBounds } from "../lib/layers";

interface StoryCTABannerProps {
  dataset?: Dataset | null;
  connection?: Connection | null;
}

export function StoryCTABanner({ dataset, connection }: StoryCTABannerProps) {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();

  const handleCreate = useCallback(async () => {
    const bounds = dataset?.bounds ?? connection?.bounds ?? null;
    const cam = bounds ? cameraFromBounds(bounds) : null;
    const mapState = cam
      ? {
          center: [cam.longitude, cam.latitude] as [number, number],
          zoom: cam.zoom,
          pitch: 0,
          bearing: 0,
          basemap: "streets",
        }
      : undefined;

    const proseChapter = createChapter({
      order: 0,
      title: "Chapter 1",
      type: "prose",
      narrative: "",
    });

    const layerConfig = connection
      ? {
          ...DEFAULT_LAYER_CONFIG,
          connection_id: connection.id,
          colormap:
            connection.preferred_colormap ?? DEFAULT_LAYER_CONFIG.colormap,
          ...(connection.preferred_colormap_reversed != null
            ? { colormap_reversed: connection.preferred_colormap_reversed }
            : {}),
        }
      : dataset
        ? {
            ...DEFAULT_LAYER_CONFIG,
            dataset_id: dataset.id,
            colormap:
              dataset.preferred_colormap ?? DEFAULT_LAYER_CONFIG.colormap,
            ...(dataset.preferred_colormap_reversed != null
              ? { colormap_reversed: dataset.preferred_colormap_reversed }
              : {}),
          }
        : DEFAULT_LAYER_CONFIG;

    const mapChapter = createChapter({
      order: 1,
      title: "Chapter 2",
      type: "map",
      layer_config: layerConfig,
      ...(mapState && { map_state: mapState }),
    });

    const seedId = dataset?.id ?? connection?.id ?? "";
    const story = createStory(seedId, {
      chapters: [proseChapter, mapChapter],
    });

    const created = await createStoryOnServer(story);
    navigate(workspacePath(`/story/${created.id}/edit`));
  }, [dataset, connection, navigate, workspacePath]);

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="brand.border"
      borderLeftWidth="3px"
      borderLeftColor="brand.orange"
      borderRadius="8px"
      p={4}
      cursor="pointer"
      onClick={handleCreate}
      transition={transition(200)}
      _hover={{ ...cardHover, borderColor: "brand.orange" }}
      _active={cardActive}
      _focusVisible={focusRing}
    >
      <Text
        fontSize="11px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.textSecondary"
        fontWeight={600}
      >
        What's next
      </Text>
      <Text fontSize="14px" color="brand.brown" fontWeight={700} mt={1}>
        Tell a story with this data
      </Text>
      <Text
        fontSize="12px"
        color="brand.textSecondary"
        mt={1}
        mb={3}
        lineHeight="1.6"
      >
        Add annotations, narrative text, and guided map views to create a
        shareable data story.
      </Text>
      <Flex align="center" gap={1.5}>
        <Text fontSize="12px" color="brand.orange" fontWeight={600}>
          Create story
        </Text>
        <ArrowRight
          size={12}
          weight="bold"
          color="var(--chakra-colors-brand-orange)"
        />
      </Flex>
    </Box>
  );
}
