import { useMemo, useRef, useState } from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import { UnifiedMap } from "./UnifiedMap";
import { buildLayersForChapter } from "../lib/story/rendering";
import { chapterAllowsTerrain } from "../lib/story/terrainPolicy";
import {
  captionOpacity,
  interpolateFlyover,
} from "../lib/story/flyover/interpolate";
import { useFlyoverScroll } from "../lib/story/flyover/useScrollProgress";
import { flyoverEntryMapState } from "../lib/story/types";
import type { FlyoverChapter } from "../lib/story/types";
import type { Connection, Dataset } from "../types";

const noop = () => {};

interface MapHandle {
  getMap: () => { jumpTo: (opts: object) => void };
}

/**
 * Reader runtime for a flyover chapter: a sticky map inside a container
 * `scroll_length × keyframes` viewport-heights tall. Scroll progress drives
 * `map.jumpTo` imperatively through the map ref every animation frame —
 * UnifiedMap's camera prop stays frozen at the entry pose and its echo
 * effect is disabled via `scrubbing`. Requires >= 2 keyframes (the caller
 * falls back to a plain map chapter below that).
 */
export function FlyoverBlock({
  chapter,
  chapterIndex,
  datasetMap,
  connectionMap,
  onChapterClick,
}: {
  chapter: FlyoverChapter;
  chapterIndex: number;
  datasetMap: Map<string, Dataset | null>;
  connectionMap?: Map<string, Connection>;
  onChapterClick?: (chapterId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const [progress, setProgress] = useState(0);

  const entry = useMemo(() => flyoverEntryMapState(chapter), [chapter]);
  const entryCamera = useMemo(
    () => ({
      longitude: entry.center[0],
      latitude: entry.center[1],
      zoom: entry.zoom,
      bearing: entry.bearing,
      pitch: entry.pitch,
    }),
    [entry]
  );

  const { layers } = useMemo(
    () => buildLayersForChapter(chapter, datasetMap, connectionMap),
    [chapter, datasetMap, connectionMap]
  );

  const count = chapter.keyframes.length;

  useFlyoverScroll(containerRef, count, {
    onFrame: (t) => {
      const pose = interpolateFlyover(chapter.keyframes, t);
      if (pose) {
        mapRef.current?.getMap().jumpTo({
          center: pose.center,
          zoom: pose.zoom,
          bearing: pose.bearing,
          pitch: pose.pitch,
        });
      }
      // Quantize so caption re-renders cap out well below 60/s.
      setProgress(Math.round(t * 1000) / 1000);
    },
    onStep: (index) => {
      const k = chapter.keyframes[index];
      if (k) {
        mapRef.current?.getMap().jumpTo({
          center: k.center,
          zoom: k.zoom,
          bearing: k.bearing,
          pitch: k.pitch,
        });
      }
      setProgress(count > 1 ? index / (count - 1) : 0);
    },
  });

  const heightVh = Math.max(0.25, chapter.scroll_length) * count * 100;

  return (
    <Box
      ref={containerRef}
      position="relative"
      style={{ height: `${heightVh}vh` }}
      onClick={onChapterClick ? () => onChapterClick(chapter.id) : undefined}
      cursor={onChapterClick ? "pointer" : undefined}
    >
      <Box position="sticky" top={0} h="100vh" zIndex={0}>
        <UnifiedMap
          camera={entryCamera}
          onCameraChange={noop}
          layers={layers}
          basemap={chapter.map_state.basemap}
          onBasemapChange={noop}
          terrain={chapter.map_state.terrain}
          globe={chapter.map_state.globe}
          buildings={chapter.map_state.buildings}
          allowTerrain={chapterAllowsTerrain(chapter.layer_config)}
          interactive={false}
          scrubbing
          fadeDuration={0}
          mapRef={mapRef}
        />

        {/* Intro card: title + narrative, visible around the start */}
        {(chapter.title || chapter.narrative) && (
          <Box
            position="absolute"
            top={8}
            left={6}
            maxW="420px"
            opacity={captionOpacity(progress, 0, count)}
            transition="opacity 200ms linear"
            pointerEvents="none"
            bg="rgba(255, 255, 255, 0.85)"
            backdropFilter="blur(12px)"
            borderRadius="12px"
            p={5}
            shadow="lg"
            border="1px solid"
            borderColor="rgba(200, 150, 100, 0.4)"
          >
            <Text
              fontSize="10px"
              textTransform="uppercase"
              letterSpacing="1px"
              color="brand.orange"
              fontWeight={600}
              mb={2}
            >
              Chapter {chapterIndex + 1}
            </Text>
            <Heading size="md" mb={2} color="gray.800">
              {chapter.title}
            </Heading>
            {chapter.narrative && (
              <Box fontSize="sm" color="gray.700" lineHeight="1.7">
                <Markdown>{chapter.narrative}</Markdown>
              </Box>
            )}
          </Box>
        )}

        {/* Keyframe captions: fade in/out around each keyframe's t */}
        {chapter.keyframes.map((k, i) =>
          k.caption ? (
            <Box
              key={i}
              position="absolute"
              bottom="10vh"
              left="50%"
              transform="translateX(-50%)"
              w="min(90%, 480px)"
              opacity={captionOpacity(progress, i, count)}
              transition="opacity 200ms linear"
              pointerEvents="none"
              bg="rgba(255, 255, 255, 0.85)"
              backdropFilter="blur(12px)"
              borderRadius="12px"
              p={5}
              shadow="lg"
              border="1px solid"
              borderColor="rgba(200, 150, 100, 0.4)"
            >
              <Box fontSize="sm" color="gray.700" lineHeight="1.7">
                <Markdown>{k.caption}</Markdown>
              </Box>
            </Box>
          ) : null
        )}
      </Box>
    </Box>
  );
}
