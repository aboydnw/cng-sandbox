import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowRight } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ExampleStoryCard } from "../components/ExampleStoryCard";
import { useWorkspace } from "../hooks/useWorkspace";
import { forkStoryOnServer } from "../lib/story/api";
import { toaster } from "../lib/toaster";
import { inferDataType } from "../lib/story/dataType";
import type { Story } from "../lib/story/types";
import { displayName } from "../utils/dataset";
import { timeAgo } from "../utils/format";
import { CollectionSkeleton } from "../components/ui/CollectionSkeleton";
import { PageHeader } from "../components/PageHeader";
import { CREATE_MAP_INTENT, CREATE_STORY_INTENT } from "../lib/creationIntents";
import {
  useWorkspaceDatasets,
  useWorkspaceStories,
} from "../hooks/useWorkspaceLibrary";

function sortByUpdated<T extends { updated_at?: string; created_at?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

export default function WorkspaceHomePage() {
  const { workspacePath } = useWorkspace();
  const storiesResource = useWorkspaceStories();
  const datasetsResource = useWorkspaceDatasets();
  const stories = storiesResource.data;
  const datasets = datasetsResource.data;

  const navigate = useNavigate();
  const [cloningId, setCloningId] = useState<string | null>(null);
  const cloneInFlightRef = useRef(false);

  const userStories = stories.filter((s) => !s.is_example);
  const exampleStories = stories.filter((s) => s.is_example);
  const userDatasets = datasets.filter((d) => !d.is_example);
  const recentStories = sortByUpdated(userStories).slice(0, 3);
  const recentDatasets = sortByUpdated(userDatasets).slice(0, 3);
  const loading =
    stories.length === 0 &&
    datasets.length === 0 &&
    (storiesResource.status === "loading" ||
      datasetsResource.status === "loading");
  const resourceError = [storiesResource.error, datasetsResource.error]
    .filter(Boolean)
    .join("; ");
  const allUnavailable =
    storiesResource.status === "error" && datasetsResource.status === "error";
  const isEmpty =
    !loading &&
    !resourceError &&
    userStories.length === 0 &&
    userDatasets.length === 0;

  const handleCloneExample = useCallback(
    async (story: Story) => {
      if (cloneInFlightRef.current) return;
      cloneInFlightRef.current = true;
      setCloningId(story.id);
      try {
        const forked = await forkStoryOnServer(story.id);
        navigate(workspacePath(`/story/${forked.id}/edit`));
      } catch (err) {
        cloneInFlightRef.current = false;
        setCloningId(null);
        toaster.create({
          title: "Failed to open example story",
          description: (err as Error).message,
          type: "error",
        });
      }
    },
    [navigate, workspacePath]
  );

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
        flex="1"
      >
        <PageHeader
          title="Your workspace"
          description="Return to a recent map or story, or start something new."
          actions={
            <>
              <Button asChild size="sm" variant="outline">
                <Link to={workspacePath(CREATE_MAP_INTENT.path)}>
                  {CREATE_MAP_INTENT.label}
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to={workspacePath(CREATE_STORY_INTENT.path)}>
                  {CREATE_STORY_INTENT.label}
                </Link>
              </Button>
            </>
          }
        />

        {resourceError && (
          <Flex
            role="alert"
            mb={6}
            p={4}
            gap={4}
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
            bg="status.danger.subtle"
            color="status.danger.fg"
            borderRadius="md"
          >
            <Box flex="1">
              <Text fontWeight={600}>
                {allUnavailable
                  ? "Couldn’t load your workspace"
                  : "Some workspace content couldn’t load"}
              </Text>
              <Text fontSize="sm">{resourceError}</Text>
            </Box>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                storiesResource.retry();
                datasetsResource.retry();
              }}
            >
              Try again
            </Button>
          </Flex>
        )}

        {loading ? (
          <CollectionSkeleton rows={4} />
        ) : allUnavailable ? null : isEmpty ? (
          <Box>
            <Heading textStyle="sectionTitle" color="fg" mb={2}>
              Start your first map or story
            </Heading>
            <Text fontSize="sm" color="gray.500" mb={6}>
              Create a map with your own data, or open an example story and make
              it yours.
            </Text>
            {exampleStories.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                No examples available right now.
              </Text>
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
                gap={3}
              >
                {exampleStories.slice(0, 3).map((story) => (
                  <ExampleStoryCard
                    key={story.id}
                    title={story.title}
                    chapterCount={story.chapters.length}
                    dataType={inferDataType(story)}
                    onClick={() => handleCloneExample(story)}
                    loading={cloningId === story.id}
                    compact={false}
                  />
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <>
            <Section
              title="Recent stories"
              viewAllLabel="View all stories"
              viewAllHref={workspacePath("/stories")}
              emptyText="No stories yet."
            >
              {recentStories.map((s) => (
                <Row
                  key={s.id}
                  title={s.title}
                  href={workspacePath(`/story/${s.id}/edit`)}
                  meta={s.updated_at ? timeAgo(s.updated_at) : "—"}
                />
              ))}
            </Section>

            <Box my={8} h="1px" bg="brand.border" />

            <Section
              title="Recent data"
              viewAllLabel="View all data"
              viewAllHref={workspacePath("/data")}
              emptyText="No datasets yet."
            >
              {recentDatasets.map((d) => (
                <Row
                  key={d.id}
                  title={displayName(d)}
                  href={workspacePath(`/map/${d.id}`)}
                  meta={d.created_at ? timeAgo(d.created_at) : "—"}
                />
              ))}
            </Section>

            {exampleStories.length > 0 && (
              <>
                <Box my={8} h="1px" bg="brand.border" />
                <Box>
                  <Heading size="md" color="gray.700" mb={1}>
                    Example stories
                  </Heading>
                  <Text fontSize="sm" color="gray.500" mb={3}>
                    Curated stories shared with every workspace. Click to open a
                    copy you can edit.
                  </Text>
                  <Box
                    display="grid"
                    gridTemplateColumns={{
                      base: "1fr",
                      md: "repeat(3, 1fr)",
                    }}
                    gap={3}
                  >
                    {exampleStories.slice(0, 3).map((story) => (
                      <ExampleStoryCard
                        key={story.id}
                        title={story.title}
                        chapterCount={story.chapters.length}
                        dataType={inferDataType(story)}
                        onClick={() => handleCloneExample(story)}
                        loading={cloningId === story.id}
                        compact
                      />
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </>
        )}
      </Box>
      <Footer />
    </Flex>
  );
}

interface SectionProps {
  title: string;
  viewAllLabel: string;
  viewAllHref: string;
  emptyText: string;
  children: React.ReactNode;
}

function Section({
  title,
  viewAllLabel,
  viewAllHref,
  emptyText,
  children,
}: SectionProps) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : !!children;
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3}>
        <Heading size="md" color="gray.700">
          {title}
        </Heading>
      </Flex>
      {hasChildren ? (
        <Box>{children}</Box>
      ) : (
        <Text fontSize="sm" color="gray.500" mb={3}>
          {emptyText}
        </Text>
      )}
      <Link to={viewAllHref} style={{ textDecoration: "none" }}>
        <Flex
          align="center"
          gap={1}
          mt={3}
          fontSize="sm"
          color="brand.orange"
          fontWeight={500}
        >
          {viewAllLabel} <ArrowRight size={14} />
        </Flex>
      </Link>
    </Box>
  );
}

interface RowProps {
  title: string;
  href: string;
  meta: string;
}

function Row({ title, href, meta }: RowProps) {
  return (
    <Link to={href} style={{ textDecoration: "none" }}>
      <Flex
        justify="space-between"
        align="center"
        py={2}
        borderBottom="1px solid"
        borderColor="brand.border"
        _hover={{ bg: "brand.bgSubtle" }}
      >
        <Text color="brand.orange" fontWeight={500} truncate title={title}>
          {title}
        </Text>
        <Text fontSize="sm" color="gray.600">
          {meta}
        </Text>
      </Flex>
    </Link>
  );
}
