import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Box, Button, Flex, Text } from "@chakra-ui/react";
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
import { CREATE_MAP_INTENT, CREATE_STORY_INTENT } from "../lib/creationIntents";
import {
  ResourceCollection,
  ResourceCollectionCell,
  ResourceCollectionRow,
} from "../components/ui/ResourceCollection";
import { ResourceThumbnail } from "../components/ui/ResourceThumbnail";

const STORY_COLUMNS = "minmax(0, 1fr) 100px 100px 100px 140px 80px";

function storyThumbnailUrl(story: Story): string | null {
  const imageChapter = story.chapters.find(
    (chapter) => chapter.type === "image"
  );
  return imageChapter?.type === "image"
    ? imageChapter.image.thumbnail_url || imageChapter.image.url
    : null;
}

export default function StoriesPage() {
  const { workspacePath } = useWorkspace();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Story | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    setDeleteError(null);
    setDeletingId(story.id);
    try {
      await deleteStoryFromServer(story.id);
      setStories((prev) => prev.filter((s) => s.id !== story.id));
      setPendingDelete(null);
    } catch {
      setDeleteError(
        "Couldn’t delete this story. Check your connection and try again."
      );
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
              <Link to={workspacePath(CREATE_MAP_INTENT.path)}>
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="brand.border"
                  color="brand.brown"
                >
                  {CREATE_MAP_INTENT.label}
                </Button>
              </Link>
              <Link to={workspacePath(CREATE_STORY_INTENT.path)}>
                <Button size="sm">{CREATE_STORY_INTENT.label}</Button>
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
            description={CREATE_STORY_INTENT.description}
            action={
              <Button asChild size="sm">
                <Link to={workspacePath(CREATE_STORY_INTENT.path)}>
                  {CREATE_STORY_INTENT.label}
                </Link>
              </Button>
            }
          />
        ) : (
          <ResourceCollection
            columns={STORY_COLUMNS}
            headers={["Name", "Status", "Chapters", "Updated", "Expires", ""]}
          >
            {userStories.map((story) => (
              <ResourceCollectionRow key={story.id} columns={STORY_COLUMNS}>
                <ResourceCollectionCell label="Name" primary>
                  <Flex align="center" gap={2}>
                    <ResourceThumbnail
                      src={storyThumbnailUrl(story)}
                      alt={story.title}
                    />
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
                      <Badge size="sm" bg="brand.bgSubtle" color="brand.brown">
                        Example
                      </Badge>
                    )}
                  </Flex>
                </ResourceCollectionCell>
                <ResourceCollectionCell label="Status">
                  <Text
                    fontSize="xs"
                    fontWeight={600}
                    textTransform="uppercase"
                    color={story.published ? "green.600" : "gray.500"}
                  >
                    {story.published ? "Published" : "Draft"}
                  </Text>
                </ResourceCollectionCell>
                <ResourceCollectionCell label="Chapters">
                  <Text fontSize="sm" color="gray.600">
                    {story.chapters.length}
                  </Text>
                </ResourceCollectionCell>
                <ResourceCollectionCell label="Updated">
                  <Text fontSize="sm" color="gray.600">
                    {story.updated_at ? timeAgo(story.updated_at) : "—"}
                  </Text>
                </ResourceCollectionCell>
                <ResourceCollectionCell label="Expires">
                  {story.expires_at ? (
                    <ExpiryBadge expiresAt={story.expires_at} />
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      —
                    </Text>
                  )}
                </ResourceCollectionCell>
                <ResourceCollectionCell label="Actions">
                  <Button
                    size="xs"
                    variant="ghost"
                    color="status.danger.fg"
                    _hover={{ bg: "status.danger.subtle" }}
                    loading={deletingId === story.id}
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(story);
                    }}
                  >
                    Delete
                  </Button>
                </ResourceCollectionCell>
              </ResourceCollectionRow>
            ))}
          </ResourceCollection>
        )}
      </Box>
      <ConfirmDialog
        open={pendingDelete != null}
        title={"Delete “" + (pendingDelete?.title ?? "story") + "”?"}
        description="This permanently removes the story and cannot be undone."
        error={deleteError}
        loading={pendingDelete != null && deletingId === pendingDelete.id}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
      />
      <Footer />
    </Flex>
  );
}
