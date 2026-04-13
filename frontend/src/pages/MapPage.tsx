import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useOptionalWorkspace } from "../hooks/useWorkspace";
import { Box, Flex, Text } from "@chakra-ui/react";
import { SpinnerGap } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { SharedHeader } from "../components/SharedHeader";
import { ShareButton } from "../components/ShareButton";
import { BugReportLink } from "../components/BugReportLink";
import { ReportCard, getTileUrlPrefix } from "../components/ReportCard";
import { ConnectionReportCard } from "../components/ConnectionReportCard";
import { UnifiedMap } from "../components/UnifiedMap";
import {
  PixelInspectorTooltip,
  usePixelInspector,
} from "../components/PixelInspector";
import { VectorPopupOverlay, useVectorPopup } from "../components/VectorPopup";
import {
  type CameraState,
  type TileCacheEntry,
  DEFAULT_CAMERA,
  cameraFromBounds,
} from "../lib/layers";
import { useColorScale, MapLegend } from "../lib/maptool";
import { TemporalControls } from "../components/TemporalControls";
import { useTemporalAnimation } from "../hooks/useTemporalAnimation";
import { useTemporalExport } from "../hooks/useTemporalExport";
import { useTileTransferSize } from "../hooks/useTileTransferSize";
import { detectCadence } from "../utils/temporal";
import { MapSidePanel } from "../components/MapSidePanel";
import { useMapData } from "../hooks/useMapData";
import { useMapControls } from "../hooks/useMapControls";
import { useLayerBuilder } from "../hooks/useLayerBuilder";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { Table } from "apache-arrow";

