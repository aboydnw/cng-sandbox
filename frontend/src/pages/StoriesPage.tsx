import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Box, Button, Flex, Table, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ExpiryBadge } from "../components/ExpiryBadge";
import { useWorkspace } from "../hooks/useWorkspace";
import { listStoriesFromServer, deleteStoryFromServer } from "../lib/story/api";
import { timeAgo } from "../utils/format";
import type { Story } from "../lib/story/types";
import { StatePanel } from "../components/ui/StatePanel";
import { CollectionSkeleton } from "../components/ui/CollectionSkeleton";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export default function StoriesPage() {
  const { workspacePath } = useWorkspace();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Story | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadStories = useCallback(() => {
    const requestId = ++loadRequestIdRef.current;
    const isCurrent = () => requestId === loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    listStoriesFromServer()
      .then((data) => {
        if (isCurrent()) setStories(data);
      })
      .catch((err) => {
        if (isCurrent()) setError((err as Error).message);
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadStories();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadStories]);

  const handleDelete = useCallback(async (story: Story) => {
    setDeletingId(story.id);
    try {
      await deleteStoryFromServer(story.id);
      setStories((prev) => prev.filter((s) => s.id !== story.id));
      setPendingDelete(null);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const userStories = stories.filter((s) => !s.is_example);

  return (
    <Flex direction="column" minH="100vh" bg="bg">
      <Header />
      <Box
        as="main"
        id="main-content"
        maxW="960px"
        mx="auto"
        py={8}
        px={4}
        w="100%"
      >
        <PageHeader
          title="Stories"
          description="Build and publish narratives that combine maps, data, images, charts, and video."
          actions={
            <>
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
                <Button size="sm">New story</Button>
              </Link>
            </>
          }
        />

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
          <Box overflowX="auto" pb={2}>
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
                        onClick={() => setPendingDelete(story)}
                      >
                        Delete
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Box>
      <ConfirmDialog
        open={pendingDelete != null}
        title={"Delete “" + (pendingDelete?.title ?? "story") + "”?"}
        description="This permanently removes the story and cannot be undone."
        loading={pendingDelete != null && deletingId === pendingDelete.id}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
      />
      <Footer />
    </Flex>
  );
}
