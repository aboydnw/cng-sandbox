import { Box, Button, Flex, Input, Text, Menu, Portal } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  PencilSimple,
  X as XIcon,
  ArrowCounterClockwise,
  Check,
  SpinnerGap,
  CaretDown,
} from "@phosphor-icons/react";
import { useTooltipDismiss } from "../hooks/useTooltipDismiss";
import { useStoryEditor } from "../hooks/useStoryEditor";
import { UnifiedMap } from "../components/UnifiedMap";
import { ChapterList } from "../components/ChapterList";
import { NarrativeEditor } from "../components/NarrativeEditor";
import { UploadModal } from "../components/UploadModal";
import { ConnectionModal } from "../components/ConnectionModal";
import { PublishDialog } from "../components/PublishDialog";
import { Header } from "../components/Header";
import { SaveStatus } from "../components/SaveStatus";
import { RenderModeIndicator } from "../components/RenderModeIndicator";

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
    flyToRef,
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
    updateChapterType,
    updateChapterOverlayPosition,
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

  const activeDatasetTimesteps = useMemo(() => {
    const config = activeChapter?.layer_config;
    if (!config) return undefined;
    const ds = config.dataset_id
      ? allDatasets.find((d) => d.id === config.dataset_id)
      : undefined;
    return ds?.is_temporal ? ds.timesteps : undefined;
  }, [activeChapter?.layer_config, allDatasets]);

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
        <Flex
          align="center"
          gap={1}
          role="group"
          position="relative"
          flex="1 1 auto"
          minW={0}
          maxW="300px"
        >
          <Input
            value={story.title}
            onChange={(e) =>
              updateStory((s) => ({ ...s, title: e.target.value }))
            }
            placeholder="Click to name your story"
            fontSize="15px"
            fontWeight={600}
            border="none"
            borderBottom="2px solid"
            borderColor="transparent"
            borderRadius={0}
            outline="none"
            background="transparent"
            width="100%"
            minW={0}
            textOverflow="ellipsis"
            p={0}
            height="auto"
            _hover={{ borderColor: "gray.300" }}
            _focusVisible={{ borderColor: "brand.orange", boxShadow: "none" }}
            _placeholder={{ color: "gray.400", fontWeight: 400 }}
          />
          <Box
            color="gray.400"
            opacity={0}
            _groupHover={{ opacity: 1 }}
            _groupFocusWithin={{ opacity: 1 }}
            pointerEvents="none"
            flexShrink={0}
          >
            <PencilSimple size={14} />
          </Box>
        </Flex>
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
          <Flex align="center">
            <Button
              size="sm"
              variant="outline"
              borderRightRadius={0}
              borderRightWidth={0}
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
                  variant="outline"
                  borderLeftRadius={0}
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
          />
        </Box>

        {/* Center: map (full height) — hidden for prose chapters */}
        {activeChapter?.type !== "prose" ? (
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
              transitionInterpolator={
                transitionDuration ? flyToRef.current : undefined
              }
            >
              {previewRenderMetadata && (
                <RenderModeIndicator {...previewRenderMetadata} />
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
          <Box flex={1} />
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
          {activeChapter ? (
            <NarrativeEditor
              chapterType={activeChapter.type}
              onChapterTypeChange={updateChapterType}
              title={activeChapter.title}
              narrative={activeChapter.narrative}
              onTitleChange={updateChapterTitle}
              onNarrativeChange={updateChapterNarrative}
              layerConfig={activeChapter.layer_config}
              onLayerConfigChange={updateChapterLayerConfig}
              datasetType={activeDataset?.dataset_type ?? "raster"}
              datasets={allDatasets}
              connections={allConnections}
              onUploadClick={() => setUploadModalOpen(true)}
              onAddConnectionClick={() => setConnectionModalOpen(true)}
              overlayPosition={activeChapter?.overlay_position ?? "left"}
              onOverlayPositionChange={updateChapterOverlayPosition}
              temporalTimesteps={activeDatasetTimesteps}
            />
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
    </Box>
  );
}
