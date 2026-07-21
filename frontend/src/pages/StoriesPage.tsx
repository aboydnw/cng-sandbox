import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Table,
  Text,
} from "@chakra-ui/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ExpiryBadge } from "../components/ExpiryBadge";
import { useWorkspace } from "../hooks/useWorkspace";
import { listStoriesFromServer, deleteStoryFromServer } from "../lib/story/api";
import { timeAgo } from "../utils/format";
import type { Story } from "../lib/story/types";
import { StatePanel } from "../components/ui/StatePanel";
import { CollectionSkeleton } from "../components/ui/CollectionSkeleton";

export default function StoriesPage() {
  const { workspacePath } = useWorkspace();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadStories = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listStoriesFromServer()
      .then((data) => {
        if (!cancelled) setStories(data);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadStories(), [loadStories]);

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

  const userStories = stories.filter((s) => !s.is_example);

  return (
    <Flex direction="column" minH="100vh" bg="bg">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4} w="100%">
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="fg">
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
          <CollectionSkeleton rows={4} />
        ) : error ? (
          <StatePanel
            tone="danger"
            title="Couldn’t load your stories"
            description={error}
            actionLabel="Try again"
            onAction={loadStories}
          />
        ) : userStories.length === 0 ? (
          <StatePanel
            title="No stories yet"
            description="Create a story to combine maps, narrative, charts, images, and video."
            action={
              <Button asChild size="sm">
                <Link to={workspacePath("/story/new")}>Create a story</Link>
              </Button>
            }
          />
        ) : (
          <Table.Root size="sm" tableLayout="fixed">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader w="100px">Status</Table.ColumnHeader>
                <Table.ColumnHeader w="100px">Chapters</Table.ColumnHeader>
                <Table.ColumnHeader w="100px">Updated</Table.ColumnHeader>
                <Table.ColumnHeader w="140px">Expires</Table.ColumnHeader>
                <Table.ColumnHeader w="80px" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {userStories.map((story) => (
                <Table.Row key={story.id}>
                  <Table.Cell>
                    <Flex align="center" gap={2}>
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
                      {story.is_example_copy && (
                        <Badge
                          size="sm"
                          bg="brand.bgSubtle"
                          color="brand.brown"
                        >
                          Example
                        </Badge>
                      )}
                    </Flex>
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
                    {story.expires_at ? (
                      <ExpiryBadge expiresAt={story.expires_at} />
                    ) : (
                      <Text fontSize="sm" color="gray.500">
                        —
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="xs"
                      variant="ghost"
                      color="status.danger.fg"
                      _hover={{ bg: "status.danger.subtle" }}
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
      <Footer />
    </Flex>
  );
}
