import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import { BrandSpinner } from "./ui/BrandSpinner";
import type { MapContentBlock } from "../lib/story/groupChapters";
import type { AgentBridge } from "../lib/chat/types";
import type { Connection, Dataset } from "../types";
import { markStoryPerformance } from "../lib/story/performance";

export const STORY_MAP_PRELOAD_MARGIN = "200% 0px";
export const STORY_MAP_HYDRATE_MARGIN = "100% 0px";
export const STORY_MAP_IDLE_DELAY_MS = 1_000;

interface NavigatorConnection {
  saveData?: boolean;
  effectiveType?: string;
}

let runtimePromise: Promise<typeof import("./StoryMapRuntime")> | undefined;

export function preloadStoryMapRuntime(): Promise<
  typeof import("./StoryMapRuntime")
> {
  markStoryPerformance("story-map-runtime-requested");
  runtimePromise ??= import("./StoryMapRuntime").then((module) => {
    markStoryPerformance("story-map-runtime-loaded");
    return module;
  });
  return runtimePromise;
}

const LazyStoryMapRuntime = lazy(async () => {
  const module = await preloadStoryMapRuntime();
  return { default: module.StoryMapRuntime };
});

function usesConstrainedConnection(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NavigatorConnection }
  ).connection;
  return (
    connection?.saveData === true ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}

function findScrollContainer(element: HTMLElement): HTMLElement | Window {
  let current = element.parentElement;
  while (current) {
    const overflow = getComputedStyle(current).overflowY;
    if (overflow === "auto" || overflow === "scroll") return current;
    current = current.parentElement;
  }
  return window;
}

