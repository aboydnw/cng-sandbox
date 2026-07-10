import {
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import scrollama from "scrollama";
import type { MapRef } from "react-map-gl/maplibre";
import { UnifiedMap } from "./UnifiedMap";
import { ProseChapter } from "./ProseChapter";
import { MapChapter } from "./MapChapter";
import { FlyoverBlock } from "./FlyoverBlock";
import { ImageChapterRenderer } from "./ImageChapterRenderer";
import { VideoChapterRenderer } from "./VideoChapterRenderer";
import { ChartChapterRenderer } from "./ChartChapterRenderer";
import { RenderModeIndicator } from "./RenderModeIndicator";
import { type CameraState, cameraFromBounds } from "../lib/layers";
import {
  groupChaptersIntoBlocks,
  buildLayersForChapter,
} from "../lib/story/rendering";
import { useStoryZarrNode } from "../hooks/useStoryZarrNode";
import { connectionToMapItem, datasetToMapItem } from "../hooks/useMapData";
import type { CopcColorMode } from "../lib/layers/copcLayer";
import type { Story, ScrollytellingChapter } from "../lib/story";
import { flyoverFallbackMapChapter } from "../lib/story/types";
import type { Connection, Dataset } from "../types";
import type { ZarrNode } from "../hooks/useZarrNode";
import type { ActiveLayer, AgentBridge } from "../lib/chat/types";
import { chapterTransitionDuration } from "../lib/story/chapterTransition";
import { chapterAllowsTerrain } from "../lib/story/terrainPolicy";
import {
  reconcileHighlightMarkers,
  createHighlightMarker,
  type Highlight,
  type MarkerHandle,
} from "../lib/layers/highlightMarkers";

function resolveActiveLayers(
  chapter: ScrollytellingChapter | undefined,
  datasetMap: Map<string, Dataset | null>,
  connectionMap: Map<string, Connection> | undefined,
  layerVisibility: Record<string, boolean>
): ActiveLayer[] {
  const lc = chapter?.layer_config;
  if (!lc) return [];
  const visibleOf = (id: string) => layerVisibility[id] !== false;

  if (lc.connection_id && connectionMap) {
    const conn = connectionMap.get(lc.connection_id);
    if (!conn) return [];
    const base = {
      layer_id: lc.connection_id,
      label: conn.name,
      visible: visibleOf(lc.connection_id),
    };
    if (conn.connection_type === "cog") {
      return [{ ...base, type: "raster-cog", cogUrl: conn.url }];
    }
    if (conn.connection_type === "zarr") {
      return [{ ...base, type: "zarr", cogUrl: conn.url }];
    }
    return [{ ...base, type: "vector-geoparquet" }];
  }

  const ds = datasetMap.get(lc.dataset_id);
  if (!ds) return [];
  const base = {
    layer_id: lc.dataset_id,
    label: ds.title ?? ds.filename,
    visible: visibleOf(lc.dataset_id),
  };
  if (ds.dataset_type === "raster") {
    return [{ ...base, type: "raster-cog", cogUrl: ds.cog_url ?? undefined }];
  }
  return [
    {
      ...base,
      type: "vector-geoparquet",
      collectionId: ds.pg_table ?? ds.id,
    },
  ];
}

function ScrollytellingBlock({
  chapters,
  startIndex,
  datasetMap,
  connectionMap,
  onChapterClick,
  registerBridge,
}: {
  chapters: ScrollytellingChapter[];
  startIndex: number;
  datasetMap: Map<string, Dataset | null>;
  connectionMap?: Map<string, Connection>;
  onChapterClick?: (chapterId: string) => void;
  registerBridge?: (bridge: AgentBridge) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({});
  const [highlights, setHighlights] = useState<Highlight[]>([]);
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
  const stepsRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<ReturnType<typeof scrollama> | null>(null);
  const activeIndexRef = useRef(0);
  const highlightTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mapRef = useRef<MapRef | null>(null);
  const markerRegistry = useRef<Map<string, MarkerHandle>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // Callback ref for the map: on (re)mount, drop any marker handles bound to a
  // previous map instance and flip `mapReady` so the highlight effect below
  // replays active highlights onto the fresh map (they'd otherwise be lost if a
  // highlight arrived while the map was unmounted between chapter types).
  const handleMapRef = useCallback((instance: MapRef | null) => {
    mapRef.current = instance;
    const registry = markerRegistry.current;
    for (const handle of registry.values()) handle.remove();
    registry.clear();
    setMapReady(instance != null);
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const timeouts = highlightTimeouts.current;
    return () => timeouts.forEach(clearTimeout);
  }, []);

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

    // Find the nearest scrollable ancestor for scrollama's container option.
    // StoryReaderPage wraps us in an overflowY:auto container; scrollama
    // needs to observe that element instead of the window.
    let scrollParent: HTMLElement | undefined;
    let el: HTMLElement | null = stepsRef.current.parentElement;
    while (el) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        scrollParent = el;
        break;
      }
      el = el.parentElement;
    }

    const scroller = scrollama();
    scrollerRef.current = scroller;

    scroller
      .setup({
        step: stepsRef.current.querySelectorAll(
          "[data-step]"
        ) as unknown as HTMLElement[],
        offset: 0.8,
        ...(scrollParent ? { container: scrollParent } : {}),
      } as Parameters<typeof scroller.setup>[0])
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

    setTransitionDuration(chapterTransitionDuration(chapter.transition));

    setCamera({
      longitude: chapter.map_state.center[0],
      latitude: chapter.map_state.center[1],
      zoom: chapter.map_state.zoom,
      bearing: chapter.map_state.bearing,
      pitch: chapter.map_state.pitch,
    });
  }, [activeIndex, chapters]);

  const activeChapter = chapters[activeIndex];
  const activeConnId = activeChapter?.layer_config?.connection_id ?? null;
  const activeConn = activeConnId
    ? (connectionMap?.get(activeConnId) ?? null)
    : null;
  const { node: zarrNode, error: zarrError } = useStoryZarrNode(activeConn);
  const zarrNodeMap = useMemo<Map<string, ZarrNode>>(() => {
    if (activeConnId && zarrNode) {
      return new Map([[activeConnId, zarrNode]]);
    }
    return new Map();
  }, [activeConnId, zarrNode]);

  const { layers: chapterLayers, renderMetadata } = useMemo(
    () =>
      buildLayersForChapter(
        chapters[activeIndex],
        datasetMap,
        connectionMap,
        zarrNodeMap
      ),
    [datasetMap, connectionMap, activeIndex, chapters, zarrNodeMap]
  );

  const activeLayerId =
    activeChapter?.layer_config?.connection_id ??
    activeChapter?.layer_config?.dataset_id;
  const activeLayerHidden = activeLayerId
    ? layerVisibility[activeLayerId] === false
    : false;

  const layers = useMemo(
    () => (activeLayerHidden ? [] : chapterLayers),
    [activeLayerHidden, chapterLayers]
  );

  // Render agent highlights as maplibre Markers (not deck layers) so they
  // track terrain elevation and sit on elevated peaks instead of sinking to
  // ellipsoid height 0.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    const registry = markerRegistry.current;
    if (!map) return;
    reconcileHighlightMarkers(highlights, registry, (h) =>
      createHighlightMarker(map, h)
    );
  }, [highlights, mapReady]);

  useEffect(() => {
    const registry = markerRegistry.current;
    return () => {
      for (const handle of registry.values()) handle.remove();
      registry.clear();
    };
  }, []);

  const handleCameraChange = useCallback((c: CameraState) => {
    setCamera(c);
    setTransitionDuration(undefined);
  }, []);

  const layerVisibilityRef = useRef(layerVisibility);
  useEffect(() => {
    layerVisibilityRef.current = layerVisibility;
  }, [layerVisibility]);

  const bridge = useMemo<AgentBridge>(
    () => ({
      flyTo: (longitude, latitude, zoom, pitch, bearing) => {
        setTransitionDuration(2500);
        setCamera({
          longitude,
          latitude,
          zoom,
          bearing: bearing ?? 0,
          pitch: pitch ?? 0,
        });
      },
      goToChapter: (index) => {
        const local = index - startIndex;
        const steps = stepsRef.current?.querySelectorAll("[data-step]");
        const el = steps?.[local] as HTMLElement | undefined;
        el?.scrollIntoView({ behavior: "smooth" });
      },
      setLayerVisibility: (layerId, visible) => {
        setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }));
      },
      highlightLocation: (longitude, latitude, label) => {
        const id = `${startIndex}-${longitude}-${latitude}-${label}`;
        setHighlights((prev) => [
          ...prev.filter((h) => h.id !== id),
          { id, longitude, latitude, label },
        ]);
        const timeout = setTimeout(() => {
          setHighlights((prev) => prev.filter((h) => h.id !== id));
        }, 8000);
        highlightTimeouts.current.push(timeout);
      },
      getActiveLayers: () =>
        resolveActiveLayers(
          chapters[activeIndexRef.current],
          datasetMap,
          connectionMap,
          layerVisibilityRef.current
        ),
      getChapters: () =>
        chapters.map((chapter, i) => ({
          index: startIndex + i,
          title: chapter.title,
        })),
    }),
    [chapters, startIndex, datasetMap, connectionMap]
  );

  useEffect(() => {
    registerBridge?.(bridge);
  }, [registerBridge, bridge]);

  const hasConnection =
    activeChapter?.layer_config?.connection_id &&
    connectionMap?.has(activeChapter.layer_config.connection_id);
  const activeDataset = activeChapter
    ? datasetMap.get(activeChapter.layer_config.dataset_id)
    : undefined;

  const copcItem = useMemo(() => {
    if (activeConn?.connection_type === "copc")
      return connectionToMapItem(activeConn);
    if (activeDataset && activeDataset.dataset_type === "pointcloud")
      return datasetToMapItem(activeDataset);
    return null;
  }, [activeConn, activeDataset]);
  const copcColorMode =
    (activeChapter?.layer_config?.color_mode as CopcColorMode | undefined) ??
    "elevation";
  const copcPointSize = activeChapter?.layer_config?.point_size ?? 2;

  return (
    <Box position="relative">
      {/* Sticky map — stays fixed in viewport while steps scroll past */}
      <Box position="sticky" top={0} h="100vh" zIndex={0}>
        {(datasetMap.size > 0 || (connectionMap && connectionMap.size > 0)) && (
          <UnifiedMap
            mapRef={handleMapRef}
            camera={camera}
            onCameraChange={handleCameraChange}
            layers={layers}
            basemap={basemap}
            onBasemapChange={setBasemap}
            transitionDuration={transitionDuration}
            terrain={activeChapter?.map_state.terrain}
            globe={activeChapter?.map_state.globe}
            buildings={activeChapter?.map_state.buildings}
            allowTerrain={chapterAllowsTerrain(activeChapter?.layer_config)}
            interactive={false}
            copcItem={copcItem}
            copcColorMode={copcColorMode}
            copcPointSize={copcPointSize}
          />
        )}
        {renderMetadata && !(activeDataset === null && !hasConnection) && (
          <Box position="absolute" top={3} right={3} zIndex={10}>
            <RenderModeIndicator {...renderMetadata} />
          </Box>
        )}
        {zarrError && (
          <Box
            position="absolute"
            top={4}
            left={4}
            bg="red.subtle"
            borderWidth="1px"
            borderColor="red.border"
            color="red.fg"
            px={3}
            py={2}
            fontSize="sm"
            zIndex={10}
          >
            Couldn&apos;t open Zarr store: {zarrError}
          </Box>
        )}
        {activeDataset === null && !hasConnection && (
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

      {/* Steps in normal document flow — pulled up over the sticky map */}
      <Box
        ref={stepsRef}
        position="relative"
        zIndex={5}
        mt="-100vh"
        pointerEvents="none"
      >
        {chapters.map((chapter, i) => (
          <Box
            key={chapter.id}
            data-step
            w="35%"
            minW="320px"
            maxW="480px"
            px={6}
            pt={i === 0 ? 12 : 4}
            pb="80vh"
            opacity={activeIndex === i ? 1 : 0.3}
            transition="opacity 400ms cubic-bezier(0.32, 0.72, 0, 1)"
            pointerEvents="auto"
            ml={chapter.overlay_position === "right" ? "auto" : 0}
            mr={chapter.overlay_position === "right" ? 0 : "auto"}
            onClick={
              onChapterClick ? () => onChapterClick(chapter.id) : undefined
            }
            cursor={onChapterClick ? "pointer" : undefined}
          >
            <Box
              bg="rgba(255, 255, 255, 0.85)"
              backdropFilter="blur(12px)"
              borderRadius="12px"
              p={6}
              shadow="lg"
              border="1px solid"
              borderColor={
                activeIndex === i
                  ? "rgba(200, 150, 100, 0.4)"
                  : "rgba(255, 255, 255, 0.3)"
              }
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
                <Markdown>{chapter.narrative}</Markdown>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

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
  const sortedChapters = useMemo(
    () => [...story.chapters].sort((a, b) => a.order - b.order),
    [story]
  );

  // The active ScrollytellingBlock registers its live bridge here; the exposed
  // handle delegates to it, falling back to a chapter list + no-ops before any
  // scrolly block has mounted (or for non-scrolly stories).
  const bridgeDelegateRef = useRef<AgentBridge | null>(null);
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

  const contentBlocks = useMemo(
    () => groupChaptersIntoBlocks(sortedChapters),
    [sortedChapters]
  );

  const firstScrollyBlockIndex = useMemo(
    () => contentBlocks.findIndex((block) => block.type === "scrollytelling"),
    [contentBlocks]
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
          const conn = block.chapter.layer_config.connection_id
            ? connectionMap?.get(block.chapter.layer_config.connection_id)
            : undefined;
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
                connection={conn}
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

        if (block.type === "flyover") {
          if (block.chapter.keyframes.length < 2) {
            const fallback = flyoverFallbackMapChapter(block.chapter);
            const ds = datasetMap.get(fallback.layer_config.dataset_id) ?? null;
            const conn = fallback.layer_config.connection_id
              ? connectionMap?.get(fallback.layer_config.connection_id)
              : undefined;
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
                  chapter={fallback}
                  chapterIndex={block.index}
                  dataset={ds}
                  connection={conn}
                />
              </Box>
            );
          }
          return (
            <FlyoverBlock
              key={block.chapter.id}
              chapter={block.chapter}
              chapterIndex={block.index}
              datasetMap={datasetMap}
              connectionMap={connectionMap}
              onChapterClick={onChapterClick}
            />
          );
        }

        return (
          <ScrollytellingBlock
            key={`scrolly-${blockIndex}`}
            chapters={block.chapters}
            startIndex={block.startIndex}
            datasetMap={datasetMap}
            connectionMap={connectionMap}
            onChapterClick={onChapterClick}
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
    </>
  );
}
