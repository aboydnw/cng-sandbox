import { Box, Flex, Text } from "@chakra-ui/react";
import { useRef } from "react";
import type { ChapterType, LayerConfig } from "../lib/story";
import type { Connection, Dataset, MapItemSource, Timestep } from "../types";
import { detectCadence } from "../utils/temporal";
import { CalendarPopover } from "./CalendarPopover";
import { ChapterTypePicker } from "./ChapterTypePicker";
import { ColormapDropdown } from "./ColormapDropdown";
import { DataSelector } from "./DataSelector";
import type { DataSelectorItem } from "./DataSelector";
import { MarkdownToolbar } from "./MarkdownToolbar";

interface NarrativeEditorProps {
  chapterType: ChapterType;
  onChapterTypeChange: (type: ChapterType) => void;
  title: string;
  narrative: string;
  onTitleChange: (title: string) => void;
  onNarrativeChange: (narrative: string) => void;
  layerConfig: LayerConfig;
  onLayerConfigChange: (config: LayerConfig) => void;
  datasetType: "raster" | "vector";
  datasets: Dataset[];
  connections?: Connection[];
  onUploadClick?: () => void;
  onAddConnectionClick?: () => void;
  overlayPosition: "left" | "right";
  onOverlayPositionChange: (position: "left" | "right") => void;
  temporalTimesteps?: Timestep[];
}

