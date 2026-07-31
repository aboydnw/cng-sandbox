import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Box } from "@chakra-ui/react";
import { ProseChapter } from "./ProseChapter";
import { ImageChapterRenderer } from "./ImageChapterRenderer";
import { VideoChapterRenderer } from "./VideoChapterRenderer";
import { ChartChapterRenderer } from "./ChartChapterRenderer";
import {
  StoryMapHydrationBoundary,
  useStoryMapRuntimePreload,
} from "./StoryMapHydrationBoundary";
import { groupChaptersIntoBlocks } from "../lib/story/groupChapters";
import { markStoryPerformance } from "../lib/story/performance";
import type { Story } from "../lib/story";
import type { Connection, Dataset } from "../types";
import type { AgentBridge } from "../lib/chat/types";

export function StoryRenderer({
  story,
  datasetMap,
  connectionMap,
  onChapterClick,
  agentBridgeRef,
}: {
  story: Story;
  datasetMap: Map<string, Dataset | null>;
  connectionMap?: Map<string, Connection>;
  onChapterClick?: (chapterId: string) => void;
  agentBridgeRef?: React.RefObject<AgentBridge | null>;
}) {
  const readerRef = useRef<HTMLDivElement>(null);
  const bridgeDelegateRef = useRef<AgentBridge | null>(null);
  const sortedChapters = useMemo(
    () => [...story.chapters].sort((a, b) => a.order - b.order),
    [story.chapters]
  );
  const contentBlocks = useMemo(
    () => groupChaptersIntoBlocks(sortedChapters),
    [sortedChapters]
  );
  const firstMapBlockIndex = contentBlocks.findIndex(
    (block) =>
      block.type === "map" ||
      block.type === "scrollytelling" ||
      block.type === "flyover"
  );
  const firstScrollyBlockIndex = contentBlocks.findIndex(
    (block) => block.type === "scrollytelling"
  );

  useStoryMapRuntimePreload(
    readerRef,
    firstMapBlockIndex >= 0,
    firstMapBlockIndex === 0
  );

  useEffect(() => {
    markStoryPerformance("story-prose-visible");
  }, []);

  useImperativeHandle(
    agentBridgeRef,
    () => ({
      flyTo: (...args) => bridgeDelegateRef.current?.flyTo(...args),
      goToChapter: (index) => bridgeDelegateRef.current?.goToChapter(index),
      setLayerVisibility: (id, visible) =>
        bridgeDelegateRef.current?.setLayerVisibility(id, visible),
      highlightLocation: (...args) =>
        bridgeDelegateRef.current?.highlightLocation(...args),
      getActiveLayers: () => bridgeDelegateRef.current?.getActiveLayers() ?? [],
      getChapters: () =>
        bridgeDelegateRef.current?.getChapters() ??
        sortedChapters.map((chapter, index) => ({
          index,
          title: chapter.title,
        })),
    }),
    [sortedChapters]
  );

  return (
    <Box ref={readerRef}>
      {contentBlocks.map((block, blockIndex) => {
        if (block.type === "prose") {
          return (
            <Box
              key={block.chapter.id}
              onClick={
                onChapterClick
                  ? () => onChapterClick(block.chapter.id)
                  : undefined
              }
              cursor={onChapterClick ? "pointer" : undefined}
            >
              <ProseChapter
                chapter={block.chapter}
                chapterIndex={block.index}
              />
            </Box>
          );
        }

        if (block.type === "image") {
          return (
            <Box
              key={block.chapter.id}
              onClick={
                onChapterClick
                  ? () => onChapterClick(block.chapter.id)
                  : undefined
              }
              cursor={onChapterClick ? "pointer" : undefined}
            >
              <ImageChapterRenderer
                chapter={block.chapter}
                chapterIndex={block.index}
              />
            </Box>
          );
        }

        if (block.type === "video") {
          return (
            <Box
              key={block.chapter.id}
              onClick={
                onChapterClick
                  ? () => onChapterClick(block.chapter.id)
                  : undefined
              }
              cursor={onChapterClick ? "pointer" : undefined}
            >
              <VideoChapterRenderer
                chapter={block.chapter}
                chapterIndex={block.index}
              />
            </Box>
          );
        }

        if (block.type === "chart") {
          return (
            <Box
              key={block.chapter.id}
              onClick={
                onChapterClick
                  ? () => onChapterClick(block.chapter.id)
                  : undefined
              }
              cursor={onChapterClick ? "pointer" : undefined}
            >
              <ChartChapterRenderer
                chapter={block.chapter}
                chapterIndex={block.index}
              />
            </Box>
          );
        }

        return (
          <StoryMapHydrationBoundary
            key={
              block.type === "scrollytelling"
                ? `scrolly-${block.startIndex}`
                : block.chapter.id
            }
            block={block}
            datasetMap={datasetMap}
            connectionMap={connectionMap}
            onChapterClick={onChapterClick}
            eager={blockIndex === 0}
            registerBridge={
              blockIndex === firstScrollyBlockIndex
                ? (bridge) => {
                    bridgeDelegateRef.current = bridge;
                  }
                : undefined
            }
          />
        );
      })}
    </Box>
  );
}
