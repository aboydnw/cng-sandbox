import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useOptionalWorkspace } from "../hooks/useWorkspace";
import { Flex, Text } from "@chakra-ui/react";
import { ArrowLeft } from "@phosphor-icons/react";
import { StoryReaderInner } from "./StoryReaderInner";
import { BrandSpinner } from "../components/ui/BrandSpinner";

import {
  getStoryFromServer,
  migrateStory,
  isMapBoundChapter,
} from "../lib/story";
import { loadPortableConfig } from "../lib/story/loadPortableConfig";
import { cngRcToStory } from "../lib/story/cngRcAdapter";
import type { Story } from "../lib/story";
import type { Connection, Dataset } from "../types";
import { connectionsApi } from "../lib/api";
import { config } from "../config";

const PORTABLE_LOAD_ERROR =
  "We couldn't load this story from the provided config URL. Check that the URL is reachable and serves a valid cng-rc.json file.";

export default function StoryReaderPage({
  embed = false,
}: {
  embed?: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const configParam = searchParams.get("config");
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
    if (configParam) {
      let cancelled = false;
      setError(null);
      setLoading(true);
      (async () => {
        try {
          const portable = await loadPortableConfig(configParam);
          if (cancelled) return;
          const {
            story: portableStory,
            connections,
            datasets,
          } = cngRcToStory(portable);
          setStory(portableStory);
          setConnectionMap(connections);
          setDatasetMap(datasets);
          setLoading(false);
        } catch {
          if (cancelled) return;
          setError(PORTABLE_LOAD_ERROR);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
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
  }, [id, configParam]);

  useEffect(() => {
    if (configParam) return;
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
            .filter(isMapBoundChapter)
            .map((ch) => ch.layer_config.connection_id)
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
  }, [story, configParam]);

  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center">
        <BrandSpinner size={32} />
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
    <StoryReaderInner
      story={story}
      datasetMap={datasetMap}
      connectionMap={connectionMap}
      embed={embed}
      shared={shared}
      chatEligible={!configParam}
    />
  );
}