export function NarrativeEditor({
  chapterType,
  onChapterTypeChange,
  title,
  narrative,
  onTitleChange,
  onNarrativeChange,
  layerConfig,
  onLayerConfigChange,
  datasetType,
  datasets,
  connections,
  onUploadClick,
  onAddConnectionClick,
  overlayPosition,
  onOverlayPositionChange,
  temporalTimesteps,
}: NarrativeEditorProps) {
  const narrativeRef = useRef<HTMLTextAreaElement>(null);

  const showMapControls = chapterType !== "prose";

  const selectedConnection = connections?.find(
    (c) => c.id === layerConfig.connection_id
  );
  const showColormap =
    datasetType === "raster" &&
    !(selectedConnection?.connection_type === "xyz_raster");

  const dataSelectorItems: DataSelectorItem[] = [
    ...datasets.map((ds) => ({
      id: ds.id,
      name: ds.filename,
      source: "dataset" as const,
      dataType: ds.dataset_type,
    })),
    ...(connections ?? []).map((conn) => ({
      id: conn.id,
      name: conn.name,
      source: "connection" as const,
      dataType:
        conn.connection_type === "xyz_vector" ||
        (conn.connection_type === "pmtiles" && conn.tile_type === "vector")
          ? ("vector" as const)
          : ("raster" as const),
    })),
  ];

  const activeDataId = layerConfig.connection_id || layerConfig.dataset_id;
  const activeSource: MapItemSource = layerConfig.connection_id
    ? "connection"
    : "dataset";

  function handleDataSelect(id: string, source: MapItemSource) {
    if (source === "connection") {
      onLayerConfigChange({
        ...layerConfig,
        connection_id: id,
        dataset_id: "",
      });
    } else {
      onLayerConfigChange({
        ...layerConfig,
        dataset_id: id,
        connection_id: undefined,
      });
    }
  }

  return (
    <Flex direction="column" p={3} gap={3}>
      {/* 1. Chapter type */}
      <ChapterTypePicker value={chapterType} onChange={onChapterTypeChange} />

      {/* 2. Overlay position (scrollytelling only) */}
      {chapterType === "scrollytelling" && (
        <Box>
          <Text
            fontSize="12px"
            color="gray.500"
            fontWeight={600}
            letterSpacing="1px"
            textTransform="uppercase"
            mb={1}
          >
            Overlay position
          </Text>
          <Flex
            gap={0}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="6px"
            overflow="hidden"
            w="fit-content"
          >
            {(["left", "right"] as const).map((pos) => (
              <Box
                key={pos}
                as="button"
                px={3}
                py={1}
                fontSize="12px"
                fontWeight={600}
                bg={overlayPosition === pos ? "brand.orange" : "transparent"}
                color={overlayPosition === pos ? "white" : "gray.600"}
                cursor="pointer"
                onClick={() => onOverlayPositionChange(pos)}
                _hover={{
                  bg: overlayPosition === pos ? "brand.orange" : "gray.50",
                }}
                textTransform="capitalize"
              >
                {pos}
              </Box>
            ))}
          </Flex>
        </Box>
      )}

      {/* 3. Dataset selector */}
      {showMapControls && (
        <Box>
          <Text
            fontSize="12px"
            color="gray.500"
            fontWeight={600}
            letterSpacing="1px"
            textTransform="uppercase"
            mb={1}
          >
            Dataset
          </Text>
          <DataSelector
            items={dataSelectorItems}
            activeId={activeDataId}
            activeSource={activeSource}
            onSelect={handleDataSelect}
            onUploadClick={onUploadClick ?? (() => {})}
            onAddConnectionClick={onAddConnectionClick ?? (() => {})}
          />
        </Box>
      )}

      {/* 4. Timestep (temporal datasets only) */}
      {showMapControls && temporalTimesteps && temporalTimesteps.length > 0 && (
        <Box>
          <Text
            fontSize="12px"
            color="gray.500"
            fontWeight={600}
            letterSpacing="1px"
            textTransform="uppercase"
            mb={1}
          >
            Timestep
          </Text>
          <CalendarPopover
            timesteps={temporalTimesteps}
            activeIndex={layerConfig.timestep ?? 0}
            onIndexChange={(index) =>
              onLayerConfigChange({ ...layerConfig, timestep: index })
            }
            cadence={detectCadence(temporalTimesteps.map((t) => t.datetime))}
          />
        </Box>
      )}

      {/* 5. Chapter title */}
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Chapter title"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          borderBottom: "1px solid #e2e8f0",
          padding: "4px 0",
          outline: "none",
          background: "transparent",
        }}
      />

      {/* 6. Narrative editor */}
      <Box
        flex={1}
        border="1px solid"
        borderColor="gray.200"
        borderRadius="6px"
        p={3}
        display="flex"
        flexDirection="column"
        _focusWithin={{ borderColor: "brand.border" }}
      >
        <MarkdownToolbar
          textareaRef={narrativeRef}
          value={narrative}
          onChange={onNarrativeChange}
        />
        <textarea
          ref={narrativeRef}
          value={narrative}
          onChange={(e) => onNarrativeChange(e.target.value)}
          placeholder="Write your narrative here..."
          style={{
            flex: 1,
            fontFamily: "inherit",
            fontSize: "14px",
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            minHeight: "120px",
          }}
        />
      </Box>

      {/* 7. Style section */}
      {showMapControls && (
        <Box>
          <Text
            fontSize="12px"
            color="gray.500"
            fontWeight={600}
            letterSpacing="1px"
            textTransform="uppercase"
            mb={2}
          >
            Style
          </Text>
          <Flex direction="column" gap={3}>
            {showColormap && (
              <Box>
                <Text fontSize="11px" color="gray.500" mb={1}>
                  Colormap
                </Text>
                <ColormapDropdown
                  value={layerConfig.colormap}
                  onChange={(cm) =>
                    onLayerConfigChange({ ...layerConfig, colormap: cm })
                  }
                />
              </Box>
            )}
            <Box>
              <Flex justify="space-between" mb={1}>
                <Text fontSize="11px" color="gray.500">
                  Opacity
                </Text>
                <Text fontSize="11px" color="gray.500">
                  {Math.round(layerConfig.opacity * 100)}%
                </Text>
              </Flex>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(layerConfig.opacity * 100)}
                onChange={(e) =>
                  onLayerConfigChange({
                    ...layerConfig,
                    opacity: Number(e.target.value) / 100,
                  })
                }
                style={{ width: "100%" }}
              />
            </Box>
          </Flex>
        </Box>
      )}
    </Flex>
  );
}
