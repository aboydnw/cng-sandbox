import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Flex, Text } from "@chakra-ui/react";
import { CaretDown, Plus, Upload } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import { connectionsApi, workspaceFetch } from "../lib/api";
import { transition } from "../lib/interactionStyles";
import type { Dataset, Connection, MapItemSource } from "../types";

interface DataSwitcherProps {
  activeId: string;
  activeSource: MapItemSource;
  onUploadClick: () => void;
  onAddConnectionClick: () => void;
  refreshKey: number;
}

interface ListItem {
  id: string;
  name: string;
  source: MapItemSource;
  dataType: "raster" | "vector";
}

function dotColor(item: ListItem): string {
  if (item.source === "connection") return "#c084fc";
  return item.dataType === "raster" ? "#4ade80" : "#60a5fa";
}

function typeBadge(item: ListItem): string | null {
  if (item.source === "connection") return null;
  return item.dataType === "raster" ? "Raster" : "Vector";
}

export function DataSwitcher({
  activeId,
  activeSource,
  onUploadClick,
  onAddConnectionClick,
  refreshKey,
}: DataSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [datasets, setDatasets] = useState<ListItem[]>([]);
  const [connections, setConnections] = useState<ListItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();

  // Fetch lists
  useEffect(() => {
    workspaceFetch("/api/datasets")
      .then((r) => r.json())
      .then((list: Dataset[]) =>
        setDatasets(
          list.map((d) => ({
            id: d.id,
            name: d.filename,
            source: "dataset" as const,
            dataType: d.dataset_type,
          }))
        )
      )
      .catch(() => {});

    connectionsApi
      .list()
      .then((list) =>
        setConnections(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            source: "connection" as const,
            dataType:
              c.connection_type === "xyz_vector" ||
              (c.connection_type === "pmtiles" && c.tile_type === "vector")
                ? "vector"
                : "raster",
          }))
        )
      )
      .catch(() => {});
  }, [refreshKey]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSelect = useCallback(
    (item: ListItem) => {
      setIsOpen(false);
      const path =
        item.source === "connection"
          ? workspacePath(`/map/connection/${item.id}`)
          : workspacePath(`/map/${item.id}`);
      navigate(path);
    },
    [navigate, workspacePath]
  );

  const activeName =
    [...datasets, ...connections].find(
      (i) => i.id === activeId && i.source === activeSource
    )?.name ?? "Loading...";

  const activeColor = [...datasets, ...connections].find(
    (i) => i.id === activeId && i.source === activeSource
  );

  return (
    <Box ref={containerRef} position="relative" mb={3}>
      {/* Trigger */}
      <Flex
        as="button"
        onClick={() => setIsOpen((o) => !o)}
        align="center"
        gap={2}
        w="100%"
        px={3}
        py={2}
        bg="brand.bgSubtle"
        border="1px solid"
        borderColor={isOpen ? "brand.orange" : "brand.border"}
        borderRadius="md"
        cursor="pointer"
        {...transition}
      >
        <Box
          w="8px"
          h="8px"
          borderRadius="sm"
          bg={activeColor ? dotColor(activeColor) : "gray.500"}
          flexShrink={0}
        />
        <Text fontSize="sm" fontWeight={500} flex={1} textAlign="left" truncate>
          {activeName}
        </Text>
        <CaretDown
          size={14}
          style={{
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </Flex>

      {/* Dropdown */}
      {isOpen && (
        <Box
          position="absolute"
          top="calc(100% + 4px)"
          left={0}
          right={0}
          bg="brand.bgSubtle"
          border="1px solid"
          borderColor="brand.border"
          borderRadius="md"
          zIndex={20}
          maxH="400px"
          overflowY="auto"
          py={1}
          boxShadow="lg"
        >
          {/* Datasets section */}
          <Text
            px={3}
            py={1}
            fontSize="xs"
            fontWeight={600}
            color="brand.orange"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            Datasets
          </Text>
          {datasets.map((item) => (
            <Flex
              key={item.id}
              as="button"
              onClick={() => handleSelect(item)}
              align="center"
              gap={2}
              w="100%"
              px={3}
              py={1.5}
              bg={
                item.id === activeId && item.source === activeSource
                  ? "whiteAlpha.100"
                  : "transparent"
              }
              _hover={{ bg: "whiteAlpha.50" }}
              cursor="pointer"
            >
              <Box
                w="6px"
                h="6px"
                borderRadius="sm"
                bg={dotColor(item)}
                flexShrink={0}
              />
              <Text fontSize="sm" flex={1} textAlign="left" truncate>
                {item.name}
              </Text>
              {typeBadge(item) && (
                <Text fontSize="2xs" color="whiteAlpha.500">
                  {typeBadge(item)}
                </Text>
              )}
            </Flex>
          ))}
          {datasets.length === 0 && (
            <Text px={3} py={1} fontSize="xs" color="whiteAlpha.400">
              No datasets yet
            </Text>
          )}
          <Flex
            as="button"
            onClick={() => {
              setIsOpen(false);
              onUploadClick();
            }}
            align="center"
            gap={2}
            w="100%"
            px={3}
            py={1.5}
            color="brand.orange"
            _hover={{ bg: "whiteAlpha.50" }}
            cursor="pointer"
          >
            <Upload size={12} />
            <Text fontSize="sm">Upload new file</Text>
          </Flex>

          {/* Divider */}
          <Box borderTop="1px solid" borderColor="brand.border" my={1} />

          {/* Connections section */}
          <Text
            px={3}
            py={1}
            fontSize="xs"
            fontWeight={600}
            color="brand.orange"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            Connections
          </Text>
          {connections.map((item) => (
            <Flex
              key={item.id}
              as="button"
              onClick={() => handleSelect(item)}
              align="center"
              gap={2}
              w="100%"
              px={3}
              py={1.5}
              bg={
                item.id === activeId && item.source === activeSource
                  ? "whiteAlpha.100"
                  : "transparent"
              }
              _hover={{ bg: "whiteAlpha.50" }}
              cursor="pointer"
            >
              <Box
                w="6px"
                h="6px"
                borderRadius="sm"
                bg={dotColor(item)}
                flexShrink={0}
              />
              <Text fontSize="sm" flex={1} textAlign="left" truncate>
                {item.name}
              </Text>
            </Flex>
          ))}
          {connections.length === 0 && (
            <Text px={3} py={1} fontSize="xs" color="whiteAlpha.400">
              No connections yet
            </Text>
          )}
          <Flex
            as="button"
            onClick={() => {
              setIsOpen(false);
              onAddConnectionClick();
            }}
            align="center"
            gap={2}
            w="100%"
            px={3}
            py={1.5}
            color="brand.orange"
            _hover={{ bg: "whiteAlpha.50" }}
            cursor="pointer"
          >
            <Plus size={12} />
            <Text fontSize="sm">Add connection</Text>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
