import { Box, Button, Flex, Text, Menu, Portal } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  X as XIcon,
  ArrowCounterClockwise,
  Check,
  SpinnerGap,
  CaretDown,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useTooltipDismiss } from "../hooks/useTooltipDismiss";
import { useStoryEditor } from "../hooks/useStoryEditor";
import { UnifiedMap } from "../components/UnifiedMap";
import { ChapterList } from "../components/ChapterList";
import { NarrativeEditor } from "../components/NarrativeEditor";
import { OverlayLayersEditor } from "../components/OverlayLayersEditor";
import { OverlayPicker } from "../components/OverlayPicker";
import { FlyoverKeyframePanel } from "../components/flyover/FlyoverKeyframePanel";
import { VideoChapterEditor } from "../components/editor/VideoChapterEditor";
import { UploadModal } from "../components/UploadModal";
import { ConnectionModal } from "../components/ConnectionModal";
import { PublishDialog } from "../components/PublishDialog";
import { ExportDialog } from "../components/ExportDialog";
import { Header } from "../components/Header";
import { SaveStatus } from "../components/SaveStatus";
import { RenderModeIndicator } from "../components/RenderModeIndicator";
import {
  isMapBoundChapter,
  DEFAULT_LAYER_CONFIG,
  DEFAULT_MAP_STATE,
} from "../lib/story";
import { chapterAllowsTerrain } from "../lib/story/terrainPolicy";
import { ChapterPreview } from "../components/editor/ChapterPreview";
import { ImageChapterEditor } from "../components/editor/ImageChapterEditor";
import { ChartChapterEditor } from "../components/editor/ChartChapterEditor";

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
      <Flex h="100vh" align="center" justify="center">
        <SpinnerGap
          size={32}
          style={{ animation: "spin 1s linear infinite" }}
        />
      </Flex>
    );
  }
  if (error || !story) {
    return (
      <Flex
        h="100vh"
        direction="column"
        align="center"
        justify="center"
        gap={3}
      >
        <Text color="red.500">{error ?? "Story not found"}</Text>
      </Flex>
    );
  }

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      <Header showWorkspace={false}>
        <SaveStatus state={saveState} />
        <Flex gap={3} align="center">
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
            variant="outline"
            borderColor="brand.border"
            color="brand.brown"
            _hover={{ bg: "brand.bgSubtle", borderColor: "brand.orange" }}
            onClick={() => setExportDialogOpen(true)}
          >
            <DownloadSimple size={14} weight="bold" /> Export
          </Button>
          <Flex align="center">
            <Button
              size="sm"
              bg="brand.orange"
              color="white"
              _hover={{ bg: "brand.brown" }}
              borderRightRadius={0}
              onClick={() =>
                window.open(workspacePath(`/story/${story.id}`), "_blank")
              }
            >
              Preview
            </Button>
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <Button
                  size="sm"
                  bg="brand.orange"
                  color="white"
                  _hover={{ bg: "brand.brown" }}
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
                    {story.published ? (
                      <>
                        <Menu.Item
                          value="share-settings"
                          onSelect={() => setPublishDialogOpen(true)}
                        >
                          Share settings…
                        </Menu.Item>
                        <Menu.Item
                          value="unpublish"
                          color="red.600"
                          onSelect={handleUnpublish}
                        >
                          Unpublish
                        </Menu.Item>
                      </>
                    ) : (
                      <Menu.Item
                        value="publish"
                        onSelect={() => setPublishDialogOpen(true)}
                      >
                        Publish…
                      </Menu.Item>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </Flex>
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

      {/* Three-panel layout: Chapters | Map | Editor */}
      <Flex flex={1} overflow="hidden">
        {/* Left: chapter list */}
        <Box
          w="200px"
          flexShrink={0}
          borderRight="1px solid"
          borderColor="gray.200"
          bg="white"
          position="relative"
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
            onSelect={selectChapter}
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
          <Box ref={mapContainerRef} flex={1} position="relative">
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
          <Box flex={1} overflowY="auto" bg="gray.50">
            {activeChapter && (
              <ChapterPreview
                chapter={activeChapter}
                onChange={updateChapter}
              />
            )}
          </Box>
        )}

        {/* Right: editor panel */}
        <Box
          w="340px"
          flexShrink={0}
          borderLeft="1px solid"
          borderColor="gray.200"
          bg="white"
          overflowY="auto"
          position="relative"
        >
          {firstUnseen === "narrative" && (
            <TooltipCard
              text="Write what readers will see alongside the map. Use the toolbar for formatting."
              onDismiss={() => dismiss("narrative")}
            />
          )}
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
                  "layer_config" in activeChapter && activeChapter.layer_config
                    ? activeChapter.layer_config
                    : DEFAULT_LAYER_CONFIG
                }
                onLayerConfigChange={updateChapterLayerConfig}
                datasetType={activeDataset?.dataset_type ?? "raster"}
                datasets={allDatasets}
                connections={allConnections}
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
                  <OverlayPicker
                    open={overlayPickerOpen}
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
        </Box>
      </Flex>
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDatasetReady={handleDatasetReady}
      />
      <ConnectionModal
        isOpen={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
        onCreated={handleConnectionCreated}
      />
      <PublishDialog
        open={publishDialogOpen}
        story={story}
        shareUrl={`${window.location.origin}/story/${story.id}`}
        onPublish={handlePublish}
        onClose={() => setPublishDialogOpen(false)}
      />
      <ExportDialog
        open={exportDialogOpen}
        story={story}
        onClose={() => setExportDialogOpen(false)}
      />
    </Box>
  );
}
