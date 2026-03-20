import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Box, Button, Flex, Spinner, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { ShareButton } from "../components/ShareButton";
import { CreditsPanel } from "../components/CreditsPanel";
import { ExploreTab } from "../components/ExploreTab";
import { ReportCard } from "../components/ReportCard";
import { UnifiedMap } from "../components/UnifiedMap";
import { RasterControls } from "../components/RasterControls";
import { PixelInspectorTooltip, usePixelInspector } from "../components/PixelInspector";
import { VectorPopupOverlay, useVectorPopup } from "../components/VectorPopup";
import {
  type CameraState,
  type TileCacheEntry,
  DEFAULT_CAMERA,
  cameraFromBounds,
  buildRasterTileLayers,
  buildCogLayer,
  buildVectorLayer,
  buildGeoJsonLayer,
  arrowTableToGeoJSON,
} from "../lib/layers";
import { useColorScale, MapLegend } from "../lib/maptool";
import { TemporalControls } from "../components/TemporalControls";
import { useTemporalAnimation } from "../hooks/useTemporalAnimation";
import { useTemporalExport } from "../hooks/useTemporalExport";
import { detectCadence, formatTimestepLabel, findGaps } from "../utils/temporal";
import { config } from "../config";
import type { Dataset } from "../types";
import type { Table } from "apache-arrow";
import { ErrorBoundary } from "../components/ErrorBoundary";

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportCardOpen, setReportCardOpen] = useState(false);
  const creditsPanelRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTimestep = Number(searchParams.get("t") ?? 0);
  const [activeTab, setActiveTab] = useState("credits");
  const [basemap, setBasemap] = useState("streets");
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [arrowTable, setArrowTable] = useState<Table | null>(null);

  const [opacity, setOpacity] = useState(0.8);
  const [colormapName, setColormapName] = useState("viridis");
  const [selectedBand, setSelectedBand] = useState<"rgb" | number>("rgb");
  const deckRef = useRef(null);
  const tileCacheRef = useRef<Map<string, TileCacheEntry>>(new Map());

  const vectorPopup = useVectorPopup();
  const pixelInspector = usePixelInspector(tileCacheRef, dataset?.band_names ?? null);

  useEffect(() => {
    if (dataset?.bounds) {
      setCamera(cameraFromBounds(dataset.bounds));
    }
  }, [dataset?.bounds]);

  useEffect(() => {
    async function fetchDataset() {
      try {
        const resp = await fetch(`${config.apiBase}/api/datasets/${id}`);
        if (resp.status === 404) {
          navigate(`/expired/${id}`, { replace: true });
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Dataset = await resp.json();

        const created = new Date(data.created_at);
        const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          navigate(`/expired/${id}`, { replace: true });
          return;
        }

        setDataset(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [id, navigate]);

  // --- Raster band logic ---
  const isSingleBand = dataset?.band_count === 1;
  const isMultiBand = (dataset?.band_count ?? 0) > 1;
  const ci = dataset?.color_interpretation ?? [];
  const hasRgb = ci.length >= 3 && ci[0] === "red" && ci[1] === "green" && ci[2] === "blue";

  const selectableBands = (dataset?.band_names ?? [])
    .map((name, i) => ({ name, index: i }))
    .filter((_, i) => ci[i] !== "alpha");

  const effectiveBand = isMultiBand && !hasRgb && selectedBand === "rgb" ? 0 : selectedBand;
  const showingColormap = isSingleBand || (isMultiBand && effectiveBand !== "rgb");

  // --- Tile URL computation ---
  const tileUrl = useMemo(() => {
    if (!dataset?.tile_url) return "";
    const base = dataset.tile_url;
    const separator = base.includes("?") ? "&" : "?";

    if (isSingleBand) {
      let url = `${base}${separator}colormap_name=${colormapName}`;
      if (dataset.is_temporal && dataset.raster_min != null && dataset.raster_max != null) {
        url += `&rescale=${dataset.raster_min},${dataset.raster_max}`;
      }
      return url;
    }

    if (isMultiBand && typeof effectiveBand === "number") {
      return `${base}${separator}bidx=${effectiveBand + 1}&colormap_name=${colormapName}`;
    }

    return base;
  }, [dataset, colormapName, isSingleBand, isMultiBand, effectiveBand]);

  // --- Color scale for legend ---
  const domain: [number, number] =
    dataset?.is_temporal && dataset.raster_min != null && dataset.raster_max != null
      ? [dataset.raster_min, dataset.raster_max]
      : [0, 1];

  const { colors } = useColorScale({
    domain,
    colormap: colormapName,
  });

  // --- Temporal pre-rendering ---
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

  useEffect(() => {
    loadedRef.current.clear();
    callbacksRef.current = {};
    setLoadedCount(0);
  }, [tileUrl]);

  const frameCount = dataset?.timesteps?.length ?? 0;
  const isPreloaded = !dataset?.is_temporal || loadedCount >= frameCount;
  const preloadProgress = dataset?.is_temporal && !isPreloaded
    ? { current: loadedCount, total: frameCount }
    : null;

  const gapIndices = useMemo(() => new Set<number>(), []);

  const cadence = useMemo(
    () => dataset?.is_temporal ? detectCadence(dataset.timesteps.map((t) => t.datetime)) : "irregular" as const,
    [dataset],
  );

  const animation = useTemporalAnimation(
    frameCount,
    gapIndices,
    isPreloaded,
    initialTimestep,
  );

  const speedMs = { 0.5: 1600, 1: 800, 2: 400 }[animation.speed] ?? 800;
  const exportHook = useTemporalExport(deckRef, dataset?.timesteps ?? [], gapIndices, speedMs);

  useEffect(() => {
    if (dataset?.is_temporal) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("t", String(animation.activeIndex));
          return next;
        },
        { replace: true },
      );
    }
  }, [animation.activeIndex, dataset?.is_temporal, setSearchParams]);

  // --- Client-side COG rendering eligibility ---
  const canClientRender =
    !!dataset &&
    !dataset.is_temporal &&
    !!dataset.cog_url &&
    !!dataset.bounds &&
    Math.abs(dataset.bounds[1]) < 85.05 &&
    Math.abs(dataset.bounds[3]) < 85.05;

  // --- GeoJSON from arrow table ---
  const geojson = useMemo(
    () => arrowTable ? arrowTableToGeoJSON(arrowTable) : null,
    [arrowTable],
  );

  // --- Gap count ---
  const gapCount = dataset?.is_temporal
    ? findGaps(dataset.timesteps.map((t: { datetime: string }) => t.datetime)).length
    : 0;

  // --- Build deck.gl layers ---
  const layers = useMemo(() => {
    if (!dataset) return [];

    if (dataset.dataset_type === "raster") {
      if (activeTab === "client" && canClientRender) {
        return buildCogLayer({
          cogUrl: dataset.cog_url!,
          opacity,
          rasterMin: dataset.raster_min ?? 0,
          rasterMax: dataset.raster_max ?? 1,
          datasetBounds: dataset.bounds,
          tileCacheRef,
        });
      }
      return buildRasterTileLayers({
        id: `raster-layer-${colormapName}-${effectiveBand}`,
        tileUrl,
        opacity,
        isTemporalActive: dataset.is_temporal,
        timesteps: dataset.timesteps,
        activeTimestepIndex: animation.activeIndex,
        getLoadCallback,
      });
    }

    if (activeTab === "explore" && geojson) {
      return buildGeoJsonLayer({ geojson });
    }

    return [buildVectorLayer({
      tileUrl: dataset.tile_url,
      isPMTiles: dataset.tile_url.startsWith("/pmtiles/"),
      opacity: 1,
      onClick: vectorPopup.onClick,
    })];
  }, [dataset, activeTab, canClientRender, tileUrl, opacity, colormapName,
      effectiveBand, animation.activeIndex, geojson, vectorPopup.onClick, getLoadCallback]);

  // --- Event handlers ---
  const onHover = activeTab === "client" && canClientRender ? pixelInspector.onHover : undefined;
  const onMapClick = dataset?.dataset_type === "vector" && activeTab !== "explore" ? vectorPopup.onClick : undefined;

  const getTooltip = useMemo(() => {
    if (dataset?.dataset_type !== "vector" || activeTab !== "explore") return undefined;
    return ({ object }: { object?: Record<string, unknown> }) => {
      if (!object) return null;
      const props = Object.entries(object)
        .filter(([k]) => k !== "geometry" && k !== "geom")
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      return { text: props, style: { fontSize: "12px" } };
    };
  }, [dataset?.dataset_type, activeTab]);

  // --- Loading / error states ---
  if (loading) {
    return (
      <Box minH="100vh" bg="white">
        <Header />
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <Spinner size="lg" color="brand.orange" />
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" bg="white">
        <Header />
        <Flex direction="column" align="center" justify="center" h="calc(100vh - 56px)" gap={4}>
          <Text color="red.500">{error}</Text>
          <Button
            bg="brand.orange"
            color="white"
            onClick={() => {
              setError(null);
              setLoading(true);
              window.location.reload();
            }}
          >
            Retry
          </Button>
        </Flex>
      </Box>
    );
  }

  const scrollToCredits = () => {
    setReportCardOpen(false);
    creditsPanelRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!dataset) return null;

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      <Header>
        <ShareButton />
        {dataset.tile_url && (
          <Button
            variant="ghost"
            color="brand.orange"
            size="sm"
            fontWeight={600}
            borderRadius="4px"
            onClick={() => setReportCardOpen(true)}
          >
            See what changed →
          </Button>
        )}
        <Button
          bg="brand.bgSubtle"
          color="brand.brown"
          size="sm"
          fontWeight={500}
          borderRadius="4px"
          asChild
        >
          <Link to="/">New upload</Link>
        </Button>
      </Header>

      <ErrorBoundary>
        <Flex flex={1} overflow="hidden">
          <Box flex={7} position="relative">
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
            >
              {dataset.dataset_type === "raster" && (
                <RasterControls
                  opacity={opacity}
                  onOpacityChange={setOpacity}
                  colormapName={colormapName}
                  onColormapChange={setColormapName}
                  showColormap={showingColormap}
                  bands={selectableBands}
                  hasRgb={hasRgb}
                  selectedBand={selectedBand}
                  onBandChange={setSelectedBand}
                  showBands={isMultiBand && activeTab !== "client"}
                />
              )}

              {showingColormap && activeTab !== "client" && (
                <Box position="absolute" bottom={3} left={3}>
                  <MapLegend
                    layers={[{
                      type: "continuous" as const,
                      id: "raster",
                      title: dataset.filename,
                      domain,
                      colors,
                    }]}
                  />
                </Box>
              )}

              {dataset.is_temporal && activeTab !== "client" && (
                <TemporalControls
                  timesteps={dataset.timesteps}
                  activeIndex={animation.activeIndex}
                  onIndexChange={animation.setActiveIndex}
                  isPlaying={animation.isPlaying}
                  onTogglePlay={animation.togglePlay}
                  speed={animation.speed}
                  onSpeedChange={animation.setSpeed}
                  preloadProgress={preloadProgress}
                  label={
                    dataset.timesteps[animation.activeIndex]
                      ? formatTimestepLabel(dataset.timesteps[animation.activeIndex].datetime, cadence)
                      : ""
                  }
                  onExportGif={() => exportHook.exportGif(animation.setActiveIndex)}
                  onExportMp4={() => exportHook.exportMp4(animation.setActiveIndex)}
                  isExporting={exportHook.isExporting}
                />
              )}

              {pixelInspector.hoverInfo && activeTab === "client" && (
                <PixelInspectorTooltip hoverInfo={pixelInspector.hoverInfo} />
              )}

              {vectorPopup.popup && dataset.dataset_type === "vector" && activeTab !== "explore" && (
                <VectorPopupOverlay popup={vectorPopup.popup} onDismiss={vectorPopup.dismiss} />
              )}
            </UnifiedMap>
          </Box>

          <Box
            ref={creditsPanelRef}
            flex={3}
            display={{ base: "none", md: "block" }}
            overflow="auto"
          >
            <CreditsPanel
              dataset={dataset}
              gapCount={gapCount}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              exploreContent={
                dataset.parquet_url ? (
                  <ExploreTab
                    dataset={dataset}
                    active={activeTab === "explore"}
                    onTableChange={setArrowTable}
                  />
                ) : undefined
              }
              clientRenderContent={
                canClientRender ? (
                  <Box p={6}>
                    <Text fontSize="sm" color="brand.textSecondary" mb={3}>
                      Client-side rendering reads the COG file directly from storage
                      using HTTP Range requests and renders pixels on the GPU — no tile
                      server involved.
                    </Text>
                    <Text fontSize="xs" color="brand.textSecondary">
                      Powered by{" "}
                      <Text as="span" fontWeight={600}>
                        @developmentseed/deck.gl-geotiff
                      </Text>
                    </Text>
                  </Box>
                ) : undefined
              }
            />
          </Box>
        </Flex>
      </ErrorBoundary>
      <ReportCard
        dataset={dataset}
        isOpen={reportCardOpen}
        onClose={() => setReportCardOpen(false)}
        onScrollToCredits={scrollToCredits}
      />
    </Box>
  );
}
