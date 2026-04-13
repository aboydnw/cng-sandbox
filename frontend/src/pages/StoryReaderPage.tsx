import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useOptionalWorkspace } from "../hooks/useWorkspace";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight, SpinnerGap } from "@phosphor-icons/react";
import { StoryRenderer } from "../components/StoryRenderer";

import { getStoryFromServer, migrateStory } from "../lib/story";
import { BugReportLink } from "../components/BugReportLink";
import type { Story } from "../lib/story";
import type { Connection, Dataset } from "../types";
import { connectionsApi } from "../lib/api";
import { config } from "../config";

export default function StoryReaderPage({
  embed = false,
}: {
  embed?: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const workspace = useOptionalWorkspace();
  const workspacePath = workspace?.workspacePath ?? ((p: string) => p);
  const shared = !workspace;
  const [story, setStory] = useState<Story | null>(null);
  const [datasetMap, setDatasetMap] = useState<Map<string, Dataset | null>>(
    new Map()
  );
  const [connectionMap, setConnectionMap] = useState<Map<string, Connection>>(
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
    async function fetchData() {
      // Fetch datasets
      const dsIds = story!.dataset_ids ?? [story!.dataset_id];
      const uniqueDsIds = [...new Set(dsIds)].filter(Boolean);
      const dsEntries = await Promise.all(
        uniqueDsIds.map(async (dsId) => {
          try {
            const resp = await fetch(`${config.apiBase}/api/datasets/${dsId}`);
            if (!resp.ok) return [dsId, null] as const;
            return [dsId, (await resp.json()) as Dataset] as const;
          } catch {
            return [dsId, null] as const;
          }
        })
      );
      setDatasetMap(new Map(dsEntries));

      // Fetch connections referenced by chapters
      const connIds = [
        ...new Set(
          story!.chapters
            .map((ch) => ch.layer_config?.connection_id)
            .filter(Boolean) as string[]
        ),
      ];
      if (connIds.length > 0) {
        const connEntries = await Promise.all(
          connIds.map(async (cid) => {
            try {
              const conn = await connectionsApi.get(cid);
              return [cid, conn] as [string, Connection];
            } catch {
              return null;
            }
          })
        );
        const validEntries = connEntries.filter(Boolean) as [
          string,
          Connection,
        ][];
        setConnectionMap(new Map(validEntries));
      }

      setLoading(false);
    }
    fetchData();
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
          {shared ? (
            <Link to="/" style={{ textDecoration: "none", marginLeft: "auto" }}>
              <Flex
                align="center"
                gap={1.5}
                bg="brand.orange"
                color="white"
                px={3}
                py={1}
                borderRadius="4px"
                fontWeight={600}
                fontSize="xs"
                _hover={{ bg: "brand.orangeHover" }}
              >
                Make your own map
                <ArrowRight size={12} weight="bold" />
              </Flex>
            </Link>
          ) : (
            <>
              <BugReportLink
                storyId={story.id}
                datasetIds={story.dataset_ids}
              />
              <Text ml="auto" fontSize="xs" color="gray.500">
                Made with CNG Sandbox
              </Text>
            </>
          )}
        </Flex>
      )}

      <Box flex={1} overflowY="auto">
        <StoryRenderer
          story={story}
          datasetMap={datasetMap}
          connectionMap={connectionMap}
        />
      </Box>
    </Box>
  );
}
