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
      bg="white"
      border="2px solid"
      borderColor="brand.border"
      borderRadius="8px"
      p={4}
      cursor="pointer"
      onClick={handleCreate}
      transition="all 200ms ease-out"
      _hover={{ borderColor: "brand.orange", shadow: "md" }}
    >
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.orange" fontWeight={600}>
        What's next
      </Text>
      <Text fontSize="15px" color="brand.brown" fontWeight={700} mt={1}>
        Tell a story with this data
      </Text>
      <Text fontSize="12px" color="brand.textSecondary" mt={1} lineHeight="1.6">
        Add annotations, narrative text, and guided map views to create a shareable data story.
      </Text>
      <Text mt={3} fontSize="13px" color="brand.orange" fontWeight={600}>
        Create story →
      </Text>
    </Box>
  );
}
