import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ExampleDataToggle } from "../components/ExampleDataToggle";
import { useWorkspace } from "../hooks/useWorkspace";
import { config } from "../config";
import { workspaceFetch, connectionsApi } from "../lib/api";
import type { Dataset } from "../types";
import { timeAgo } from "../utils/format";
import {
  datasetToLibraryItem,
  connectionToLibraryItem,
  type LibraryItem,
} from "../lib/library/normalize";
import { StatePanel } from "../components/ui/StatePanel";
import { CollectionSkeleton } from "../components/ui/CollectionSkeleton";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CREATE_MAP_INTENT } from "../lib/creationIntents";
import {
  useWorkspaceConnections,
  useWorkspaceDatasets,
} from "../hooks/useWorkspaceLibrary";
import {
  ResourceCollection,
  ResourceCollectionCell,
  ResourceCollectionRow,
} from "../components/ui/ResourceCollection";
import { ResourceThumbnail } from "../components/ui/ResourceThumbnail";

// Expiry is intentionally hidden until the product has a retention policy.
// Restore the column alongside that policy so the UI never implies a deadline.
const DATA_COLUMNS = "minmax(0, 1fr) 90px minmax(0, 220px) 100px 80px";

interface DatasetWithStoryCount extends Dataset {
  story_count?: number;
}

export default function DataPage() {
  const { workspacePath } = useWorkspace();
  const datasetsResource = useWorkspaceDatasets();
  const connectionsResource = useWorkspaceConnections();
  const datasets = datasetsResource.data as DatasetWithStoryCount[];
  const connections = connectionsResource.data;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const reload = useCallback(() => {
    datasetsResource.retry();
    connectionsResource.retry();
  }, [datasetsResource.retry, connectionsResource.retry]);

  const handleDelete = useCallback(
    async (item: LibraryItem) => {
      setDeleteError(null);
      if (item.raw.kind === "dataset") {
        const ds = item.raw.dataset as DatasetWithStoryCount;
        setDeletingId(item.id);
        try {
          const resp = await workspaceFetch(
            `${config.apiBase}/api/datasets/${ds.id}`,
            { method: "DELETE" }
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          datasetsResource.retry();
          setPendingDelete(null);
        } catch {
          setDeleteError(
            "Couldn’t delete this data. Check your connection and try again."
          );
        } finally {
          setDeletingId(null);
        }
      } else {
        const conn = item.raw.connection;
        setDeletingId(item.id);
        try {
          await connectionsApi.delete(conn.id);
          connectionsResource.retry();
          setPendingDelete(null);
        } catch {
          setDeleteError(
            "Couldn’t delete this connection. Check your connection and try again."
          );
        } finally {
          setDeletingId(null);
        }
      }
    },
    [datasetsResource.retry, connectionsResource.retry]
  );

  const userItems: LibraryItem[] = [
    ...datasets.filter((d) => !d.is_example).map(datasetToLibraryItem),
    ...connections.filter((c) => !c.is_example).map(connectionToLibraryItem),
  ].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  const loading =
    userItems.length === 0 &&
    (datasetsResource.status === "loading" ||
      connectionsResource.status === "loading");
  const resourceError = [datasetsResource.error, connectionsResource.error]
    .filter(Boolean)
    .join("; ");

  return (
    <Flex direction="column" minH="100vh" bg="bg">
      <Header />
      <Box as="main" id="main-content" maxW="960px" mx="auto" py={8} px={4}>
        <PageHeader
          title="Data"
          description="Open uploaded files and connected cloud sources, or create a map from new data."
          actions={
            <>
              <ExampleDataToggle onChanged={reload} />
              <Link to={workspacePath(CREATE_MAP_INTENT.path)}>
                <Button size="sm">{CREATE_MAP_INTENT.label}</Button>
              </Link>
            </>
          }
        />

        <Heading size="md" color="fg" mb={3}>
          Your data
        </Heading>

        {resourceError && (
          <Box mb={4}>
            <StatePanel
              tone="danger"
              title={
                userItems.length === 0
                  ? "Couldn’t load your data library"
                  : "Some data couldn’t load"
              }
              description={resourceError}
              actionLabel="Try again"
              onAction={reload}
            />
          </Box>
        )}

        {loading ? (
          <CollectionSkeleton rows={4} />
        ) : resourceError && userItems.length === 0 ? null : (
          (() => {
            if (userItems.length === 0) {
              return (
                <StatePanel
                  title="Your data library is empty"
                  description="Upload a file or connect cloud data to create your first map."
                  action={
                    <Button asChild size="sm">
                      <Link to={workspacePath(CREATE_MAP_INTENT.path)}>
                        {CREATE_MAP_INTENT.label}
                      </Link>
                    </Button>
                  }
                />
              );
            }

            return (
              <ResourceCollection
                columns={DATA_COLUMNS}
                headers={["Name", "Type", "Source", "Added", ""]}
              >
                {userItems.map((item) => (
                  <ResourceCollectionRow
                    key={`${item.kind}-${item.id}`}
                    columns={DATA_COLUMNS}
                  >
                    <ResourceCollectionCell label="Name" primary>
                      <Flex align="center" gap={2} minW={0}>
                        <ResourceThumbnail alt={item.name} kind={item.type} />
                        <Link
                          to={workspacePath(item.detailHref)}
                          style={{ minWidth: 0, flex: 1 }}
                        >
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
                            flexShrink={0}
                          >
                            Example
                          </Badge>
                        )}
                      </Flex>
                    </ResourceCollectionCell>
                    <ResourceCollectionCell label="Type">
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
                    </ResourceCollectionCell>
                    <ResourceCollectionCell label="Source">
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
                    </ResourceCollectionCell>
                    <ResourceCollectionCell label="Added">
                      <Text fontSize="sm" color="gray.600">
                        {item.addedAt ? timeAgo(item.addedAt) : "—"}
                      </Text>
                    </ResourceCollectionCell>
                    <ResourceCollectionCell label="Actions">
                      <Button
                        size="xs"
                        variant="ghost"
                        color="status.danger.fg"
                        _hover={{ bg: "status.danger.subtle" }}
                        loading={deletingId === item.id}
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete(item);
                        }}
                      >
                        Delete
                      </Button>
                    </ResourceCollectionCell>
                  </ResourceCollectionRow>
                ))}
              </ResourceCollection>
            );
          })()
        )}
      </Box>
      <ConfirmDialog
        open={pendingDelete != null}
        title={"Delete “" + (pendingDelete?.name ?? "data") + "”?"}
        description={
          pendingDelete?.raw.kind === "dataset" &&
          (pendingDelete.raw.dataset as DatasetWithStoryCount).story_count
            ? "This permanently removes the data. It is used in " +
              (pendingDelete.raw.dataset as DatasetWithStoryCount).story_count +
              ((pendingDelete.raw.dataset as DatasetWithStoryCount)
                .story_count === 1
                ? " story"
                : " stories") +
              ", where it will no longer display."
            : "This permanently removes the data source and cannot be undone."
        }
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
