import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { useSaveStatus } from "./useSaveStatus";
import { FlyToInterpolator } from "@deck.gl/core";
import {
  type CameraState,
  DEFAULT_CAMERA,
  cameraFromBounds,
  buildRasterTileLayers,
  buildVectorLayer,
} from "../lib/layers";
import { buildConnectionTileUrl } from "../lib/connections";
import {
  type Story,
  type Chapter,
  type ChapterType,
  type LayerConfig,
  DEFAULT_LAYER_CONFIG,
  createStory,
  createChapter,
  createStoryOnServer,
  getStoryFromServer,
  saveStoryToServer,
  migrateStory,
} from "../lib/story";
import type { Connection, Dataset } from "../types";
import { config } from "../config";
import { workspaceFetch, connectionsApi } from "../lib/api";

export function useStoryEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const datasetIdParam = searchParams.get("dataset");

  const [story, setStory] = useState<Story | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>("");
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [basemap, setBasemap] = useState("streets");
  const [viewSavedFlash, setViewSavedFlash] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [transitionDuration, setTransitionDuration] = useState<
    number | undefined
  >(undefined);
  const flyToRef = useRef(new FlyToInterpolator());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCaptureRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [allDatasets, setAllDatasets] = useState<Dataset[]>([]);
  const [allConnections, setAllConnections] = useState<Connection[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { saveState, markSaving, markSaved, markError } = useSaveStatus();

  useEffect(() => {
    async function fetchAllDatasets() {
      try {
        const resp = await workspaceFetch(`${config.apiBase}/api/datasets`);
        if (resp.ok) setAllDatasets(await resp.json());
      } catch {
        // ignore fetch errors
      }
    }
    fetchAllDatasets();
  }, []);

  useEffect(() => {
    connectionsApi
      .list()
      .then(setAllConnections)
      .catch(() => {});
  }, []);

  // Load existing story
  useEffect(() => {
    if (!id) return;
    async function loadStory() {
      try {
        const loaded = await getStoryFromServer(id!);
        if (!loaded) {
          setError("Story not found");
          setLoading(false);
          return;
        }
        const migrated = migrateStory(
          loaded as unknown as Record<string, unknown>
        );
        setStory(migrated);
        setActiveChapterId(migrated.chapters[0]?.id ?? "");
        if (JSON.stringify(migrated) !== JSON.stringify(loaded)) {
          saveStoryToServer(migrated).catch(console.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load story");
        setLoading(false);
      }
    }
    loadStory();
  }, [id]);

  // Create new story if this is /story/new
  useEffect(() => {
    if (id || story) return;
    async function createNew() {
      try {
        const draft = createStory(datasetIdParam);
        if (datasetIdParam) {
          const resp = await workspaceFetch(
            `${config.apiBase}/api/datasets/${datasetIdParam}`
          );
          if (resp.ok) {
            const data: Dataset = await resp.json();
            setDataset(data);
            if (data.bounds) {
              const cam = cameraFromBounds(data.bounds);
              draft.chapters[0].map_state = {
                center: [cam.longitude, cam.latitude],
                zoom: cam.zoom,
                bearing: 0,
                pitch: 0,
                basemap: "streets",
              };
              setCamera(cam);
            }
          }
        }
        const saved = await createStoryOnServer(draft);
        setStory(saved);
        setActiveChapterId(saved.chapters[0]?.id ?? "");
        navigate(workspacePath(`/story/${saved.id}/edit`), { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create story");
      } finally {
        setLoading(false);
      }
    }
    createNew();
  }, [id, story, datasetIdParam, navigate, workspacePath]);

  // Fetch primary dataset for existing stories
  useEffect(() => {
    const dsId = story?.dataset_id;
    if (!dsId) {
      if (story) setLoading(false);
      return;
    }
    if (dataset?.id === dsId) return;
    async function fetchDataset() {
      try {
        const resp = await workspaceFetch(
          `${config.apiBase}/api/datasets/${dsId}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Dataset = await resp.json();
        setDataset(data);
        if (data.bounds) {
          setCamera(cameraFromBounds(data.bounds));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [story?.dataset_id]);

  const datasetMap = useMemo(() => {
    const map = new Map<string, Dataset>();
    for (const ds of allDatasets) map.set(ds.id, ds);
    if (dataset && !map.has(dataset.id)) map.set(dataset.id, dataset);
    return map;
  }, [allDatasets, dataset]);

  const connectionMap = useMemo(() => {
    const map = new Map<string, Connection>();
    for (const c of allConnections) map.set(c.id, c);
    return map;
  }, [allConnections]);

  // Debounced auto-save
  const debouncedSave = useCallback(
    (updated: Story) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      markSaving();
      saveTimerRef.current = setTimeout(() => {
        saveStoryToServer(updated).then(markSaved).catch(markError);
      }, 500);
    },
    [markSaving, markSaved, markError]
  );

  function updateStory(updater: (s: Story) => Story) {
    setStory((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      debouncedSave(updated);
      return updated;
    });
  }

  const activeChapter = story?.chapters.find((c) => c.id === activeChapterId);
  const activeDataset = activeChapter
    ? (datasetMap.get(activeChapter.layer_config.dataset_id) ?? dataset)
    : dataset;

  function selectChapter(chapterId: string) {
    setActiveChapterId(chapterId);
    const chapter = story?.chapters.find((c) => c.id === chapterId);
    if (chapter) {
      setBasemap(chapter.map_state.basemap);
      setTransitionDuration(1000);
      setCamera({
        longitude: chapter.map_state.center[0],
        latitude: chapter.map_state.center[1],
        zoom: chapter.map_state.zoom,
        bearing: chapter.map_state.bearing,
        pitch: chapter.map_state.pitch,
      });
    }
  }

  function handleCameraChange(c: CameraState) {
    setCamera(c);
    setTransitionDuration(undefined);

    if (autoCaptureRef.current) clearTimeout(autoCaptureRef.current);
    autoCaptureRef.current = setTimeout(() => {
      if (!activeChapterId) return;
      updateStory((s) => ({
        ...s,
        chapters: s.chapters.map((ch) =>
          ch.id === activeChapterId
            ? {
                ...ch,
                map_state: {
                  center: [c.longitude, c.latitude] as [number, number],
                  zoom: c.zoom,
                  bearing: c.bearing,
                  pitch: c.pitch,
                  basemap,
                },
              }
            : ch
        ),
      }));
      setViewSavedFlash(true);
      setTimeout(() => setViewSavedFlash(false), 1500);
    }, 800);
  }

  function resetView() {
    if (!activeChapter) return;
    setBasemap(activeChapter.map_state.basemap);
    setTransitionDuration(1000);
    setCamera({
      longitude: activeChapter.map_state.center[0],
      latitude: activeChapter.map_state.center[1],
      zoom: activeChapter.map_state.zoom,
      bearing: activeChapter.map_state.bearing,
      pitch: activeChapter.map_state.pitch,
    });
  }

  function addChapter() {
    const maxOrder = Math.max(...(story?.chapters.map((c) => c.order) ?? [0]));
    const inheritedDatasetId =
      activeChapter?.layer_config.dataset_id ?? story?.dataset_id ?? "";
    const newCh = createChapter({
      order: maxOrder + 1,
      title: `Chapter ${(story?.chapters.length ?? 0) + 1}`,
      map_state: {
        center: [camera.longitude, camera.latitude],
        zoom: camera.zoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
        basemap,
      },
      layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: inheritedDatasetId },
    });
    updateStory((s) => ({ ...s, chapters: [...s.chapters, newCh] }));
    setActiveChapterId(newCh.id);
  }

  function deleteChapter(chapterId: string) {
    updateStory((s) => {
      const remaining = s.chapters.filter((c) => c.id !== chapterId);
      return {
        ...s,
        chapters: remaining.map((ch, i) => ({ ...ch, order: i })),
      };
    });
    if (activeChapterId === chapterId) {
      const remaining = story?.chapters.filter((c) => c.id !== chapterId);
      setActiveChapterId(remaining?.[0]?.id ?? "");
    }
  }

  function reorderChapters(reordered: Chapter[]) {
    updateStory((s) => ({ ...s, chapters: reordered }));
  }

  function updateChapterTitle(title: string) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, title } : ch
      ),
    }));
  }

  function updateChapterNarrative(narrative: string) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, narrative } : ch
      ),
    }));
  }

  function zoomToBounds(bounds: [number, number, number, number]) {
    const el = mapContainerRef.current;
    const size = el
      ? { width: el.clientWidth, height: el.clientHeight }
      : undefined;
    setTransitionDuration(1000);
    setCamera(cameraFromBounds(bounds, size));
  }

  function updateChapterLayerConfig(
    layerConfig: LayerConfig,
    boundsOverride?: [number, number, number, number] | null
  ) {
    const prevConfig = activeChapter?.layer_config;

    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, layer_config: layerConfig } : ch
      ),
    }));

    if (
      layerConfig.dataset_id &&
      layerConfig.dataset_id !== prevConfig?.dataset_id
    ) {
      const bounds =
        boundsOverride ?? datasetMap.get(layerConfig.dataset_id)?.bounds;
      if (bounds) zoomToBounds(bounds);
    }

    if (
      layerConfig.connection_id &&
      layerConfig.connection_id !== prevConfig?.connection_id
    ) {
      const conn = connectionMap.get(layerConfig.connection_id);
      if (conn?.bounds) zoomToBounds(conn.bounds);
    }
  }

  function updateChapterType(type: ChapterType) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId ? { ...ch, type } : ch
      ),
    }));
  }

  function updateChapterOverlayPosition(position: "left" | "right") {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId
          ? { ...ch, overlay_position: position }
          : ch
      ),
    }));
  }

  async function handleDatasetReady(datasetId: string) {
    setUploadModalOpen(false);
    try {
      const resp = await workspaceFetch(
        `${config.apiBase}/api/datasets/${datasetId}`
      );
      if (!resp.ok) return;
      const ds: Dataset = await resp.json();
      setAllDatasets((prev) =>
        prev.some((d) => d.id === ds.id) ? prev : [...prev, ds]
      );
      if (activeChapterId) {
        updateChapterLayerConfig(
          {
            ...(activeChapter?.layer_config ?? DEFAULT_LAYER_CONFIG),
            dataset_id: datasetId,
          },
          ds.bounds
        );
      }
    } catch (e) {
      console.error("Failed to fetch new dataset", e);
    }
  }

  function handlePublish() {
    if (!story) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const published = { ...story, published: true };
    setStory(published);
    saveStoryToServer(published);
  }

  function handleUnpublish() {
    if (!story) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const unpublished = { ...story, published: false };
    setStory(unpublished);
    saveStoryToServer(unpublished);
  }

  // Build layers
  const layers = useMemo(() => {
    if (!activeChapter) return [];
    const lc = activeChapter.layer_config ?? DEFAULT_LAYER_CONFIG;

    // Connection path
    if (lc.connection_id) {
      const conn = connectionMap.get(lc.connection_id);
      if (!conn) return [];
      const tileUrl = buildConnectionTileUrl(conn);

      if (conn.connection_type === "cog") {
        let finalTileUrl = tileUrl;
        if (conn.band_count === 1) {
          const sep = finalTileUrl.includes("?") ? "&" : "?";
          finalTileUrl += `${sep}colormap_name=${lc.colormap}`;
          if (conn.rescale) {
            finalTileUrl += `&rescale=${conn.rescale}`;
          }
        }
        return buildRasterTileLayers({
          tileUrl: finalTileUrl,
          opacity: lc.opacity,
          isTemporalActive: false,
        });
      }
      if (conn.connection_type === "pmtiles" && conn.tile_type === "vector") {
        return [
          buildVectorLayer({
            tileUrl,
            isPMTiles: true,
            opacity: lc.opacity,
            minZoom: conn.min_zoom ?? undefined,
            maxZoom: conn.max_zoom ?? undefined,
          }),
        ];
      }
      if (conn.connection_type === "xyz_vector") {
        return [
          buildVectorLayer({
            tileUrl,
            isPMTiles: false,
            opacity: lc.opacity,
            minZoom: conn.min_zoom ?? undefined,
            maxZoom: conn.max_zoom ?? undefined,
          }),
        ];
      }
      return buildRasterTileLayers({
        tileUrl,
        opacity: lc.opacity,
        isTemporalActive: false,
      });
    }

    // Dataset path
    const ds = activeDataset;
    if (!ds) return [];

    if (ds.dataset_type === "raster") {
      const base = ds.tile_url;
      const sep = base.includes("?") ? "&" : "?";
      let tileUrl = `${base}${sep}colormap_name=${lc.colormap}`;
      if (ds.raster_min != null && ds.raster_max != null) {
        tileUrl += `&rescale=${ds.raster_min},${ds.raster_max}`;
      }
      return buildRasterTileLayers({
        tileUrl,
        opacity: lc.opacity,
        isTemporalActive: false,
      });
    }
    return [
      buildVectorLayer({
        tileUrl: ds.tile_url,
        isPMTiles: ds.tile_url.startsWith("/pmtiles/"),
        opacity: lc.opacity,
        minZoom: ds.min_zoom ?? undefined,
        maxZoom: ds.max_zoom ?? undefined,
      }),
    ];
  }, [activeDataset, activeChapter, connectionMap]);

  return {
    story,
    loading,
    error,
    activeChapter,
    activeChapterId,
    activeDataset,
    camera,
    basemap,
    viewSavedFlash,
    publishDialogOpen,
    transitionDuration,
    flyToRef,
    mapContainerRef,
    allDatasets,
    allConnections,
    uploadModalOpen,
    saveState,
    layers,
    workspacePath,
    updateStory,
    selectChapter,
    handleCameraChange,
    resetView,
    addChapter,
    deleteChapter,
    reorderChapters,
    updateChapterTitle,
    updateChapterNarrative,
    updateChapterLayerConfig,
    updateChapterType,
    updateChapterOverlayPosition,
    handleDatasetReady,
    handlePublish,
    handleUnpublish,
    setBasemap,
    setPublishDialogOpen,
    setUploadModalOpen,
  };
}
