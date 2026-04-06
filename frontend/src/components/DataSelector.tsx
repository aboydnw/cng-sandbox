import { useState, useEffect, useRef } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { CaretDown, Upload, Plus } from "@phosphor-icons/react";
import { transition } from "../lib/interactionStyles";
import type { MapItemSource } from "../types";

export interface DataSelectorItem {
  id: string;
  name: string;
  source: MapItemSource;
  dataType: "raster" | "vector";
  isZeroCopy?: boolean;
  isMosaic?: boolean;
  expiresAt?: string | null;
}

function dotColor(item: DataSelectorItem): string {
  if (item.source === "connection") return "#c084fc";
  return item.dataType === "raster" ? "#4ade80" : "#60a5fa";
}

interface DataSelectorProps {
  items: DataSelectorItem[];
  activeId: string;
  activeSource: MapItemSource;
  onSelect: (id: string, source: MapItemSource) => void;
  onUploadClick: () => void;
  onAddConnectionClick: () => void;
}

export function DataSelector({
  items,
  activeId,
  activeSource,
  onSelect,
  onUploadClick,
  onAddConnectionClick,
}: DataSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const datasets = items.filter((i) => i.source === "dataset");
  const connections = items.filter((i) => i.source === "connection");

  const activeItem = items.find(
    (i) => i.id === activeId && i.source === activeSource
  );
  const activeName = activeItem?.name ?? "Loading...";

  return (
    <Box ref={containerRef} position="relative">
      <Flex
        as="button"
        role="button"
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
        style={{ transition: transition() }}
      >
        <Box
          w="8px"
          h="8px"
          borderRadius="sm"
          bg={activeItem ? dotColor(activeItem) : "gray.500"}
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
              onClick={() => {
                onSelect(item.id, item.source);
                setIsOpen(false);
              }}
              align="center"
              gap={2}
              w="100%"
              px={3}
              py={1.5}
              bg={
                item.id === activeId && item.source === activeSource
                  ? "brand.bgSubtle"
                  : "transparent"
              }
              _hover={{ bg: "brand.bgSubtle" }}
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
              <Text fontSize="2xs" color="whiteAlpha.500">
                {item.dataType === "raster" ? "Raster" : "Vector"}
              </Text>
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
            _hover={{ bg: "brand.bgSubtle" }}
            cursor="pointer"
          >
            <Upload size={12} />
            <Text fontSize="sm">Upload new file</Text>
          </Flex>

          <Box borderTop="1px solid" borderColor="brand.border" my={1} />

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
              onClick={() => {
                onSelect(item.id, item.source);
                setIsOpen(false);
              }}
              align="center"
              gap={2}
              w="100%"
              px={3}
              py={1.5}
              bg={
                item.id === activeId && item.source === activeSource
                  ? "brand.bgSubtle"
                  : "transparent"
              }
              _hover={{ bg: "brand.bgSubtle" }}
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
            _hover={{ bg: "brand.bgSubtle" }}
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
