import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { Header } from "../components/Header";
import { config } from "../config";
import type { Dataset } from "../types";

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DatasetWithStoryCount extends Dataset {
  story_count?: number;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetWithStoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${config.apiBase}/api/datasets`)
      .then((r) => r.json())
      .then((data) => {
        setDatasets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(
    async (ds: DatasetWithStoryCount) => {
      const storyWarning =
        ds.story_count && ds.story_count > 0
          ? `\n\nThis dataset is used in ${ds.story_count} story${ds.story_count > 1 ? "s" : ""}. Those chapters will no longer display.`
          : "";

      if (!window.confirm(`Delete "${ds.filename}"?${storyWarning}`)) return;

      setDeleting(ds.id);
      try {
        const resp = await fetch(
          `${config.apiBase}/api/datasets/${ds.id}`,
          { method: "DELETE" },
        );
        if (resp.ok) {
          setDatasets((prev) => prev.filter((d) => d.id !== ds.id));
        }
      } finally {
        setDeleting(null);
      }
    },
    [],
  );

  return (
    <Box minH="100vh" bg="gray.50">
      <Header />
      <Box maxW="960px" mx="auto" py={8} px={4}>
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="gray.800">
            Datasets
          </Heading>
          <Link to="/">
            <Button size="sm" colorScheme="orange">
              Upload new
            </Button>
          </Link>
        </Flex>

        {loading ? (
          <Flex justify="center" py={12}>
            <Spinner size="lg" />
          </Flex>
        ) : datasets.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            py={12}
            gap={3}
            color="gray.500"
          >
            <Text>No datasets uploaded yet.</Text>
            <Link to="/">
              <Text color="brand.orange" fontWeight={600}>
                Upload your first file
              </Text>
            </Link>
          </Flex>
        ) : (
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Filename</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>Uploaded</Table.ColumnHeader>
                <Table.ColumnHeader>Size</Table.ColumnHeader>
                <Table.ColumnHeader w="80px" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {datasets.map((ds) => (
                <Table.Row key={ds.id}>
                  <Table.Cell>
                    <Link to={`/map/${ds.id}`}>
                      <Text
                        color="blue.600"
                        _hover={{ textDecoration: "underline" }}
                        fontWeight={500}
                      >
                        {ds.filename}
                      </Text>
                    </Link>
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
                    <Text fontSize="sm" color="gray.600">
                      {ds.created_at ? timeAgo(ds.created_at as unknown as string) : "\u2014"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="sm" color="gray.600">
                      {formatBytes(ds.original_file_size)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      loading={deleting === ds.id}
                      onClick={() => handleDelete(ds)}
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
    </Box>
  );
}
