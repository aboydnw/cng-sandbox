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
import { ExampleDataToggle } from "../components/ExampleDataToggle";
import { useWorkspace } from "../hooks/useWorkspace";
import { config } from "../config";
import { workspaceFetch, connectionsApi } from "../lib/api";
import type { Dataset, Connection } from "../types";
import { displayName } from "../utils/dataset";
import { timeAgo } from "../utils/format";
import {
  datasetToLibraryItem,
  connectionToLibraryItem,
  type LibraryItem,
} from "../lib/library/normalize";
import { StatePanel } from "../components/ui/StatePanel";
import { CollectionSkeleton } from "../components/ui/CollectionSkeleton";

interface DatasetWithStoryCount extends Dataset {
  story_count?: number;
}

export default function DataPage() {
  const { workspacePath } = useWorkspace();
  const [datasets, setDatasets] = useState<DatasetWithStoryCount[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    workspaceFetch(`${config.apiBase}/api/datasets`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setDatasets(data);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDatasetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    connectionsApi
      .list()
      .then((data) => {
        if (!cancelled) setConnections(data);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setConnectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setDatasetsLoading(true);
    setConnectionsLoading(true);
    workspaceFetch(`${config.apiBase}/api/datasets`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
      )
      .then(setDatasets)
      .catch((err) => setError((err as Error).message))
      .finally(() => setDatasetsLoading(false));
    connectionsApi
      .list()
      .then(setConnections)
      .catch((err) => setError((err as Error).message))
      .finally(() => setConnectionsLoading(false));
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
    <Flex direction="column" minH="100vh" bg="bg">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4}>
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="fg">
            Data
          </Heading>
          <Flex gap={2} align="center">
            <ExampleDataToggle onChanged={reload} />
            <Link to={workspacePath("/")}>
              <Button size="sm" colorScheme="orange">
                Add new
              </Button>
            </Link>
          </Flex>
        </Flex>

        <Heading size="md" color="fg" mb={3}>
          Your data
        </Heading>

        {datasetsLoading || connectionsLoading ? (
          <CollectionSkeleton rows={4} />
        ) : error ? (
          <StatePanel
            tone="danger"
            title="Couldn’t load your data library"
            description={error}
            actionLabel="Try again"
            onAction={reload}
          />
        ) : (
          (() => {
            const userItems: LibraryItem[] = [
              ...datasets
                .filter((d) => !d.is_example)
                .map(datasetToLibraryItem),
              ...connections
                .filter((c) => !c.is_example)
                .map(connectionToLibraryItem),
            ].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));

            if (userItems.length === 0) {
              return (
                <StatePanel
                  title="Your data library is empty"
                  description="Upload a file or connect cloud data to create your first map."
                  action={
                    <Button asChild size="sm">
                      <Link to={workspacePath("/")}>Add data</Link>
                    </Button>
                  }
                />
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
                    <Table.ColumnHeader w="140px">Expires</Table.ColumnHeader>
                    <Table.ColumnHeader w="80px" />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {userItems.map((item) => (
                    <Table.Row key={`${item.kind}-${item.id}`}>
                      <Table.Cell>
                        <Flex align="center" gap={2}>
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
                          {item.isExampleCopy && (
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
                        {item.expiresAt ? (
                          <ExpiryBadge expiresAt={item.expiresAt} />
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
      <Footer />
    </Flex>
  );
}
