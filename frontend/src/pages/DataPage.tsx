import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Flex, Heading, Table, Text } from "@chakra-ui/react";
import { SpinnerGap } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { useWorkspace } from "../hooks/useWorkspace";
import { config } from "../config";
import { workspaceFetch, connectionsApi } from "../lib/api";
import type { Dataset, Connection } from "../types";
import { displayName } from "../utils/dataset";
import { detectCadence, formatDateRangeBadge } from "../utils/temporal";
import {
  datasetToLibraryItem,
  connectionToLibraryItem,
  type LibraryItem,
} from "../lib/library/normalize";

interface DatasetWithStoryCount extends Dataset {
  story_count?: number;
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

export default function DataPage() {
  const { workspacePath } = useWorkspace();
  const [datasets, setDatasets] = useState<DatasetWithStoryCount[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    workspaceFetch(`${config.apiBase}/api/datasets`)
      .then((r) => r.json())
      .then((data) => {
        setDatasets(data);
        setDatasetsLoading(false);
      })
      .catch(() => setDatasetsLoading(false));
  }, []);

  useEffect(() => {
    connectionsApi
      .list()
      .then((data) => {
        setConnections(data);
        setConnectionsLoading(false);
      })
      .catch(() => setConnectionsLoading(false));
  }, []);

  const handleDelete = useCallback(async (item: LibraryItem) => {
    if (item.raw.kind === "dataset") {
      const ds = item.raw.dataset as DatasetWithStoryCount;
      const storyWarning =
        ds.story_count && ds.story_count > 0
          ? `\n\nThis dataset is used in ${ds.story_count} story${
              ds.story_count > 1 ? "s" : ""
            }. Those chapters will no longer display.`
          : "";
      if (!window.confirm(`Delete "${displayName(ds)}"?${storyWarning}`))
        return;
      setDeletingId(item.id);
      try {
        const resp = await workspaceFetch(
          `${config.apiBase}/api/datasets/${ds.id}`,
          { method: "DELETE" }
        );
        if (resp.ok) {
          setDatasets((prev) => prev.filter((d) => d.id !== ds.id));
        }
      } finally {
        setDeletingId(null);
      }
    } else {
      const conn = item.raw.connection;
      if (!window.confirm(`Delete connection "${conn.name}"?`)) return;
      setDeletingId(item.id);
      try {
        await connectionsApi.delete(conn.id);
        setConnections((prev) => prev.filter((c) => c.id !== conn.id));
      } finally {
        setDeletingId(null);
      }
    }
  }, []);

  return (
    <Box minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4}>
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="gray.800">
            Data
          </Heading>
          <Link to={workspacePath("/")}>
            <Button size="sm" colorScheme="orange">
              Add new
            </Button>
          </Link>
        </Flex>

        {(() => {
          const exampleDatasets = datasets.filter((d) => d.is_example);
          if (exampleDatasets.length === 0) return null;
          return (
            <Box mb={8}>
              <Heading size="md" color="gray.700" mb={3}>
                Example datasets
              </Heading>
              <Text fontSize="13px" color="gray.500" mb={3}>
                Public datasets shared with every workspace.
              </Text>
              <Table.Root size="sm" tableLayout="fixed">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader w="90px">Type</Table.ColumnHeader>
                    <Table.ColumnHeader w="120px">Source</Table.ColumnHeader>
                    <Table.ColumnHeader w="100px">Added</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {exampleDatasets.map((ds) => (
                    <Table.Row key={ds.id}>
                      <Table.Cell>
                        <Link to={workspacePath(`/map/${ds.id}`)}>
                          <Text
                            color="brand.orange"
                            _hover={{ textDecoration: "underline" }}
                            fontWeight={500}
                            truncate
                            title={ds.filename}
                          >
                            {displayName(ds)}
                          </Text>
                        </Link>
                        {ds.title ? (
                          <Text fontSize="11px" color="fg.subtle" mt={0.5}>
                            {ds.filename}
                          </Text>
                        ) : null}
                        {ds.is_temporal && ds.timesteps.length > 0 && (
                          <Text fontSize="xs" color="fg.subtle" mt={0.5}>
                            {formatDateRangeBadge(
                              ds.timesteps[0].datetime,
                              ds.timesteps[ds.timesteps.length - 1].datetime,
                              ds.timesteps.length,
                              detectCadence(ds.timesteps.map((t) => t.datetime))
                            )}
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Text
                          fontSize="xs"
                          fontWeight={600}
                          textTransform="uppercase"
                          color={
                            ds.dataset_type === "raster"
                              ? "purple.600"
                              : "teal.600"
                          }
                        >
                          {ds.dataset_type}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="gray.500">
                          Uploaded
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="gray.600">
                          {ds.created_at ? timeAgo(ds.created_at) : "—"}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          );
        })()}

        <Heading size="md" color="gray.700" mb={3}>
          Your data
        </Heading>

        {datasetsLoading || connectionsLoading ? (
          <Flex justify="center" py={12}>
            <SpinnerGap
              size={32}
              style={{ animation: "spin 1s linear infinite" }}
            />
          </Flex>
        ) : (
          (() => {
            const userItems: LibraryItem[] = [
              ...datasets
                .filter((d) => !d.is_example)
                .map(datasetToLibraryItem),
              ...connections.map(connectionToLibraryItem),
            ].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));

            if (userItems.length === 0) {
              return (
                <Flex
                  direction="column"
                  align="center"
                  py={12}
                  gap={3}
                  color="gray.500"
                >
                  <Text>Nothing in your data library yet.</Text>
                  <Link to={workspacePath("/")}>
                    <Text color="brand.orange" fontWeight={600}>
                      Add your first dataset or connection
                    </Text>
                  </Link>
                </Flex>
              );
            }

            return (
              <Table.Root size="sm" tableLayout="fixed">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader w="90px">Type</Table.ColumnHeader>
                    <Table.ColumnHeader w="200px">Source</Table.ColumnHeader>
                    <Table.ColumnHeader w="100px">Added</Table.ColumnHeader>
                    <Table.ColumnHeader w="80px" />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {userItems.map((item) => (
                    <Table.Row key={`${item.kind}-${item.id}`}>
                      <Table.Cell>
                        <Link to={workspacePath(item.detailHref)}>
                          <Text
                            color="brand.orange"
                            _hover={{ textDecoration: "underline" }}
                            fontWeight={500}
                            truncate
                            title={item.name}
                          >
                            {item.name}
                          </Text>
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <Text
                          fontSize="xs"
                          fontWeight={600}
                          textTransform="uppercase"
                          color={
                            item.type === "raster" ? "purple.600" : "teal.600"
                          }
                        >
                          {item.type}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        {item.source.href ? (
                          <a
                            href={item.source.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.source.label}
                            style={{
                              color: "var(--chakra-colors-gray-500)",
                              fontSize: 13,
                            }}
                          >
                            <Text
                              fontSize="sm"
                              color="gray.500"
                              truncate
                              title={item.source.label}
                            >
                              {item.source.label}
                            </Text>
                          </a>
                        ) : (
                          <Text fontSize="sm" color="gray.500">
                            {item.source.label}
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="gray.600">
                          {item.addedAt ? timeAgo(item.addedAt) : "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          loading={deletingId === item.id}
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            );
          })()
        )}
      </Box>
    </Box>
  );
}
