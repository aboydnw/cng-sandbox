import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowLeft, SpinnerGap } from "@phosphor-icons/react";
import { StoryRenderer } from "../components/StoryRenderer";

import { getStoryFromServer, migrateStory } from "../lib/story";
import { BugReportLink } from "../components/BugReportLink";
import type { Story } from "../lib/story";
import type { Dataset } from "../types";
import { config } from "../config";

export default function StoryReaderPage({
  embed = false,
}: {
  embed?: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const { workspacePath } = useWorkspace();
  const [story, setStory] = useState<Story | null>(null);
  const [datasetMap, setDatasetMap] = useState<Map<string, Dataset | null>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function loadStory() {
      try {
        const loaded = await getStoryFromServer(id!);
        if (!loaded) {
          setError("Story not found");
          setLoading(false);
          return;
        }
        const migrated = migrateStory(
          loaded as unknown as Record<string, unknown>
        );
        setStory(migrated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load story");
        setLoading(false);
      }
    }
    loadStory();
  }, [id]);

  useEffect(() => {
    if (!story) return;
    async function fetchDatasets() {
      const ids = story!.dataset_ids ?? [story!.dataset_id];
      const uniqueIds = [...new Set(ids)];
      const entries = await Promise.all(
        uniqueIds.map(async (dsId) => {
          try {
            const resp = await fetch(`${config.apiBase}/api/datasets/${dsId}`);
            if (!resp.ok) return [dsId, null] as const;
            return [dsId, (await resp.json()) as Dataset] as const;
          } catch {
            return [dsId, null] as const;
          }
        })
      );
      setDatasetMap(new Map(entries));
      setLoading(false);
    }
    fetchDatasets();
  }, [story]);

  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center">
        <SpinnerGap
          size={32}
          style={{ animation: "spin 1s linear infinite" }}
        />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex
        h="100vh"
        direction="column"
        align="center"
        justify="center"
        bg="white"
        gap={4}
      >
        <Text color="gray.600" fontSize="lg">
          {error}
        </Text>
        <Link to={workspacePath("/")}>
          <Text color="brand.orange" fontWeight={600}>
            <Flex align="center" gap={1.5}>
              <ArrowLeft size={14} /> Back to sandbox
            </Flex>
          </Text>
        </Link>
      </Flex>
    );
  }

  if (!story) return null;

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {!embed && (
        <Flex
          h="48px"
          px={5}
          align="center"
          borderBottom="1px solid"
          borderColor="gray.200"
          bg="white"
          flexShrink={0}
        >
          <Heading size="sm" fontWeight={600} color="gray.800">
            {story.title}
          </Heading>
          <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
          <Text ml="auto" fontSize="xs" color="gray.500">
            Made with CNG Sandbox
          </Text>
        </Flex>
      )}

      <Box flex={1} overflowY="auto">
        <StoryRenderer story={story} datasetMap={datasetMap} />
      </Box>
    </Box>
  );
}
