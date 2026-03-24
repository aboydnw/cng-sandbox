import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Plus, X } from "@phosphor-icons/react";
import type { Chapter } from "../lib/story";
import { isExternalLayer } from "../lib/story";

interface ChapterListProps {
  chapters: Chapter[];
  activeChapterId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onReorder: (chapters: Chapter[]) => void;
}

export function ChapterList({
  chapters,
  activeChapterId,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
}: ChapterListProps) {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
    if (sourceIndex === targetIndex) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onReorder(reordered.map((ch, i) => ({ ...ch, order: i })));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  return (
    <Flex direction="column" h="100%">
      <Box px={3} py={3} borderBottom="1px solid" borderColor="gray.200">
        <Text
          fontSize="10px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="gray.500"
          fontWeight={600}
        >
          Chapters
        </Text>
      </Box>

      <Box flex={1} overflowY="auto" p={2}>
        {sorted.map((chapter, i) => (
          <Box
            key={chapter.id}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragOver={handleDragOver}
            bg={chapter.id === activeChapterId ? "blue.500" : "gray.50"}
            color={chapter.id === activeChapterId ? "white" : "gray.800"}
            borderRadius="6px"
            p={2}
            mb={1}
            cursor="pointer"
            onClick={() => onSelect(chapter.id)}
            _hover={{
              bg: chapter.id === activeChapterId ? "blue.500" : "gray.100",
            }}
          >
            <Text fontSize="12px" fontWeight={600} lineClamp={1}>
              {i + 1}. {chapter.title}
            </Text>
            <Flex justify="space-between" align="center" mt={1}>
              <Text fontSize="10px" opacity={0.7}>
                {isExternalLayer(chapter.layer_config)
                  ? "\uD83C\uDF10 " + chapter.layer_config.label
                  : chapter.type === "prose"
                    ? "prose"
                    : chapter.type === "map"
                      ? "map · zoom " + chapter.map_state.zoom.toFixed(0)
                      : "zoom " + chapter.map_state.zoom.toFixed(0) + " · " + chapter.transition}
              </Text>
              {confirmDeleteId === chapter.id ? (
                <Flex gap={1}>
                  <Text
                    as="button"
                    fontSize="10px"
                    color={chapter.id === activeChapterId ? "white" : "red.500"}
                    fontWeight={600}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(chapter.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    Delete
                  </Text>
                  <Text
                    as="button"
                    fontSize="10px"
                    opacity={0.7}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(null);
                    }}
                  >
                    Cancel
                  </Text>
                </Flex>
              ) : (
                chapters.length > 1 && (
                  <Text
                    as="button"
                    fontSize="10px"
                    opacity={0.5}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(chapter.id);
                    }}
                  >
                    <X size={12} weight="bold" />
                  </Text>
                )
              )}
            </Flex>
          </Box>
        ))}
      </Box>

      <Box p={2} borderTop="1px solid" borderColor="gray.200">
        <Box
          as="button"
          w="100%"
          border="1px dashed"
          borderColor="gray.300"
          borderRadius="6px"
          p={2}
          textAlign="center"
          color="gray.500"
          fontSize="12px"
          cursor="pointer"
          onClick={onAdd}
          _hover={{ borderColor: "blue.300", color: "blue.500" }}
        >
          <Flex align="center" gap={1.5} justify="center"><Plus size={12} weight="bold" /> Add chapter</Flex>
        </Box>
      </Box>
    </Flex>
  );
}
