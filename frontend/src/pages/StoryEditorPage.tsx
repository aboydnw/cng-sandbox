import {
  Box,
  Button,
  Flex,
  Menu,
  Portal,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { lazy, Suspense, useMemo, useState } from "react";
import {
  X as XIcon,
  ArrowCounterClockwise,
  Check,
  CaretDown,
  DownloadSimple,
  Eye,
  ListBullets,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useTooltipDismiss } from "../hooks/useTooltipDismiss";
import { useStoryEditor } from "../hooks/useStoryEditor";
import { UnifiedMap } from "../components/UnifiedMap";
import { ChapterList } from "../components/ChapterList";
import { NarrativeEditor } from "../components/NarrativeEditor";
import { OverlayLayersEditor } from "../components/OverlayLayersEditor";
import { Header } from "../components/Header";
import { SaveStatus } from "../components/SaveStatus";
import { RenderModeIndicator } from "../components/RenderModeIndicator";
import {
  isMapBoundChapter,
  DEFAULT_LAYER_CONFIG,
  DEFAULT_MAP_STATE,
} from "../lib/story";
import { chapterAllowsTerrain } from "../lib/story/terrainPolicy";
import { StatePanel } from "../components/ui/StatePanel";
import { BrandSpinner } from "../components/ui/BrandSpinner";

const ChapterPreview = lazy(() =>
  import("../components/editor/ChapterPreview").then((module) => ({
    default: module.ChapterPreview,
  }))
);
const ChartChapterEditor = lazy(() =>
  import("../components/editor/ChartChapterEditor").then((module) => ({
    default: module.ChartChapterEditor,
  }))
);
const ConnectionModal = lazy(() =>
  import("../components/ConnectionModal").then((module) => ({
    default: module.ConnectionModal,
  }))
);
const ExportDialog = lazy(() =>
  import("../components/ExportDialog").then((module) => ({
    default: module.ExportDialog,
  }))
);
const FlyoverKeyframePanel = lazy(() =>
  import("../components/flyover/FlyoverKeyframePanel").then((module) => ({
    default: module.FlyoverKeyframePanel,
  }))
);
const ImageChapterEditor = lazy(() =>
  import("../components/editor/ImageChapterEditor").then((module) => ({
    default: module.ImageChapterEditor,
  }))
);
const OverlayPicker = lazy(() =>
  import("../components/OverlayPicker").then((module) => ({
    default: module.OverlayPicker,
  }))
);
const PublishDialog = lazy(() =>
  import("../components/PublishDialog").then((module) => ({
    default: module.PublishDialog,
  }))
);
const UploadModal = lazy(() =>
  import("../components/UploadModal").then((module) => ({
    default: module.UploadModal,
  }))
);
const VideoChapterEditor = lazy(() =>
  import("../components/editor/VideoChapterEditor").then((module) => ({
    default: module.VideoChapterEditor,
  }))
);

function EditorPanelFallback() {
  return (
    <Flex minH="160px" align="center" justify="center" color="fg.muted">
      <BrandSpinner size={20} />
    </Flex>
  );
}

function TooltipCard({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  return (
    <Box
      position="absolute"
      zIndex={100}
      bg="gray.900"
      color="white"
      borderRadius="md"
      px={3}
      py={2}
      fontSize="12px"
      maxW="200px"
      shadow="lg"
      pointerEvents="all"
    >
      <Flex gap={2} align="flex-start">
        <Text flex={1} lineHeight="1.4">
          {text}
        </Text>
        <Box
          as="button"
          flexShrink={0}
          opacity={0.7}
          _hover={{ opacity: 1 }}
          mt="1px"
          onClick={onDismiss}
        >
          <XIcon size={12} weight="bold" />
        </Box>
      </Flex>
    </Box>
  );
}

type EditorView = "chapters" | "preview" | "edit";
const EDITOR_VIEWS: EditorView[] = ["chapters", "preview", "edit"];

export default function StoryEditorPage() {
  const {
    story,
    loading,
    error,
    activeChapter,
    camera,
    basemap,
    viewSavedFlash,
    publishDialogOpen,
    transitionDuration,
    mapContainerRef,
    allDatasets,
    allConnections,
    datasetsResource,
    connectionsResource,
    uploadModalOpen,
    saveState,
    layers,
    previewRenderMetadata,
    activeDataset,
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
    updateChapterOverlays,
    updateChapterType,
    updateChapterOverlayPosition,
    updateChapterMapState,
    updateChapter,
    previewFlyoverPose,
    handleDatasetReady,
    handlePublish,
    handleUnpublish,
    setBasemap,
    setPublishDialogOpen,
    setUploadModalOpen,
    activeChapterId,
    handleConnectionCreated,
  } = useStoryEditor();

  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [overlayPickerOpen, setOverlayPickerOpen] = useState(false);
  const [editorView, setEditorView] = useState<EditorView>("edit");

  const activeDatasetTimesteps = useMemo(() => {
    if (!activeChapter || !isMapBoundChapter(activeChapter)) return undefined;
    const config = activeChapter.layer_config;
    const ds = config.dataset_id
      ? allDatasets.find((d) => d.id === config.dataset_id)
      : undefined;
    return ds?.is_temporal ? ds.timesteps : undefined;
  }, [activeChapter, allDatasets]);

  const { shouldShow, dismiss } = useTooltipDismiss();
  const TOOLTIP_KEYS = ["chapters", "map", "narrative"] as const;
  const firstUnseen = TOOLTIP_KEYS.find((k) => shouldShow(k)) ?? null;

  if (loading) {
    return (
      <Box h="100vh" display="flex" flexDirection="column" bg="bg">
        <Header showWorkspace={false} />
        <Flex
          as="main"
          id="main-content"
          flex={1}
          overflow="hidden"
          aria-busy="true"
        >
          <Box
            display={{ base: "none", lg: "block" }}
            w="200px"
            p={3}
            bg="bg.raised"
          >
            <Skeleton h="28px" mb={4} />
            {[1, 2, 3].map((value) => (
              <Skeleton key={value} h="54px" mb={2} borderRadius="control" />
            ))}
          </Box>
          <Flex flex={1} align="center" justify="center" bg="bg.emphasized">
            <Flex align="center" gap={2} role="status" color="fg.muted">
              <BrandSpinner size={22} />
              <Text fontSize="sm">Opening story editor…</Text>
            </Flex>
          </Flex>
          <Box
            display={{ base: "none", lg: "block" }}
            w="340px"
            p={4}
            bg="bg.raised"
          >
            <Skeleton h="20px" w="45%" mb={4} />
            <Skeleton h="36px" mb={3} />
            <Skeleton h="120px" mb={3} />
            <Skeleton h="36px" />
          </Box>
        </Flex>
      </Box>
    );
  }
  if (error || !story) {
    return (
      <Box minH="100vh" bg="bg">
        <Header showWorkspace={false} />
        <Flex
          as="main"
          id="main-content"
          minH="calc(100vh - 56px)"
          align="center"
          justify="center"
          px={4}
        >
          <Box w="100%" maxW="520px">
            <StatePanel
              tone="danger"
              title="Couldn’t open this story"
              description={error ?? "The story could not be found."}
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to={workspacePath("/stories")}>Back to stories</Link>
                </Button>
              }
            />
          </Box>
        </Flex>
      </Box>
    );
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      <Header showWorkspace={false}>
        <SaveStatus state={saveState} />
        <Flex gap={{ base: 1, md: 2 }} align="center">
          {story.published && (
            <Flex align="center" gap={1.5}>
              <Box w={2} h={2} borderRadius="full" bg="green.500" />
              <Text fontSize="xs" color="green.700" fontWeight={500}>
                Published
              </Text>
            </Flex>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-label="Export story"
            onClick={() => setExportDialogOpen(true)}
          >
            <DownloadSimple size={16} weight="bold" />
            <Text as="span" display={{ base: "none", md: "inline" }}>
              Export
            </Text>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              window.open(workspacePath(`/story/${story.id}`), "_blank")
            }
          >
            Preview
          </Button>
          {story.published ? (
            <Flex align="center">
              <Button
                size="sm"
                borderRightRadius={0}
                onClick={() => setPublishDialogOpen(true)}
              >
                Share settings
              </Button>
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <Button
                    size="sm"
                    variant="solid"
                    borderLeftRadius={0}
                    borderLeft="1px solid"
                    borderLeftColor="whiteAlpha.400"
                    px={2}
                    aria-label="More publish options"
                  >
                    <CaretDown size={12} />
                  </Button>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content minW="180px">
                      <Menu.Item
                        value="unpublish"
                        color="status.danger.fg"
                        onSelect={handleUnpublish}
                      >
                        Unpublish
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </Flex>
          ) : (
            <Button size="sm" onClick={() => setPublishDialogOpen(true)}>
              Publish
            </Button>
          )}
        </Flex>
      </Header>

      {/* Published URL bar */}
      {story.published && (
        <Flex
          align="center"
          gap={2}
          px={4}
          py={1.5}
          bg="green.50"
          borderBottom="1px solid"
          borderColor="green.100"
          fontSize="xs"
          color="green.700"
        >
          <Box
            w={1.5}
            h={1.5}
            borderRadius="full"
            bg="green.500"
            flexShrink={0}
          />
          <Text fontWeight={500}>Published —</Text>
          <Text color="green.600" fontFamily="mono" truncate maxW="400px">
            {`${window.location.origin}/story/${story.id}`}
          </Text>
          <Button
            size="xs"
            variant="ghost"
            color="green.600"
            _hover={{ bg: "green.100" }}
            px={2}
            h={5}
            onClick={() => {
              const url = `${window.location.origin}/story/${story.id}`;
              navigator.clipboard?.writeText(url);
            }}
          >
            Copy
          </Button>
        </Flex>
      )}

      <Flex
        display={{ base: "flex", lg: "none" }}
        role="tablist"
        aria-label="Story editor view"
        px={2}
        py={2}
        gap={1}
        bg="bg.raised"
        borderBottomWidth="1px"
        borderColor="border"
      >
        {(
          [
            ["chapters", "Chapters", <ListBullets key="chapters" size={15} />],
            ["preview", "Preview", <Eye key="preview" size={15} />],
            ["edit", "Edit", <SlidersHorizontal key="edit" size={15} />],
          ] as const
        ).map(([view, label, icon]) => (
          <Button
            key={view}
            id={"story-editor-tab-" + view}
            role="tab"
            aria-controls={"story-editor-panel-" + view}
            tabIndex={editorView === view ? 0 : -1}
            aria-selected={editorView === view}
            variant={editorView === view ? "subtle" : "ghost"}
            color={editorView === view ? "action.primary" : "fg.muted"}
            size="sm"
            flex={1}
            onClick={() => setEditorView(view)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const current = EDITOR_VIEWS.indexOf(view);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? EDITOR_VIEWS.length - 1
                    : (current +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        EDITOR_VIEWS.length) %
                      EDITOR_VIEWS.length;
              const nextView = EDITOR_VIEWS[next];
              setEditorView(nextView);
              requestAnimationFrame(() =>
                document.getElementById("story-editor-tab-" + nextView)?.focus()
              );
            }}
          >
            {icon} {label}
          </Button>
        ))}
      </Flex>

      {/* Three-panel layout: Chapters | Map | Editor */}
      <Flex as="main" id="main-content" flex={1} overflow="hidden">
        {/* Left: chapter list */}
        <Box
          id="story-editor-panel-chapters"
          role="tabpanel"
          aria-labelledby="story-editor-tab-chapters"
          width={{ base: "100%", lg: "200px" }}
          flexShrink={0}
          borderRight="1px solid"
          borderColor="gray.200"
          bg="white"
          position="relative"
          display={{
            base: editorView === "chapters" ? "block" : "none",
            lg: "block",
          }}
        >
          {firstUnseen === "chapters" && (
            <TooltipCard
              text="Each chapter is a section of your story. Readers see them in this order."
              onDismiss={() => dismiss("chapters")}
            />
          )}
          <ChapterList
            chapters={story.chapters}
            activeChapterId={activeChapterId}
            onSelect={(chapterId) => {
              selectChapter(chapterId);
              setEditorView("edit");
            }}
            onAdd={addChapter}
            onDelete={deleteChapter}
            onReorder={reorderChapters}
            storyTitle={story.title}
            onStoryTitleChange={(title) =>
              updateStory((s) => ({ ...s, title }))
            }
          />
        </Box>

        {/* Center: editable map for map-bound chapters; live preview otherwise */}
        {activeChapter &&
        (isMapBoundChapter(activeChapter) ||
          activeChapter.type === "flyover") ? (
          <Box
            id="story-editor-panel-preview"
            role="tabpanel"
            aria-labelledby="story-editor-tab-preview"
            ref={mapContainerRef}
            flex={1}
            position="relative"
            display={{
              base: editorView === "preview" ? "block" : "none",
              lg: "block",
            }}
          >
            {firstUnseen === "map" && (
              <TooltipCard
                text="Navigate the map to frame your view. It saves automatically as you go."
                onDismiss={() => dismiss("map")}
              />
            )}
            <UnifiedMap
              camera={camera}
              onCameraChange={handleCameraChange}
              layers={layers}
              basemap={basemap}
              onBasemapChange={setBasemap}
              transitionDuration={transitionDuration}
              terrain={activeChapter.map_state.terrain}
              globe={activeChapter.map_state.globe}
              buildings={activeChapter.map_state.buildings}
              allowTerrain={chapterAllowsTerrain(
                "layer_config" in activeChapter
                  ? activeChapter.layer_config
                  : undefined
              )}
            >
              {previewRenderMetadata && (
                <Box position="absolute" top={3} right={3} zIndex={10}>
                  <RenderModeIndicator {...previewRenderMetadata} />
                </Box>
              )}
              {viewSavedFlash && (
                <Flex
                  position="absolute"
                  bottom={4}
                  left="50%"
                  transform="translateX(-50%)"
                  align="center"
                  gap={1}
                  bg="whiteAlpha.900"
                  px={3}
                  py={1.5}
                  borderRadius="md"
                  shadow="sm"
                  fontSize="xs"
                  color="green.600"
                  fontWeight={500}
                  pointerEvents="none"
                >
                  <Check size={12} /> View saved
                </Flex>
              )}
              {!viewSavedFlash &&
                activeChapter &&
                activeChapter.type !== "flyover" &&
                (() => {
                  const ms = activeChapter.map_state;
                  const differs =
                    Math.abs(camera.longitude - ms.center[0]) > 0.0001 ||
                    Math.abs(camera.latitude - ms.center[1]) > 0.0001 ||
                    Math.abs(camera.zoom - ms.zoom) > 0.01 ||
                    Math.abs(camera.bearing - ms.bearing) > 0.1 ||
                    Math.abs(camera.pitch - ms.pitch) > 0.1 ||
                    basemap !== ms.basemap;
                  return differs ? (
                    <Button
                      position="absolute"
                      bottom={4}
                      left="50%"
                      transform="translateX(-50%)"
                      size="sm"
                      variant="outline"
                      bg="whiteAlpha.900"
                      shadow="md"
                      onClick={resetView}
                      display="flex"
                      alignItems="center"
                      gap={1.5}
                    >
                      <ArrowCounterClockwise size={14} /> Reset view
                    </Button>
                  ) : null;
                })()}
            </UnifiedMap>
          </Box>
        ) : (
          <Box
            id="story-editor-panel-preview"
            role="tabpanel"
            aria-labelledby="story-editor-tab-preview"
            flex={1}
            overflowY="auto"
            bg="bg.subtle"
            display={{
              base: editorView === "preview" ? "block" : "none",
              lg: "block",
            }}
          >
            {activeChapter && (
              <Suspense fallback={<EditorPanelFallback />}>
                <ChapterPreview
                  chapter={activeChapter}
                  onChange={updateChapter}
                />
              </Suspense>
            )}
          </Box>
        )}

        {/* Right: editor panel */}
        <Box
          id="story-editor-panel-edit"
          role="tabpanel"
          aria-labelledby="story-editor-tab-edit"
          flexShrink={0}
          borderLeft="1px solid"
          borderColor="gray.200"
          bg="white"
          overflowY="auto"
          position="relative"
          width={{ base: "100%", lg: "340px" }}
          display={{
            base: editorView === "edit" ? "block" : "none",
            lg: "block",
          }}
        >
          {firstUnseen === "narrative" && (
            <TooltipCard
              text="Write what readers will see alongside the map. Use the toolbar for formatting."
              onDismiss={() => dismiss("narrative")}
            />
          )}
          <Suspense fallback={<EditorPanelFallback />}>
            {activeChapter && activeChapter.type === "chart" ? (
              <ChartChapterEditor
                chapter={activeChapter}
                onChange={updateChapter}
                onChapterTypeChange={updateChapterType}
              />
            ) : activeChapter && activeChapter.type === "image" ? (
              <ImageChapterEditor
                chapter={activeChapter}
                onChange={updateChapter}
                onChapterTypeChange={updateChapterType}
              />
            ) : activeChapter && activeChapter.type === "video" ? (
              <VideoChapterEditor
                chapter={activeChapter}
                onChange={(next) => updateChapter(next)}
                onChapterTypeChange={updateChapterType}
              />
            ) : activeChapter ? (
              <>
                <NarrativeEditor
                  chapterType={activeChapter.type}
                  onChapterTypeChange={updateChapterType}
                  title={activeChapter.title}
                  narrative={activeChapter.narrative}
                  onTitleChange={updateChapterTitle}
                  onNarrativeChange={updateChapterNarrative}
                  layerConfig={
                    "layer_config" in activeChapter &&
                    activeChapter.layer_config
                      ? activeChapter.layer_config
                      : DEFAULT_LAYER_CONFIG
                  }
                  onLayerConfigChange={updateChapterLayerConfig}
                  datasetType={activeDataset?.dataset_type ?? "raster"}
                  datasets={allDatasets}
                  connections={allConnections}
                  dataStatus={
                    datasetsResource.status === "loading" ||
                    connectionsResource.status === "loading"
                      ? "loading"
                      : datasetsResource.status === "error" ||
                          connectionsResource.status === "error"
                        ? "error"
                        : "ready"
                  }
                  dataError={
                    [datasetsResource.error, connectionsResource.error]
                      .filter(Boolean)
                      .join("; ") || null
                  }
                  onDataRetry={() => {
                    datasetsResource.retry();
                    connectionsResource.retry();
                  }}
                  onUploadClick={() => setUploadModalOpen(true)}
                  onAddConnectionClick={() => setConnectionModalOpen(true)}
                  overlayPosition={
                    activeChapter.type === "scrollytelling"
                      ? (activeChapter.overlay_position ?? "left")
                      : "left"
                  }
                  onOverlayPositionChange={updateChapterOverlayPosition}
                  temporalTimesteps={activeDatasetTimesteps}
                  mapState={
                    "map_state" in activeChapter
                      ? activeChapter.map_state
                      : DEFAULT_MAP_STATE
                  }
                  onMapStateChange={updateChapterMapState}
                />
                {isMapBoundChapter(activeChapter) && (
                  <>
                    <OverlayLayersEditor
                      overlays={activeChapter.overlays ?? []}
                      datasets={allDatasets}
                      connections={allConnections}
                      onChange={updateChapterOverlays}
                      onAddClick={() => setOverlayPickerOpen(true)}
                    />
                    {overlayPickerOpen && (
                      <OverlayPicker
                        open
                        datasets={allDatasets.filter(
                          (d) => d.dataset_type === "vector"
                        )}
                        connections={allConnections.filter(
                          (c) =>
                            (c.connection_type === "pmtiles" &&
                              c.tile_type === "vector") ||
                            c.connection_type === "xyz_vector"
                        )}
                        onClose={() => setOverlayPickerOpen(false)}
                        onSelect={(overlay) => {
                          updateChapterOverlays([
                            ...(activeChapter.overlays ?? []),
                            overlay,
                          ]);
                          setOverlayPickerOpen(false);
                        }}
                      />
                    )}
                  </>
                )}
                {activeChapter.type === "flyover" && (
                  <Box px={4} pb={6}>
                    <FlyoverKeyframePanel
                      chapter={activeChapter}
                      onChange={updateChapter}
                      currentCamera={camera}
                      onPreviewPose={previewFlyoverPose}
                    />
                  </Box>
                )}
              </>
            ) : (
              <Flex h="100%" align="center" justify="center">
                <Text color="gray.400">Select a chapter to edit</Text>
              </Flex>
            )}
          </Suspense>
        </Box>
      </Flex>
      <Suspense fallback={null}>
        {uploadModalOpen && (
          <UploadModal
            open
            onClose={() => setUploadModalOpen(false)}
            onDatasetReady={handleDatasetReady}
          />
        )}
        {connectionModalOpen && (
          <ConnectionModal
            isOpen
            onClose={() => setConnectionModalOpen(false)}
            onCreated={handleConnectionCreated}
          />
        )}
        {publishDialogOpen && (
          <PublishDialog
            open
            story={story}
            shareUrl={`${window.location.origin}/story/${story.id}`}
            onPublish={handlePublish}
            onClose={() => setPublishDialogOpen(false)}
          />
        )}
        {exportDialogOpen && (
          <ExportDialog
            open
            story={story}
            onClose={() => setExportDialogOpen(false)}
          />
        )}
      </Suspense>
    </Box>
  );
}