export default function MapPage({ shared = false }: { shared?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspace = useOptionalWorkspace();
  const workspacePath = workspace?.workspacePath ?? ((p: string) => p);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTimestep = Number(searchParams.get("t") ?? 0);

  const isConnectionRoute =
    window.location.pathname.includes("/map/connection/");

  // --- Data fetching ---
  const {
    data: item,
    isLoading,
    error,
    isExpired,
  } = useMapData(id, isConnectionRoute);

  // Redirect on expiry
  useEffect(() => {
    if (isExpired && id && workspace) {
      navigate(workspacePath(`/expired/${id}`), { replace: true });
    }
  }, [isExpired, id, navigate, workspacePath, workspace]);

  // --- Controls ---
  const controls = useMapControls(item);

  // --- Camera ---
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [basemap, setBasemap] = useState("streets");
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const boundsKey = item?.bounds?.join(",") ?? "";
  useLayoutEffect(() => {
    if (item?.bounds) {
      const el = mapContainerRef.current;
      const size = el
        ? { width: el.clientWidth, height: el.clientHeight }
        : undefined;
      setCamera(cameraFromBounds(item.bounds, size));
    }
  }, [item?.id, boundsKey]);

  // --- Report card ---
  const [reportCardOpen, setReportCardOpen] = useState(false);

  // --- Tile transfer size ---
  const tileUrlPrefix = item?.dataset?.tile_url
    ? getTileUrlPrefix(item.dataset.tile_url)
    : "";
  const bytesTransferred = useTileTransferSize(tileUrlPrefix);

  // --- Temporal ---
  const ds = item?.dataset;
  const frameCount = ds?.timesteps?.length ?? 0;
  const gapIndices = useMemo(() => new Set<number>(), []);

  const loadedRef = useRef<Set<number>>(new Set());
  const [loadedCount, setLoadedCount] = useState(0);
  const callbacksRef = useRef<Record<number, () => void>>({});

  const getLoadCallback = useCallback((index: number) => {
    if (!callbacksRef.current[index]) {
      callbacksRef.current[index] = () => {
        if (!loadedRef.current.has(index)) {
          loadedRef.current.add(index);
          setLoadedCount(loadedRef.current.size);
        }
      };
    }
    return callbacksRef.current[index];
  }, []);

  // Reset preload tracking when item changes
  useEffect(() => {
    loadedRef.current.clear();
    callbacksRef.current = {};
    setLoadedCount(0);
  }, [item?.id]);

  const isPreloaded = !ds?.is_temporal || loadedCount >= frameCount;

  const cadence = useMemo(
    () =>
      ds?.is_temporal
        ? detectCadence(ds.timesteps.map((t) => t.datetime))
        : ("irregular" as const),
    [ds]
  );

  const animation = useTemporalAnimation(
    frameCount,
    gapIndices,
    isPreloaded,
    initialTimestep
  );

  const preloadProgress =
    ds?.is_temporal && animation.isAnimateMode && !isPreloaded
      ? { current: loadedCount, total: frameCount }
      : null;

  // Progressive preloading: only render the active layer + already-loaded
  // layers + one more unloaded layer at a time. This lets the first timestep
  // load fast while the rest preload sequentially in the background.
  // Only computed in animate mode — browse mode uses a single layer.
  const renderIndices = useMemo(() => {
    if (!animation.isAnimateMode) return undefined;
    const indices = new Set<number>();
    indices.add(animation.activeIndex);
    loadedRef.current.forEach((i) => indices.add(i));
    for (let i = 0; i < frameCount; i++) {
      if (!indices.has(i)) {
        indices.add(i);
        break;
      }
    }
    return indices;
    // loadedCount is the reactive trigger for loadedRef changes
  }, [animation.isAnimateMode, animation.activeIndex, loadedCount, frameCount]);

  const speedMs = { 0.5: 1600, 1: 800, 2: 400 }[animation.speed] ?? 800;
  const deckRef = useRef(null);
  const exportHook = useTemporalExport(
    deckRef,
    ds?.timesteps ?? [],
    gapIndices,
    speedMs
  );

  useEffect(() => {
    if (ds?.is_temporal) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("t", String(animation.activeIndex));
          return next;
        },
        { replace: true }
      );
    }
  }, [animation.activeIndex, ds?.is_temporal, setSearchParams]);

  // --- Local categories (optimistic updates from editable legend) ---
  const [localCategories, setLocalCategories] = useState<
    { value: number; color: string; label: string }[] | null
  >(null);

  useEffect(() => {
    setLocalCategories(null);
  }, [item?.id]);

  const effectiveCategories = localCategories ?? item?.categories ?? null;

  // --- Arrow table for GeoParquet ---
  const [arrowTable, setArrowTable] = useState<Table | null>(null);

  useEffect(() => {
    setArrowTable(null);
  }, [item?.id]);

  const handleTableChange = useCallback((table: Table | null) => {
    setArrowTable(table);
  }, []);

  // --- Popups & pixel inspector ---
  const tileCacheRef = useRef<Map<string, TileCacheEntry>>(new Map());
  const vectorPopup = useVectorPopup();
  const pixelInspector = usePixelInspector(
    tileCacheRef,
    item?.bandNames ?? null
  );

  // --- Layers ---
  const { layers } = useLayerBuilder({
    item,
    renderMode: controls.renderMode,
    canClientRender: controls.canClientRender,
    opacity: controls.opacity,
    colormapName: controls.colormapName,
    effectiveBand: controls.effectiveBand,
    isSingleBand: controls.isSingleBand,
    isMultiBand: controls.isMultiBand,
    isCategorical: controls.isCategorical,
    activeTimestepIndex: animation.activeIndex,
    renderIndices,
    isAnimateMode: animation.isAnimateMode,
    getLoadCallback,
    tileCacheRef,
    arrowTable,
    onVectorClick: vectorPopup.onClick,
  });

  // --- Color scale for legend ---
  const domain: [number, number] =
    item?.rasterMin != null && item?.rasterMax != null
      ? [item.rasterMin, item.rasterMax]
      : [0, 1];

  const { colors } = useColorScale({
    domain,
    colormap: controls.colormapName,
  });

  // --- Event handlers ---
  const onHover =
    controls.renderMode === "client" && controls.canClientRender
      ? pixelInspector.onHover
      : undefined;

  const onMapClick =
    item?.dataType === "vector" && controls.renderMode !== "geojson"
      ? vectorPopup.onClick
      : undefined;

  const getTooltip = useMemo(() => {
    if (item?.dataType !== "vector" || controls.renderMode !== "geojson")
      return undefined;
    return ({ object }: { object?: Record<string, unknown> }) => {
      if (!object) return null;
      const props = Object.entries(object)
        .filter(([k]) => k !== "geometry" && k !== "geom")
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      return { text: props, style: { fontSize: "12px" } };
    };
  }, [item?.dataType, controls.renderMode]);

  // --- Render ---
  if (isLoading) {
    return (
      <Box minH="100vh" bg="white">
        {shared ? <SharedHeader /> : <Header />}
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <SpinnerGap
            size={32}
            color="#CF3F02"
            style={{ animation: "spin 1s linear infinite" }}
          />
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" bg="white">
        {shared ? <SharedHeader /> : <Header />}
        <Flex
          direction="column"
          align="center"
          justify="center"
          h="calc(100vh - 56px)"
          gap={4}
        >
          <Text color="red.500">{error}</Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      {shared ? (
        <SharedHeader />
      ) : (
        <Header>
          {item?.dataset && <BugReportLink datasetId={item.dataset.id} />}
          {item?.connection && (
            <BugReportLink connectionId={item.connection.id} />
          )}
          <ShareButton
            shareUrl={`${window.location.origin}/map/${isConnectionRoute ? "connection/" : ""}${id}`}
          />
        </Header>
      )}

      <ErrorBoundary>
        <Flex flex={1} overflow="hidden">
          <Box flex={7} position="relative" ref={mapContainerRef}>
            <UnifiedMap
              ref={deckRef}
              camera={camera}
              onCameraChange={setCamera}
              layers={layers}
              basemap={basemap}
              onBasemapChange={setBasemap}
              onHover={onHover}
              onClick={onMapClick}
              getTooltip={getTooltip}
              hideBasemapPicker={shared}
            >
              {controls.isCategorical &&
                effectiveCategories &&
                effectiveCategories.length > 0 && (
                  <Box position="absolute" bottom={3} left={3}>
                    <MapLegend
                      layers={[
                        {
                          type: "categorical" as const,
                          id: "raster-categorical",
                          title: item?.dataset?.filename ?? "",
                          categories: effectiveCategories.map((c) => ({
                            value: String(c.value),
                            color: c.color,
                            label: c.label,
                          })),
                        },
                      ]}
                    />
                  </Box>
                )}
              {!controls.isCategorical &&
                controls.showingColormap &&
                controls.renderMode !== "client" && (
                  <Box position="absolute" bottom={3} left={3}>
                    <MapLegend
                      layers={[
                        {
                          type: "continuous" as const,
                          id: "raster",
                          title: item?.dataset?.filename ?? "",
                          domain,
                          colors,
                        },
                      ]}
                    />
                  </Box>
                )}

              {ds?.is_temporal && controls.renderMode !== "client" && (
                <TemporalControls
                  timesteps={ds.timesteps}
                  activeIndex={animation.activeIndex}
                  onIndexChange={(index) => {
                    animation.setActiveIndex(index);
                    if (animation.isAnimateMode) animation.exitAnimateMode();
                  }}
                  cadence={cadence}
                  onPrev={() => {
                    if (animation.activeIndex > 0) {
                      animation.setActiveIndex(animation.activeIndex - 1);
                      if (animation.isAnimateMode) animation.exitAnimateMode();
                    }
                  }}
                  onNext={() => {
                    if (animation.activeIndex < ds.timesteps.length - 1) {
                      animation.setActiveIndex(animation.activeIndex + 1);
                      if (animation.isAnimateMode) animation.exitAnimateMode();
                    }
                  }}
                  isPlaying={animation.isPlaying}
                  onTogglePlay={() => {
                    if (!animation.isAnimateMode && !animation.isPlaying) {
                      animation.enterAnimateMode();
                    } else {
                      animation.togglePlay();
                    }
                  }}
                  speed={animation.speed}
                  onSpeedChange={animation.setSpeed}
                  preloadProgress={preloadProgress}
                  onExportGif={() =>
                    exportHook.exportGif(animation.setActiveIndex)
                  }
                  onExportMp4={() =>
                    exportHook.exportMp4(animation.setActiveIndex)
                  }
                  isExporting={exportHook.isExporting}
                />
              )}

              {pixelInspector.hoverInfo && controls.renderMode === "client" && (
                <PixelInspectorTooltip hoverInfo={pixelInspector.hoverInfo} />
              )}

              {vectorPopup.popup &&
                item?.dataType === "vector" &&
                controls.renderMode !== "geojson" && (
                  <VectorPopupOverlay
                    popup={vectorPopup.popup}
                    onDismiss={vectorPopup.dismiss}
                  />
                )}
            </UnifiedMap>
          </Box>

          <Box
            flex={3}
            maxW="340px"
            minW="260px"
            display={{ base: "none", md: "block" }}
            bg="brand.bgSubtle"
            borderLeftWidth="1px"
            borderColor="brand.border"
            overflow="hidden"
          >
            <MapSidePanel
              item={item}
              opacity={controls.opacity}
              onOpacityChange={controls.setOpacity}
              colormapName={controls.colormapName}
              onColormapChange={controls.setColormapName}
              selectedBand={controls.selectedBand}
              onBandChange={controls.setSelectedBand}
              renderMode={controls.renderMode}
              onRenderModeChange={controls.setRenderMode}
              showingColormap={controls.showingColormap}
              selectableBands={controls.selectableBands}
              hasRgb={controls.hasRgb}
              showBands={controls.isMultiBand}
              canClientRender={controls.canClientRender}
              clientRenderDisabledReason={controls.clientRenderDisabledReason}
              bytesTransferred={bytesTransferred}
              onDetailsClick={() => setReportCardOpen(true)}
              onTableChange={handleTableChange}
              isCategorical={controls.isCategorical}
              categories={effectiveCategories}
              onCategoriesChange={setLocalCategories}
              onCategoricalOverride={controls.setCategoricalOverride}
              showCategoricalToggle={!!item?.isCategorical}
              shared={shared}
            />
          </Box>
        </Flex>
      </ErrorBoundary>

      {item?.dataset && (
        <ReportCard
          dataset={item.dataset}
          isOpen={reportCardOpen}
          onClose={() => setReportCardOpen(false)}
        />
      )}
      {item?.connection && (
        <ConnectionReportCard
          connection={item.connection}
          isOpen={reportCardOpen}
          onClose={() => setReportCardOpen(false)}
        />
      )}
    </Box>
  );
}
