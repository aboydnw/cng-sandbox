import { Box, Flex, Text, Slider } from "@chakra-ui/react";
import { useRef } from "react";
import { Globe, Mountains, Buildings } from "@phosphor-icons/react";
import type { ChapterType, LayerConfig, MapState } from "../lib/story";
import { chapterAllowsTerrain } from "../lib/story/terrainPolicy";
import type { Connection, Dataset, MapItemSource, Timestep } from "../types";
import { detectCadence } from "../utils/temporal";
import { displayName } from "../utils/dataset";
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
  datasetType: "raster" | "vector" | "pointcloud";
  datasets: Dataset[];
  connections?: Connection[];
  onUploadClick?: () => void;
  onAddConnectionClick?: () => void;
  overlayPosition: "left" | "right";
  onOverlayPositionChange: (position: "left" | "right") => void;
  temporalTimesteps?: Timestep[];
  mapState: MapState;
  onMapStateChange: (partial: Partial<MapState>) => void;
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
  mapState,
  onMapStateChange,
}: NarrativeEditorProps) {
  const narrativeRef = useRef<HTMLTextAreaElement>(null);

  const showMapControls = chapterType !== "prose";

  const selectedConnection = connections?.find(
    (c) => c.id === layerConfig.connection_id
  );
  const selectedDataset = datasets.find(
    (ds) => ds.id === layerConfig.dataset_id
  );
  const showColormap =
    datasetType === "raster" &&
    !(selectedConnection?.connection_type === "xyz_raster");

  const dataSelectorItems: DataSelectorItem[] = [
    ...datasets.map((ds) => ({
      id: ds.id,
      name: displayName(ds),
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

      {showMapControls && (
        <Box mt={4}>
          <Text
            fontSize="xs"
            fontWeight={600}
            textTransform="uppercase"
            letterSpacing="0.5px"
            color="brand.brown"
            mb={2}
          >
            3D
          </Text>

          <Flex align="center" justify="space-between" mb={1}>
            <Flex align="center" gap={2}>
              <Mountains size={16} color="#CF3F02" />
              <Text fontSize="sm">Terrain</Text>
            </Flex>
            <input
              type="checkbox"
              role="switch"
              aria-label="terrain"
              disabled={!chapterAllowsTerrain(layerConfig)}
              checked={!!mapState.terrain?.enabled}
              onChange={(e) =>
                onMapStateChange({
                  terrain: {
                    enabled: e.target.checked,
                    exaggeration: mapState.terrain?.exaggeration ?? 1,
                  },
                })
              }
              style={{
                accentColor: "#CF3F02",
                cursor: chapterAllowsTerrain(layerConfig)
                  ? "pointer"
                  : "not-allowed",
              }}
            />
          </Flex>
          {!chapterAllowsTerrain(layerConfig) && (
            <Text fontSize="xs" color="gray.500" mb={2}>
              Terrain is off for chapters with data layers — data can&apos;t
              drape on 3D terrain yet.
            </Text>
          )}

          {mapState.terrain?.enabled && chapterAllowsTerrain(layerConfig) && (
            <Box mb={2}>
              <Text fontSize="xs" color="gray.600" mb={1}>
                Exaggeration: {(mapState.terrain?.exaggeration ?? 1).toFixed(1)}
                ×
              </Text>
              <Slider.Root
                min={0.5}
                max={3}
                step={0.1}
                value={[mapState.terrain?.exaggeration ?? 1]}
                onValueChange={({ value }: { value: number[] }) =>
                  onMapStateChange({
                    terrain: { enabled: true, exaggeration: value[0] },
                  })
                }
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0}>
                    <Slider.HiddenInput />
                  </Slider.Thumb>
                </Slider.Control>
              </Slider.Root>
            </Box>
          )}

          <Flex align="center" justify="space-between" mb={2}>
            <Flex align="center" gap={2}>
              <Globe size={16} color="#CF3F02" />
              <Text fontSize="sm">Globe</Text>
            </Flex>
            <input
              type="checkbox"
              role="switch"
              aria-label="globe"
              checked={!!mapState.globe}
              onChange={(e) => onMapStateChange({ globe: e.target.checked })}
              style={{ accentColor: "#CF3F02", cursor: "pointer" }}
            />
          </Flex>

          <Flex align="center" justify="space-between">
            <Flex align="center" gap={2}>
              <Buildings size={16} color="#CF3F02" />
              <Text fontSize="sm">Buildings</Text>
            </Flex>
            <input
              type="checkbox"
              role="switch"
              aria-label="buildings"
              checked={!!mapState.buildings}
              onChange={(e) =>
                onMapStateChange({ buildings: e.target.checked })
              }
              style={{ accentColor: "#CF3F02", cursor: "pointer" }}
            />
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
            {showColormap && (
              <Box>
                <Text fontSize="11px" color="gray.500" mb={1}>
                  Rescale
                </Text>
                <Flex gap={2} align="center">
                  <input
                    aria-label="Chapter rescale min"
                    type="number"
                    step="any"
                    placeholder={
                      selectedDataset?.raster_min != null
                        ? String(selectedDataset.raster_min)
                        : ""
                    }
                    defaultValue={layerConfig.rescale_min ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      onLayerConfigChange({
                        ...layerConfig,
                        rescale_min: v === "" ? null : Number(v),
                      });
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: "28px",
                      padding: "0 8px",
                      border: "1px solid #E2E8F0",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                  />
                  <input
                    aria-label="Chapter rescale max"
                    type="number"
                    step="any"
                    placeholder={
                      selectedDataset?.raster_max != null
                        ? String(selectedDataset.raster_max)
                        : ""
                    }
                    defaultValue={layerConfig.rescale_max ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      onLayerConfigChange({
                        ...layerConfig,
                        rescale_max: v === "" ? null : Number(v),
                      });
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: "28px",
                      padding: "0 8px",
                      border: "1px solid #E2E8F0",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                  />
                </Flex>
                <Flex mt={2} gap={2} align="center">
                  <label
                    style={{
                      fontSize: "11px",
                      color: "#718096",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={layerConfig.colormap_reversed === true}
                      onChange={(e) =>
                        onLayerConfigChange({
                          ...layerConfig,
                          colormap_reversed: e.target.checked,
                        })
                      }
                      style={{ marginRight: "6px" }}
                    />
                    Reverse colormap
                  </label>
                </Flex>
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