export function useStoryMapRuntimePreload(
  readerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  eager: boolean
): void {
  useEffect(() => {
    if (!enabled) return;
    if (eager) {
      void preloadStoryMapRuntime();
      return;
    }

    const trigger = () => {
      void preloadStoryMapRuntime();
    };
    const scrollTarget = readerRef.current
      ? findScrollContainer(readerRef.current)
      : window;
    scrollTarget.addEventListener("scroll", trigger, {
      passive: true,
      once: true,
    });

    if (usesConstrainedConnection()) {
      return () => scrollTarget.removeEventListener("scroll", trigger);
    }

    const idleWindow = window;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(trigger, { timeout: 1_500 });
    } else {
      timeoutHandle = setTimeout(trigger, STORY_MAP_IDLE_DELAY_MS);
    }

    return () => {
      scrollTarget.removeEventListener("scroll", trigger);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, [readerRef, enabled, eager]);
}

function MapPanelPlaceholder({ height }: { height: string }) {
  return (
    <Flex
      h={height}
      align="center"
      justify="center"
      bg="brand.bgSubtle"
      border="1px solid"
      borderColor="brand.border"
      color="brand.brown"
      role="status"
      aria-label="Preparing interactive map"
    >
      <BrandSpinner size={28} />
    </Flex>
  );
}

function ChapterNarrative({
  index,
  title,
  narrative,
}: {
  index: number;
  title: string;
  narrative: string;
}) {
  return (
    <Box maxW="800px" mx="auto" mb={6}>
      <Text
        fontSize="10px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.orange"
        fontWeight={600}
        mb={2}
      >
        Chapter {index + 1}
      </Text>
      {title && (
        <Heading size="lg" mb={4} color="gray.800">
          {title}
        </Heading>
      )}
      {narrative && (
        <Box
          fontSize="md"
          color="gray.700"
          lineHeight="1.8"
          maxW="65ch"
          css={{
            "& p": { marginBottom: "1em" },
            "& h1, & h2, & h3": {
              fontWeight: 600,
              marginBottom: "0.5em",
            },
          }}
        >
          <Markdown>{narrative}</Markdown>
        </Box>
      )}
    </Box>
  );
}

function StoryMapPlaceholder({ block }: { block: MapContentBlock }) {
  if (block.type === "map") {
    return (
      <Box maxW="900px" mx="auto" px={8} py={12}>
        <ChapterNarrative
          index={block.index}
          title={block.chapter.title}
          narrative={block.chapter.narrative}
        />
        <Box borderRadius="12px" overflow="hidden" shadow="sm">
          <MapPanelPlaceholder height="500px" />
        </Box>
      </Box>
    );
  }

  if (block.type === "flyover") {
    const heightVh =
      Math.max(0.25, block.chapter.scroll_length) *
      Math.max(1, block.chapter.keyframes.length) *
      100;
    return (
      <Box position="relative" style={{ height: `${heightVh}vh` }}>
        <Box position="sticky" top={0} h="100vh">
          <MapPanelPlaceholder height="100vh" />
          <Box position="absolute" left={8} bottom={8} right={8}>
            <Box
              maxW="480px"
              bg="rgba(255, 255, 255, 0.88)"
              backdropFilter="blur(12px)"
              borderRadius="12px"
              p={6}
            >
              <ChapterNarrative
                index={block.index}
                title={block.chapter.title}
                narrative={block.chapter.narrative}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box position="relative">
      <Box position="sticky" top={0} h="100vh">
        <MapPanelPlaceholder height="100vh" />
      </Box>
      <Box position="relative" zIndex={5} mt="-100vh" pointerEvents="none">
        {block.chapters.map((chapter, index) => (
          <Box
            key={chapter.id}
            w="35%"
            minW="320px"
            maxW="480px"
            px={6}
            pt={index === 0 ? 12 : 4}
            pb="80vh"
            ml={chapter.overlay_position === "right" ? "auto" : 0}
            mr={chapter.overlay_position === "right" ? 0 : "auto"}
          >
            <Box
              bg="rgba(255, 255, 255, 0.88)"
              backdropFilter="blur(12px)"
              borderRadius="12px"
              p={6}
              shadow="lg"
              pointerEvents="auto"
            >
              <Text
                fontSize="10px"
                textTransform="uppercase"
                letterSpacing="1px"
                color="brand.orange"
                fontWeight={600}
                mb={2}
              >
                Chapter {block.startIndex + index + 1}
              </Text>
              <Heading size="md" mb={3} color="gray.800">
                {chapter.title}
              </Heading>
              <Box fontSize="sm" color="gray.700" lineHeight="1.7" maxW="65ch">
                <Markdown>{chapter.narrative}</Markdown>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function StoryMapHydrationBoundary({
  block,
  datasetMap,
  connectionMap,
  onChapterClick,
  registerBridge,
  eager = false,
}: {
  block: MapContentBlock;
  datasetMap: Map<string, Dataset | null>;
  connectionMap?: Map<string, Connection>;
  onChapterClick?: (chapterId: string) => void;
  registerBridge?: (bridge: AgentBridge) => void;
  eager?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldHydrate, setShouldHydrate] = useState(eager);

  useEffect(() => {
    if (eager) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setShouldHydrate(true);
      return;
    }

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void preloadStoryMapRuntime();
          preloadObserver.disconnect();
        }
      },
      { rootMargin: STORY_MAP_PRELOAD_MARGIN }
    );
    const hydrateObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          markStoryPerformance("story-map-hydration-start");
          setShouldHydrate(true);
          hydrateObserver.disconnect();
        }
      },
      { rootMargin: STORY_MAP_HYDRATE_MARGIN }
    );

    preloadObserver.observe(host);
    hydrateObserver.observe(host);
    return () => {
      preloadObserver.disconnect();
      hydrateObserver.disconnect();
    };
  }, [eager]);

  return (
    <Box ref={hostRef} data-story-map-boundary={block.type}>
      {shouldHydrate ? (
        <Suspense fallback={<StoryMapPlaceholder block={block} />}>
          <LazyStoryMapRuntime
            block={block}
            datasetMap={datasetMap}
            connectionMap={connectionMap}
            onChapterClick={onChapterClick}
            registerBridge={registerBridge}
          />
        </Suspense>
      ) : (
        <StoryMapPlaceholder block={block} />
      )}
    </Box>
  );
}
