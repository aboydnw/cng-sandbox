import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Flex, Heading, Table, Text } from "@chakra-ui/react";
import { SpinnerGap } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  listStoriesFromServer,
  deleteStoryFromServer,
} from "../lib/story/api";
import type { Story } from "../lib/story/types";

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
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    <Box minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4}>
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="gray.800">
            Stories
          </Heading>
          <Link to={workspacePath("/story/new")}>
            <Button size="sm" colorScheme="orange">
              New story
            </Button>
          </Link>
        </Flex>

        {exampleStories.length > 0 && (
          <Box mb={8}>
            <Heading size="md" color="gray.700" mb={3}>
              Example stories
            </Heading>
            <Text fontSize="13px" color="gray.500" mb={3}>
              Curated stories shared with every workspace.
            </Text>
            <Table.Root size="sm" tableLayout="fixed">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader w="100px">Chapters</Table.ColumnHeader>
                  <Table.ColumnHeader w="100px">Updated</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {exampleStories.map((story) => (
                  <Table.Row key={story.id}>
                    <Table.Cell>
                      <Link to={workspacePath(`/story/${story.id}`)}>
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
                      <Text fontSize="sm" color="gray.600">
                        {story.chapters.length}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" color="gray.600">
                        {story.updated_at ? timeAgo(story.updated_at) : "—"}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}

        <Heading size="md" color="gray.700" mb={3}>
          Your stories
        </Heading>

        {loading ? (
          <Flex justify="center" py={12}>
            <SpinnerGap size={32} style={{ animation: "spin 1s linear infinite" }} />
          </Flex>
        ) : userStories.length === 0 ? (
          <Flex direction="column" align="center" py={12} gap={3} color="gray.500">
            <Text>No stories yet.</Text>
            <Link to={workspacePath("/story/new")}>
              <Text color="brand.orange" fontWeight={600}>
                Create your first story
              </Text>
            </Link>
          </Flex>
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
      </Box>
    </Box>
  );
}
