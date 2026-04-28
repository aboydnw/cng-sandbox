import { useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import {
  CaretDown,
  CaretUp,
  ChartLine,
  DotsSixVertical,
  ListBullets,
  MapTrifold,
  Scroll,
  Plus,
  X,
} from "@phosphor-icons/react";
import type { ChapterType } from "../lib/story";
import type { Chapter } from "../lib/story";
import { CHAPTER_TYPE_LABELS } from "../lib/story/labels";

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

  function moveChapter(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    onReorder(reordered.map((ch, i) => ({ ...ch, order: i })));
  }

  return (
    <Flex direction="column" h="100%">
      <Flex
        px={3}
        py={3}
        borderBottom="1px solid"
        borderColor="gray.200"
        align="center"
        justify="space-between"
      >
        <Text
          fontSize="12px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="gray.500"
          fontWeight={600}
        >
          Chapters
        </Text>
        <Flex
          as="button"
          aria-label="Add chapter"
          align="center"
          gap={1}
          px={2}
          py={1}
          borderRadius="6px"
          border="1px solid"
          borderColor="brand.border"
          color="brand.orange"
          fontSize="11px"
          fontWeight={600}
          cursor="pointer"
          onClick={onAdd}
          _hover={{ bg: "brand.bgSubtle", borderColor: "brand.orange" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "brand.orange",
            outlineOffset: "2px",
          }}
        >
          <Plus size={12} weight="bold" />
          New
        </Flex>
      </Flex>

      <Box flex={1} overflowY="auto" p={2}>
        {sorted.map((chapter, i) => {
          const isActive = chapter.id === activeChapterId;
          const isConfirming = confirmDeleteId === chapter.id;

          return (
            <Box
              key={chapter.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragOver={handleDragOver}
              bg={isActive ? "brand.bgSubtle" : "white"}
              color={isActive ? "brand.brown" : "gray.700"}
              borderRadius="6px"
              mb={1}
              cursor="pointer"
              onClick={() => onSelect(chapter.id)}
              border="1px solid"
              borderColor={isActive ? "brand.border" : "transparent"}
              _hover={{
                bg: isActive ? "brand.bgSubtle" : "gray.50",
              }}
              position="relative"
            >
              {isConfirming ? (
                <Flex
                  direction="column"
                  gap={2}
                  p={2}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Text fontSize="12px" fontWeight={600}>
                    Delete this chapter?
                  </Text>
                  <Flex gap={1.5}>
                    <Button
                      size="xs"
                      colorScheme="red"
                      minH="28px"
                      flex={1}
                      onClick={() => {
                        onDelete(chapter.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      Delete
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      minH="28px"
                      flex={1}
                      color={isActive ? "white" : "gray.600"}
                      _hover={{ bg: isActive ? "gray.200" : "gray.200" }}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <Flex align="stretch">
                  <Flex
                    align="center"
                    px={1}
                    opacity={0.4}
                    cursor="grab"
                    flexShrink={0}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DotsSixVertical size={16} />
                  </Flex>

                  <Box flex={1} py={2} pr={1}>
                    <Text fontSize="13px" fontWeight={600} lineClamp={1}>
                      {i + 1}. {chapter.title}
                    </Text>
                    <Flex
                      fontSize="11px"
                      opacity={0.7}
                      lineClamp={1}
                      mt={0.5}
                      align="center"
                      gap={1}
                    >
                      {
                        (
                          {
                            scrollytelling: <Scroll size={11} />,
                            prose: <ListBullets size={11} />,
                            map: <MapTrifold size={11} />,
                            chart: <ChartLine size={11} />,
                          } as Record<ChapterType, React.ReactNode>
                        )[chapter.type]
                      }
                      {CHAPTER_TYPE_LABELS[chapter.type]}
                      {chapter.narrative.trim() ? (
                        <> · {chapter.narrative.trim().slice(0, 40)}</>
                      ) : (
                        <Text as="span" fontStyle="italic">
                          {" "}
                          · No narrative yet
                        </Text>
                      )}
                    </Flex>
                  </Box>

                  <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    gap={0.5}
                    px={1}
                    flexShrink={0}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Box
                      as="button"
                      opacity={i === 0 ? 0.2 : 0.5}
                      cursor={i === 0 ? "default" : "pointer"}
                      aria-disabled={i === 0}
                      _hover={i === 0 ? {} : { opacity: 1 }}
                      lineHeight={1}
                      onClick={() => i > 0 && moveChapter(i, "up")}
                    >
                      <CaretUp size={13} weight="bold" />
                    </Box>
                    <Box
                      as="button"
                      opacity={i === sorted.length - 1 ? 0.2 : 0.5}
                      cursor={i === sorted.length - 1 ? "default" : "pointer"}
                      aria-disabled={i === sorted.length - 1}
                      _hover={i === sorted.length - 1 ? {} : { opacity: 1 }}
                      lineHeight={1}
                      onClick={() =>
                        i < sorted.length - 1 && moveChapter(i, "down")
                      }
                    >
                      <CaretDown size={13} weight="bold" />
                    </Box>
                  </Flex>

                  {chapters.length > 1 && (
                    <Flex
                      align="center"
                      px={1}
                      flexShrink={0}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Box
                        as="button"
                        opacity={0.4}
                        _hover={{ opacity: 0.8 }}
                        lineHeight={1}
                        onClick={() => setConfirmDeleteId(chapter.id)}
                      >
                        <X size={14} weight="bold" />
                      </Box>
                    </Flex>
                  )}
                </Flex>
              )}
            </Box>
          );
        })}
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
          _hover={{ borderColor: "brand.orange", color: "brand.orange" }}
        >
          <Flex align="center" gap={1.5} justify="center">
            <Plus size={12} weight="bold" /> Add chapter
          </Flex>
        </Box>
      </Box>
    </Flex>
  );
}
