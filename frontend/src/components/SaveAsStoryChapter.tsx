import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Flex, Menu, Portal, Text } from "@chakra-ui/react";
import { CaretDown } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  createStory,
  createProseChapter,
  createMapChapter,
  DEFAULT_LAYER_CONFIG,
} from "../lib/story/types";
import {
  createStoryOnServer,
  getStoryFromServer,
  listStoriesFromServer,
  saveStoryToServer,
} from "../lib/story/api";
import type { Story } from "../lib/story/types";
import type { Dataset, Connection } from "../types";
import { cameraFromBounds } from "../lib/layers";

interface SaveAsStoryChapterProps {
  dataset?: Dataset | null;
  connection?: Connection | null;
}

function buildMapChapter(
  order: number,
  dataset: Dataset | null | undefined,
  connection: Connection | null | undefined
) {
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
          colormap: dataset.preferred_colormap ?? DEFAULT_LAYER_CONFIG.colormap,
          ...(dataset.preferred_colormap_reversed != null
            ? { colormap_reversed: dataset.preferred_colormap_reversed }
            : {}),
        }
      : DEFAULT_LAYER_CONFIG;
  return createMapChapter({
    order,
    title: `Chapter ${order + 1}`,
    layer_config: layerConfig,
    ...(mapState && { map_state: mapState }),
  });
}

export function SaveAsStoryChapter({
  dataset,
  connection,
}: SaveAsStoryChapterProps) {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const [stories, setStories] = useState<Story[]>([]);
  const inFlightRef = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listStoriesFromServer()
      .then((rows) => setStories(rows.filter((s) => !s.is_example)))
      .catch(() => {});
  }, []);

  const handleNew = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const proseChapter = createProseChapter({
        order: 0,
        title: "Chapter 1",
        narrative: "",
      });
      const mapChapter = buildMapChapter(1, dataset, connection);
      const seedId = dataset?.id ?? connection?.id ?? "";
      const story = createStory(seedId, {
        chapters: [proseChapter, mapChapter],
      });
      const created = await createStoryOnServer(story);
      navigate(workspacePath(`/story/${created.id}/edit`));
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [dataset, connection, navigate, workspacePath]);

  const handleAppend = useCallback(
    async (storyId: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(true);
      try {
        const story = await getStoryFromServer(storyId);
        if (!story) return;
        const nextChapter = buildMapChapter(
          story.chapters.length,
          dataset,
          connection
        );
        const updated: Story = {
          ...story,
          chapters: [...story.chapters, nextChapter],
        };
        await saveStoryToServer(updated);
        navigate(workspacePath(`/story/${storyId}/edit`));
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
    },
    [dataset, connection, navigate, workspacePath]
  );

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box
          asChild
          bg="white"
          border="1px solid"
          borderColor="brand.border"
          borderLeftWidth="3px"
          borderLeftColor="brand.orange"
          borderRadius="8px"
          cursor={busy ? "wait" : "pointer"}
          opacity={busy ? 0.7 : 1}
          _hover={busy ? undefined : { borderColor: "brand.orange" }}
          transition="border-color 200ms"
        >
          <button
            type="button"
            disabled={busy}
            aria-label="Save as story chapter"
            style={{
              width: "100%",
              padding: "1rem",
              textAlign: "left",
              font: "inherit",
              background: "transparent",
            }}
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
              Save as story chapter
            </Text>
            <Flex align="center" gap={1.5} mt={2}>
              <Text fontSize="12px" color="brand.orange" fontWeight={600}>
                {busy ? "Saving…" : "Pick a story"}
              </Text>
              <CaretDown
                size={10}
                weight="bold"
                color="var(--chakra-colors-brand-orange)"
              />
            </Flex>
          </button>
        </Box>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            bg="white"
            border="1px solid"
            borderColor="brand.border"
            borderRadius="8px"
            boxShadow="md"
            py={1}
            minW="240px"
            fontSize="sm"
          >
            <Menu.Item
              value="new-story"
              onClick={handleNew}
              px={3}
              py={2}
              cursor="pointer"
              _hover={{ bg: "brand.bgSubtle" }}
            >
              + New story from this
            </Menu.Item>
            {stories.length > 0 && (
              <Menu.Separator borderColor="brand.border" my={1} />
            )}
            {stories.map((s) => (
              <Menu.Item
                key={s.id}
                value={`append-${s.id}`}
                onClick={() => handleAppend(s.id)}
                px={3}
                py={2}
                cursor="pointer"
                _hover={{ bg: "brand.bgSubtle" }}
              >
                {s.title || "Untitled story"}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
