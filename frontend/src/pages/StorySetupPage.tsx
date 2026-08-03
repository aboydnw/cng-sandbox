import { useMemo, useState } from "react";
import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { Article, ImageSquare, MapTrifold } from "@phosphor-icons/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { PageHeader } from "../components/PageHeader";
import { useWorkspace } from "../hooks/useWorkspace";
import { useWorkspaceDatasets } from "../hooks/useWorkspaceLibrary";
import { cameraFromBounds } from "../lib/layers";
import {
  createImageChapter,
  createMapChapter,
  createStory,
  createStoryOnServer,
  isMapBoundChapter,
} from "../lib/story";
import { displayName } from "../utils/dataset";

type StoryTemplate = "map" | "media" | "blank";

const templates = [
  {
    id: "map" as const,
    title: "Map-led story",
    description: "Guide readers through a map with narrative chapters.",
    icon: MapTrifold,
  },
  {
    id: "media" as const,
    title: "Media story",
    description: "Begin with an image, then add maps, video, or charts.",
    icon: ImageSquare,
  },
  {
    id: "blank" as const,
    title: "Blank story",
    description: "Start with writing and shape the structure yourself.",
    icon: Article,
  },
];

export default function StorySetupPage() {
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get("dataset");
  const datasets = useWorkspaceDatasets();
  const dataset = useMemo(
    () => datasets.data.find((item) => item.id === datasetId),
    [datasets.data, datasetId]
  );
  const [creating, setCreating] = useState<StoryTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();

  async function chooseTemplate(template: StoryTemplate) {
    setCreating(template);
    setError(null);
    try {
      const story =
        template === "map"
          ? datasetId
            ? createStory(datasetId, {
                preferredColormap: dataset?.preferred_colormap ?? null,
                preferredColormapReversed:
                  dataset?.preferred_colormap_reversed ?? null,
              })
            : createStory(null, {
                chapters: [createMapChapter({ order: 0, title: "Chapter 1" })],
              })
          : template === "media"
            ? createStory(null, {
                chapters: [
                  createImageChapter({ order: 0, title: "Chapter 1" }),
                ],
              })
            : createStory();

      const firstChapter = story.chapters[0];
      if (
        template === "map" &&
        dataset?.bounds &&
        firstChapter &&
        isMapBoundChapter(firstChapter)
      ) {
        const camera = cameraFromBounds(dataset.bounds);
        firstChapter.map_state = {
          ...firstChapter.map_state,
          center: [camera.longitude, camera.latitude],
          zoom: camera.zoom,
        };
      }

      const saved = await createStoryOnServer(story);
      navigate(workspacePath(`/story/${saved.id}/edit`), { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t create the story"
      );
      setCreating(null);
    }
  }

  return (
    <Flex direction="column" minH="100vh" bg="bg">
      <Header />
      <Box
        as="main"
        id="main-content"
        maxW="960px"
        mx="auto"
        px={4}
        py={{ base: 6, md: 10 }}
        w="100%"
        flex="1"
      >
        <PageHeader
          title="Create a story"
          description={
            dataset
              ? `Choose how to begin with ${displayName(dataset)}.`
              : "Choose a starting point. You can add any chapter type later."
          }
        />
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
          gap={4}
        >
          {templates.map((template) => {
            const Icon = template.icon;
            const recommended = datasetId && template.id === "map";
            return (
              <Flex
                key={template.id}
                as="section"
                direction="column"
                align="start"
                p={5}
                minH="230px"
                bg="white"
                border="1px solid"
                borderColor={recommended ? "brand.orange" : "brand.border"}
                borderRadius="lg"
              >
                <Flex
                  w={10}
                  h={10}
                  align="center"
                  justify="center"
                  bg="brand.bgSubtle"
                  color="brand.orange"
                  borderRadius="md"
                  mb={5}
                >
                  <Icon size={22} />
                </Flex>
                <Heading size="md" color="fg" mb={2}>
                  {template.title}
                </Heading>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.6" mb={5}>
                  {template.description}
                </Text>
                <Button
                  mt="auto"
                  size="sm"
                  variant={recommended ? "solid" : "outline"}
                  loading={creating === template.id}
                  disabled={creating !== null}
                  onClick={() => void chooseTemplate(template.id)}
                >
                  {recommended
                    ? "Start with this map"
                    : `Choose ${template.title}`}
                </Button>
              </Flex>
            );
          })}
        </Box>
        {error && (
          <Text role="alert" mt={4} fontSize="sm" color="status.danger.fg">
            {error}
          </Text>
        )}
      </Box>
      <Footer />
    </Flex>
  );
}
