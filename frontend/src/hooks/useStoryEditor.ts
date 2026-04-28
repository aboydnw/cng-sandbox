import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useWorkspace } from "./useWorkspace";
import { useSaveStatus } from "./useSaveStatus";
import { FlyToInterpolator } from "@deck.gl/core";
import {
  type CameraState,
  DEFAULT_CAMERA,
  cameraFromBounds,
} from "../lib/layers";
import {
  type Story,
  type Chapter,
  type ChapterType,
  type LayerConfig,
  type ChapterRenderMetadata,
  DEFAULT_LAYER_CONFIG,
  createStory,
  createChapter,
  createScrollytellingChapter,
  createMapChapter,
  createProseChapter,
  createImageChapter,
  createVideoChapter,
  createChartChapter,
  isMapBoundChapter,
  createStoryOnServer,
  getStoryFromServer,
  saveStoryToServer,
  migrateStory,
  buildLayersForChapter,
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
        let fetchedDataset: Dataset | null = null;
        if (datasetIdParam) {
          const resp = await workspaceFetch(
            `${config.apiBase}/api/datasets/${datasetIdParam}`
          );
          if (resp.ok) {
            fetchedDataset = await resp.json();
            setDataset(fetchedDataset);
          }
        }
        const draft = createStory(datasetIdParam, {
          preferredColormap: fetchedDataset?.preferred_colormap ?? null,
          preferredColormapReversed:
            fetchedDataset?.preferred_colormap_reversed ?? null,
        });
        if (fetchedDataset?.bounds) {
          const cam = cameraFromBounds(fetchedDataset.bounds);
          const firstChapter = draft.chapters[0];
          if (firstChapter && isMapBoundChapter(firstChapter)) {
            firstChapter.map_state = {
              center: [cam.longitude, cam.latitude],
              zoom: cam.zoom,
              bearing: 0,
              pitch: 0,
              basemap: "streets",
            };
          }
          setCamera(cam);
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
  const activeDataset =
    activeChapter && isMapBoundChapter(activeChapter)
      ? (datasetMap.get(activeChapter.layer_config.dataset_id) ?? dataset)
      : dataset;

  function selectChapter(chapterId: string) {
    setActiveChapterId(chapterId);
    const chapter = story?.chapters.find((c) => c.id === chapterId);
    if (chapter && isMapBoundChapter(chapter)) {
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
          ch.id === activeChapterId &&
          (ch.type === "scrollytelling" || ch.type === "map")
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
    if (!activeChapter || !isMapBoundChapter(activeChapter)) return;
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
      (activeChapter && isMapBoundChapter(activeChapter)
        ? activeChapter.layer_config.dataset_id
        : "") ||
      story?.dataset_id ||
      "";
    const inheritedDataset = inheritedDatasetId
      ? datasetMap.get(inheritedDatasetId)
      : undefined;
    const preferredColormap = inheritedDataset?.preferred_colormap ?? null;
    const preferredColormapReversed =
      inheritedDataset?.preferred_colormap_reversed ?? null;
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
      layer_config: {
        ...DEFAULT_LAYER_CONFIG,
        dataset_id: inheritedDatasetId,
        colormap: preferredColormap ?? DEFAULT_LAYER_CONFIG.colormap,
        ...(preferredColormapReversed != null
          ? { colormap_reversed: preferredColormapReversed }
          : {}),
      },
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
    const prevConfig =
      activeChapter && isMapBoundChapter(activeChapter)
        ? activeChapter.layer_config
        : undefined;

    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId &&
        (ch.type === "scrollytelling" || ch.type === "map")
          ? { ...ch, layer_config: layerConfig }
          : ch
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
      chapters: s.chapters.map((ch) => {
        if (ch.id !== activeChapterId) return ch;
        const base = {
          id: ch.id,
          order: ch.order,
          title: ch.title,
          narrative: ch.narrative,
        };
        if (type === "prose") return createProseChapter(base);
        if (type === "chart") return createChartChapter(base);
        if (type === "image") {
          const existingImage = ch.type === "image" ? ch.image : undefined;
          return createImageChapter({ ...base, image: existingImage });
        }
        if (type === "video") {
          const existingVideo = ch.type === "video" ? ch.video : undefined;
          return createVideoChapter({
            ...base,
            ...(existingVideo ? { video: existingVideo } : {}),
          });
        }
        const inheritedDatasetId = s.dataset_id ?? "";
        const inheritedDataset = inheritedDatasetId
          ? datasetMap.get(inheritedDatasetId)
          : undefined;
        const mapFields = isMapBoundChapter(ch)
          ? { map_state: ch.map_state, layer_config: ch.layer_config }
          : {
              map_state: {
                center: [camera.longitude, camera.latitude] as [number, number],
                zoom: camera.zoom,
                bearing: camera.bearing,
                pitch: camera.pitch,
                basemap,
              },
              layer_config: {
                ...DEFAULT_LAYER_CONFIG,
                dataset_id: inheritedDatasetId,
                colormap:
                  inheritedDataset?.preferred_colormap ??
                  DEFAULT_LAYER_CONFIG.colormap,
                ...(inheritedDataset?.preferred_colormap_reversed != null
                  ? {
                      colormap_reversed:
                        inheritedDataset.preferred_colormap_reversed,
                    }
                  : {}),
              },
            };
        if (type === "map") return createMapChapter({ ...base, ...mapFields });
        const scrollyFields =
          ch.type === "scrollytelling"
            ? {
                transition: ch.transition,
                overlay_position: ch.overlay_position,
              }
            : {};
        return createScrollytellingChapter({
          ...base,
          ...mapFields,
          ...scrollyFields,
        });
      }),
    }));
  }

  function updateChapterOverlayPosition(position: "left" | "right") {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) =>
        ch.id === activeChapterId && ch.type === "scrollytelling"
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
        const baseConfig =
          activeChapter && isMapBoundChapter(activeChapter)
            ? activeChapter.layer_config
            : DEFAULT_LAYER_CONFIG;
        updateChapterLayerConfig(
          {
            ...baseConfig,
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

  function updateChapter(next: Chapter) {
    updateStory((s) => ({
      ...s,
      chapters: s.chapters.map((ch) => (ch.id === next.id ? next : ch)),
    }));
  }

  const { layers, previewRenderMetadata } = useMemo<{
    layers: ReturnType<typeof buildLayersForChapter>["layers"];
    previewRenderMetadata: ChapterRenderMetadata | undefined;
  }>(() => {
    if (!activeChapter) return { layers: [], previewRenderMetadata: undefined };
    const result = buildLayersForChapter(
      activeChapter,
      datasetMap,
      connectionMap
    );
    return {
      layers: result.layers,
      previewRenderMetadata: result.renderMetadata,
    };
  }, [activeChapter, datasetMap, connectionMap]);

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
    previewRenderMetadata,
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
    updateChapter,
    handleDatasetReady,
    handlePublish,
    handleUnpublish,
    setBasemap,
    setPublishDialogOpen,
    setUploadModalOpen,
    handleConnectionCreated: (conn: Connection) =>
      setAllConnections((prev) => [conn, ...prev]),
  };
}
