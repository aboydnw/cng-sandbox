import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import { storyMarkdownComponents } from "./storyMarkdownComponents";
import scrollama from "scrollama";
import { FlyToInterpolator } from "@deck.gl/core";
import { UnifiedMap } from "./UnifiedMap";
import { ProseChapter } from "./ProseChapter";
import { MapChapter } from "./MapChapter";
import { type CameraState, cameraFromBounds } from "../lib/layers";
import {
  groupChaptersIntoBlocks,
  buildLayersForChapter,
} from "../lib/story/rendering";
import type { Story, Chapter } from "../lib/story";
import type { Dataset } from "../types";

function ScrollytellingBlock({
  chapters,
  startIndex,
  datasetMap,
  onChapterClick,
}: {
  chapters: Chapter[];
  startIndex: number;
  datasetMap: Map<string, Dataset | null>;
  onChapterClick?: (chapterId: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [camera, setCamera] = useState<CameraState>({
    longitude: chapters[0].map_state.center[0],
    latitude: chapters[0].map_state.center[1],
    zoom: chapters[0].map_state.zoom,
    bearing: chapters[0].map_state.bearing,
    pitch: chapters[0].map_state.pitch,
  });
  const [basemap, setBasemap] = useState(chapters[0].map_state.basemap);
  const [transitionDuration, setTransitionDuration] = useState<
    number | undefined
  >(undefined);
  const flyToRef = useRef(new FlyToInterpolator());
  const stepsRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<ReturnType<typeof scrollama> | null>(null);

  useEffect(() => {
    if (datasetMap.size === 0) return;
    const firstChapter = chapters[0];
    const ds = datasetMap.get(firstChapter.layer_config.dataset_id);
    if (
      ds?.bounds &&
      firstChapter.map_state.center[0] === 0 &&
      firstChapter.map_state.center[1] === 0
    ) {
      setCamera(cameraFromBounds(ds.bounds));
    }
  }, [datasetMap, chapters]);

  useEffect(() => {
    if (!stepsRef.current || chapters.length === 0) return;

    const scroller = scrollama();
    scrollerRef.current = scroller;

    scroller
      .setup({
        step: stepsRef.current.querySelectorAll(
          "[data-step]"
        ) as unknown as HTMLElement[],
        offset: 0.8,
      })
      .onStepEnter(({ index }) => {
        setActiveIndex(index);
      });

    return () => {
      scroller.destroy();
      scrollerRef.current = null;
    };
  }, [chapters]);

  useEffect(() => {
    const chapter = chapters[activeIndex];
    if (!chapter) return;

    setBasemap(chapter.map_state.basemap);
    setTransitionDuration(chapter.transition === "fly-to" ? 2000 : undefined);
    setCamera({
      longitude: chapter.map_state.center[0],
      latitude: chapter.map_state.center[1],
      zoom: chapter.map_state.zoom,
      bearing: chapter.map_state.bearing,
      pitch: chapter.map_state.pitch,
    });
  }, [activeIndex, chapters]);

  const layers = useMemo(
    () => buildLayersForChapter(chapters[activeIndex], datasetMap),
    [datasetMap, activeIndex, chapters]
  );

  const handleCameraChange = useCallback((c: CameraState) => {
    setCamera(c);
    setTransitionDuration(undefined);
  }, []);

  const activeDataset = chapters[activeIndex]
    ? datasetMap.get(chapters[activeIndex].layer_config.dataset_id)
    : undefined;

  return (
    <Flex h="100vh" overflow="hidden" position="relative">
      <Box w="40%" overflowY="auto" bg="gray.50" ref={stepsRef}>
        {chapters.map((chapter, i) => (
          <Box
            key={chapter.id}
            data-step
            px={8}
            pt={i === 0 ? 12 : 4}
            pb="80vh"
            opacity={activeIndex === i ? 1 : 0.3}
            transition="opacity 400ms cubic-bezier(0.32, 0.72, 0, 1)"
            onClick={
              onChapterClick ? () => onChapterClick(chapter.id) : undefined
            }
            cursor={onChapterClick ? "pointer" : undefined}
          >
            <Box
              bg="white"
              borderRadius="8px"
              p={6}
              shadow="sm"
              border="1px solid"
              borderColor={activeIndex === i ? "brand.bgSubtle" : "gray.200"}
            >
              <Text
                fontSize="10px"
                textTransform="uppercase"
                letterSpacing="1px"
                color="brand.orange"
                fontWeight={600}
                mb={2}
              >
                Chapter {startIndex + i + 1}
              </Text>
              <Heading size="md" mb={3} color="gray.800">
                {chapter.title}
              </Heading>
              <Box
                fontSize="sm"
                color="gray.700"
                lineHeight="1.7"
                maxW="65ch"
                css={{
                  "& p": { marginBottom: "1em" },
                  "& h1, & h2, & h3": {
                    fontWeight: 600,
                    marginBottom: "0.5em",
                  },
                }}
              >
                <Markdown components={storyMarkdownComponents}>
                  {chapter.narrative}
                </Markdown>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Box w="60%" position="sticky" top={0} h="100vh">
        {datasetMap.size > 0 && (
          <UnifiedMap
            camera={camera}
            onCameraChange={handleCameraChange}
            layers={layers}
            basemap={basemap}
            onBasemapChange={setBasemap}
            transitionDuration={transitionDuration}
            transitionInterpolator={
              transitionDuration ? flyToRef.current : undefined
            }
            interactive={false}
          />
        )}
        {activeDataset === null && (
          <Flex
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            bg="blackAlpha.600"
            zIndex={10}
          >
            <Text color="white" fontSize="lg" fontWeight={500}>
              Data no longer available
            </Text>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}

export function StoryRenderer({
  story,
  datasetMap,
  onChapterClick,
}: {
  story: Story;
  datasetMap: Map<string, Dataset | null>;
  onChapterClick?: (chapterId: string) => void;
}) {
  const sortedChapters = useMemo(
    () => [...story.chapters].sort((a, b) => a.order - b.order),
    [story]
  );

  const contentBlocks = useMemo(
    () => groupChaptersIntoBlocks(sortedChapters),
    [sortedChapters]
  );

  return (
    <>
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

        if (block.type === "map") {
          const ds =
            datasetMap.get(block.chapter.layer_config.dataset_id) ?? null;
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
              <MapChapter
                chapter={block.chapter}
                chapterIndex={block.index}
                dataset={ds}
              />
            </Box>
          );
        }

        return (
          <ScrollytellingBlock
            key={`scrolly-${blockIndex}`}
            chapters={block.chapters}
            startIndex={block.startIndex}
            datasetMap={datasetMap}
            onChapterClick={onChapterClick}
          />
        );
      })}
    </>
  );
}
