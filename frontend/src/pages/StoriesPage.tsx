import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Box, Button, Flex, Heading, Table, Text } from "@chakra-ui/react";
import { SpinnerGap } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  listStoriesFromServer,
  deleteStoryFromServer,
  forkStoryOnServer,
} from "../lib/story/api";
import type { Story } from "../lib/story/types";
import { ExampleStoryCard } from "../components/ExampleStoryCard";

function inferDataType(story: Story): string {
  const types = new Set<string>();
  for (const ch of story.chapters) {
    const t = (ch as { type?: string }).type;
    if (t === "map") types.add("Map");
    if (t === "chart") types.add("Chart");
    if (t === "image") types.add("Image");
    if (t === "video") types.add("Video");
    if (t === "prose") types.add("Prose");
  }
  if (types.size === 0) return "Story";
  if (types.size === 1) return Array.from(types)[0];
  return "Mixed";
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function StoriesPage() {
  const { workspacePath } = useWorkspace();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  const handleCloneExample = useCallback(
    async (story: Story) => {
      if (cloningId) return;
      setCloningId(story.id);
      try {
        const forked = await forkStoryOnServer(story.id);
        navigate(workspacePath(`/story/${forked.id}/edit`));
      } catch {
        setCloningId(null);
      }
    },
    [cloningId, navigate, workspacePath]
  );

  useEffect(() => {
    listStoriesFromServer()
      .then((data) => {
        setStories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(async (story: Story) => {
    if (!window.confirm(`Delete "${story.title}"?`)) return;
    setDeletingId(story.id);
    try {
      await deleteStoryFromServer(story.id);
      setStories((prev) => prev.filter((s) => s.id !== story.id));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const exampleStories = stories.filter((s) => s.is_example);
  const userStories = stories.filter((s) => !s.is_example);

  return (
    <Flex direction="column" minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4} w="100%">
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="gray.800">
            Your stories
          </Heading>
          <Flex gap={2}>
            <Link to={workspacePath("/quick-map")}>
              <Button
                size="sm"
                variant="outline"
                borderColor="brand.border"
                color="brand.brown"
              >
                Quick map
              </Button>
            </Link>
            <Link to={workspacePath("/story/new")}>
              <Button size="sm" colorScheme="orange">
                New story
              </Button>
            </Link>
          </Flex>
        </Flex>

        {loading ? (
          <Flex justify="center" py={12}>
            <SpinnerGap
              size={32}
              style={{ animation: "spin 1s linear infinite" }}
            />
          </Flex>
        ) : userStories.length === 0 ? (
          <Text color="gray.500" fontSize="sm" mb={2}>
            No stories yet — start one or browse the example stories below.
          </Text>
        ) : (
          <Table.Root size="sm" tableLayout="fixed">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader w="100px">Status</Table.ColumnHeader>
                <Table.ColumnHeader w="100px">Chapters</Table.ColumnHeader>
                <Table.ColumnHeader w="100px">Updated</Table.ColumnHeader>
                <Table.ColumnHeader w="80px" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {userStories.map((story) => (
                <Table.Row key={story.id}>
                  <Table.Cell>
                    <Link to={workspacePath(`/story/${story.id}/edit`)}>
                      <Text
                        color="brand.orange"
                        _hover={{ textDecoration: "underline" }}
                        fontWeight={500}
                        truncate
                        title={story.title}
                      >
                        {story.title}
                      </Text>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Text
                      fontSize="xs"
                      fontWeight={600}
                      textTransform="uppercase"
                      color={story.published ? "green.600" : "gray.500"}
                    >
                      {story.published ? "Published" : "Draft"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" color="gray.600">
                      {story.chapters.length}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" color="gray.600">
                      {story.updated_at ? timeAgo(story.updated_at) : "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      loading={deletingId === story.id}
                      onClick={() => handleDelete(story)}
                    >
                      Delete
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}

        <Box my={8} h="1px" bg="brand.border" />

        <Heading size="md" color="gray.700" mb={3}>
          Example stories
        </Heading>
        <Text fontSize="13px" color="gray.500" mb={3}>
          Curated stories shared with every workspace.
        </Text>
        {exampleStories.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            No example stories available.
          </Text>
        ) : (
          <Box
            display="grid"
            gridTemplateColumns={{
              base: "1fr",
              md: "repeat(3, 1fr)",
            }}
            gap={3}
          >
            {exampleStories.map((story) => (
              <ExampleStoryCard
                key={story.id}
                title={story.title}
                chapterCount={story.chapters.length}
                dataType={inferDataType(story)}
                onClick={() => handleCloneExample(story)}
                loading={cloningId === story.id}
                compact={userStories.length > 0}
              />
            ))}
          </Box>
        )}
      </Box>
      <Footer />
    </Flex>
  );
}
