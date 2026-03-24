import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { SpinnerGap } from "@phosphor-icons/react";
import { Header } from "../components/Header";
import { ShareButton } from "../components/ShareButton";
import { BugReportLink } from "../components/BugReportLink";
import { SidePanel } from "../components/SidePanel";
import { CatalogPanel } from "../components/CatalogPanel";
import { RasterSidebarControls } from "../components/RasterSidebarControls";
import { ExploreTab } from "../components/ExploreTab";
import { ReportCard, getTileUrlPrefix } from "../components/ReportCard";
import { UnifiedMap } from "../components/UnifiedMap";
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
import { useTileTransferSize } from "../hooks/useTileTransferSize";
import { detectCadence, formatTimestepLabel } from "../utils/temporal";
import { config } from "../config";
import type { Dataset } from "../types";
import type { Table } from "apache-arrow";
import { ErrorBoundary } from "../components/ErrorBoundary";

type RenderMode = "server" | "client" | "vector-tiles" | "geojson";

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportCardOpen, setReportCardOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTimestep = Number(searchParams.get("t") ?? 0);
  const [renderMode, setRenderMode] = useState<RenderMode>("server");
  const [basemap, setBasemap] = useState("streets");
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [sidebarTab, setSidebarTab] = useState<"dataset" | "catalog">("dataset");
  const [arrowTable, setArrowTable] = useState<Table | null>(null);

  const [opacity, setOpacity] = useState(0.8);
  const [colormapName, setColormapName] = useState("viridis");
  const [selectedBand, setSelectedBand] = useState<"rgb" | number>("rgb");
  const deckRef = useRef(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileCacheRef = useRef<Map<string, TileCacheEntry>>(new Map());

  const vectorPopup = useVectorPopup();
  const pixelInspector = usePixelInspector(tileCacheRef, dataset?.band_names ?? null);

  // --- Initialize renderMode based on dataset type ---
  useEffect(() => {
    if (dataset) {
      setRenderMode(dataset.dataset_type === "vector" ? "vector-tiles" : "server");
    }
  }, [dataset]);

  // --- Tile transfer size ---
  const tileUrlPrefix = dataset?.tile_url ? getTileUrlPrefix(dataset.tile_url) : "";
  const bytesTransferred = useTileTransferSize(tileUrlPrefix);

  useEffect(() => {
    if (dataset?.bounds) {
      const el = mapContainerRef.current;
      const size = el
        ? { width: el.clientWidth, height: el.clientHeight }
        : undefined;
      setCamera(cameraFromBounds(dataset.bounds, size));
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
      if (dataset.raster_min != null && dataset.raster_max != null) {
        url += `&rescale=${dataset.raster_min},${dataset.raster_max}`;
      }
      return url;
    }

    if (isMultiBand && typeof effectiveBand === "number") {
      let url = `${base}${separator}bidx=${effectiveBand + 1}&colormap_name=${colormapName}`;
      if (dataset.raster_min != null && dataset.raster_max != null) {
        url += `&rescale=${dataset.raster_min},${dataset.raster_max}`;
      }
      return url;
    }

    return base;
  }, [dataset, colormapName, isSingleBand, isMultiBand, effectiveBand]);

  // --- Color scale for legend ---
  const domain: [number, number] =
    dataset?.raster_min != null && dataset?.raster_max != null
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

  // --- Handle table change from ExploreTab ---
  const handleTableChange = useCallback((table: Table | null) => {
    setArrowTable(table);
    if (dataset?.dataset_type === "vector") {
      setRenderMode(table ? "geojson" : "vector-tiles");
    }
  }, [dataset]);

  // --- Build deck.gl layers ---
  const layers = useMemo(() => {
    if (!dataset) return [];

    if (dataset.dataset_type === "raster") {
      if (renderMode === "client" && canClientRender) {
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

    if (renderMode === "geojson" && geojson) {
      return buildGeoJsonLayer({ geojson });
    }

    return [buildVectorLayer({
      tileUrl: dataset.tile_url,
      isPMTiles: dataset.tile_url.startsWith("/pmtiles/"),
      opacity: 1,
      minZoom: dataset.min_zoom ?? undefined,
      maxZoom: dataset.max_zoom ?? undefined,
      onClick: vectorPopup.onClick,
    })];
  }, [dataset, renderMode, canClientRender, tileUrl, opacity, colormapName,
      effectiveBand, animation.activeIndex, geojson, vectorPopup.onClick, getLoadCallback]);

  // --- Compute viewport bbox from camera state ---
  const viewportBbox = useMemo<number[]>(() => {
    const degreesPerTile = 360 / Math.pow(2, camera.zoom);
    const halfW = degreesPerTile * 0.75;
    const halfH = degreesPerTile * 0.5;
    return [
      Math.max(-180, camera.longitude - halfW),
      Math.max(-90, camera.latitude - halfH),
      Math.min(180, camera.longitude + halfW),
      Math.min(90, camera.latitude + halfH),
    ];
  }, [camera.longitude, camera.latitude, camera.zoom]);

  // --- Event handlers ---
  const onHover = renderMode === "client" && canClientRender ? pixelInspector.onHover : undefined;
  const onMapClick = dataset?.dataset_type === "vector" && renderMode !== "geojson" ? vectorPopup.onClick : undefined;

  const getTooltip = useMemo(() => {
    if (dataset?.dataset_type !== "vector" || renderMode !== "geojson") return undefined;
    return ({ object }: { object?: Record<string, unknown> }) => {
      if (!object) return null;
      const props = Object.entries(object)
        .filter(([k]) => k !== "geometry" && k !== "geom")
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      return { text: props, style: { fontSize: "12px" } };
    };
  }, [dataset?.dataset_type, renderMode]);

  // --- Loading / error states ---
  if (loading) {
    return (
      <Box minH="100vh" bg="white">
        <Header />
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <SpinnerGap size={32} color="#CF3F02" style={{ animation: "spin 1s linear infinite" }} />
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

  if (!dataset) return null;

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      <Header>
        <BugReportLink datasetId={dataset.id} />
        <ShareButton />
      </Header>

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
            >
              {showingColormap && renderMode !== "client" && (
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

              {dataset.is_temporal && renderMode !== "client" && (
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

              {pixelInspector.hoverInfo && renderMode === "client" && (
                <PixelInspectorTooltip hoverInfo={pixelInspector.hoverInfo} />
              )}

              {vectorPopup.popup && dataset.dataset_type === "vector" && renderMode !== "geojson" && (
                <VectorPopupOverlay popup={vectorPopup.popup} onDismiss={vectorPopup.dismiss} />
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
            <SidePanel
              dataset={dataset}
              bytesTransferred={bytesTransferred}
              onDetailsClick={() => setReportCardOpen(true)}
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
              catalogContent={<CatalogPanel bbox={viewportBbox} />}
            >
              {dataset.dataset_type === "raster" && (
                <RasterSidebarControls
                  opacity={opacity}
                  onOpacityChange={setOpacity}
                  colormapName={colormapName}
                  onColormapChange={setColormapName}
                  showColormap={showingColormap}
                  bands={selectableBands}
                  hasRgb={hasRgb}
                  selectedBand={selectedBand}
                  onBandChange={setSelectedBand}
                  showBands={isMultiBand}
                  canClientRender={canClientRender}
                  renderMode={renderMode === "client" ? "client" : "server"}
                  onRenderModeChange={(mode) => setRenderMode(mode)}
                />
              )}
              {dataset.dataset_type === "vector" && dataset.parquet_url && (
                <ExploreTab
                  dataset={dataset}
                  active={true}
                  onTableChange={handleTableChange}
                />
              )}
            </SidePanel>
          </Box>
        </Flex>
      </ErrorBoundary>
      <ReportCard
        dataset={dataset}
        isOpen={reportCardOpen}
        onClose={() => setReportCardOpen(false)}
        renderMode={renderMode}
      />
    </Box>
  );
}
