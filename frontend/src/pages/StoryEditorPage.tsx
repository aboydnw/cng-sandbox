import { Box, Button, Flex, Input, Text, Link } from "@chakra-ui/react";
import {
  PencilSimple,
  X as XIcon,
  ArrowCounterClockwise,
  Check,
  SpinnerGap,
} from "@phosphor-icons/react";
import { useTooltipDismiss } from "../hooks/useTooltipDismiss";
import { useStoryEditor } from "../hooks/useStoryEditor";
import { UnifiedMap } from "../components/UnifiedMap";
import { ChapterList } from "../components/ChapterList";
import { NarrativeEditor } from "../components/NarrativeEditor";
import { UploadModal } from "../components/UploadModal";
import { PublishDialog } from "../components/PublishDialog";
import { Header } from "../components/Header";
import { BugReportLink } from "../components/BugReportLink";
import { SaveStatus } from "../components/SaveStatus";

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
    handleDatasetReady,
    handlePublish,
    handleUnpublish,
    setBasemap,
    setPublishDialogOpen,
    setUploadModalOpen,
    activeChapterId,
  } = useStoryEditor();

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
      <Header>
        <Flex align="center" gap={1} role="group" position="relative">
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
            width="300px"
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
        <Flex gap={2} align="center">
          <BugReportLink storyId={story.id} datasetIds={story.dataset_ids} />
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
            <Flex align="center" gap={2}>
              <Flex align="center" gap={1.5}>
                <Box w={2} h={2} borderRadius="full" bg="green.500" />
                <Button
                  size="sm"
                  bg="green.500"
                  color="white"
                  _hover={{ bg: "green.600" }}
                  onClick={() => setPublishDialogOpen(true)}
                >
                  Published
                </Button>
              </Flex>
              <Link
                fontSize="xs"
                color="gray.500"
                textDecoration="underline"
                cursor="pointer"
                onClick={handleUnpublish}
              >
                Unpublish
              </Link>
            </Flex>
          ) : (
            <Button
              size="sm"
              bg="brand.orange"
              color="white"
              onClick={() => setPublishDialogOpen(true)}
              _hover={{ bg: "brand.orangeHover" }}
            >
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
            {`${window.location.origin}${workspacePath(`/story/${story.id}`)}`}
          </Text>
          <Button
            size="xs"
            variant="ghost"
            color="green.600"
            _hover={{ bg: "green.100" }}
            px={2}
            h={5}
            onClick={() => {
              const url = `${window.location.origin}${workspacePath(`/story/${story.id}`)}`;
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
              onAddDataset={() => setUploadModalOpen(true)}
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
      <PublishDialog
        open={publishDialogOpen}
        story={story}
        shareUrl={`${window.location.origin}${workspacePath(`/story/${story.id}`)}`}
        onPublish={handlePublish}
        onClose={() => setPublishDialogOpen(false)}
      />
    </Box>
  );
}
