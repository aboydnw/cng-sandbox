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
      bg="linear-gradient(135deg, rgba(207,63,2,0.15), transparent)"
      border="1px solid"
      borderColor="brand.orange"
      borderRadius="md"
      p={4}
    >
      <Text fontSize="xs" color="brand.orange" textTransform="uppercase" letterSpacing="wide" fontWeight="bold">
        What's next
      </Text>
      <Text fontSize="md" color="white" fontWeight="bold" mt={1}>
        Tell a story with this data
      </Text>
      <Text fontSize="xs" color="gray.400" mt={1} lineHeight="tall">
        Add annotations, narrative text, and guided map views to create a shareable data story.
      </Text>
      <Button mt={3} size="sm" bg="brand.orange" color="white" onClick={handleCreate}>
        Create story →
      </Button>
    </Box>
  );
}
