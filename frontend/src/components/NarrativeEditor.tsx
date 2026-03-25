import { Box, Flex, Text } from "@chakra-ui/react";
import { Plus } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { ChapterType, LayerConfig } from "../lib/story";
import type { Dataset } from "../types";
import { ChapterTypePicker } from "./ChapterTypePicker";
import { ColormapPicker } from "./ColormapPicker";
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
  onAddDataset?: () => void;
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
  onAddDataset,
}: NarrativeEditorProps) {
  const [activeTab, setActiveTab] = useState<"content" | "style">("content");
  const narrativeRef = useRef<HTMLTextAreaElement>(null);

  function handleChapterTypeChange(type: ChapterType) {
    if (type === "prose") {
      setActiveTab("content");
    }
    onChapterTypeChange(type);
  }

  const showStyleTab = chapterType !== "prose";

  return (
    <Flex direction="column" p={3} gap={2}>
      <ChapterTypePicker value={chapterType} onChange={handleChapterTypeChange} />

      {showStyleTab && (
        <Box>
          <Text fontSize="12px" color="gray.500" fontWeight={600} letterSpacing="1px" textTransform="uppercase" mb={1}>
            Dataset
          </Text>
          <Flex gap={1} align="center">
            <select
              value={layerConfig.dataset_id}
              onChange={(e) => onLayerConfigChange({ ...layerConfig, dataset_id: e.target.value })}
              style={{ fontSize: "13px", padding: "6px 8px", maxWidth: "220px", borderRadius: "4px", border: "1px solid #e8e5e0" }}
            >
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.filename} ({ds.dataset_type})</option>
              ))}
            </select>
            {onAddDataset && (
              <Text
                as="button"
                fontSize="12px"
                color="brand.orange"
                fontWeight={600}
                cursor="pointer"
                onClick={onAddDataset}
                _hover={{ color: "brand.orangeHover" }}
                whiteSpace="nowrap"
              >
                <Flex align="center" gap={1.5}><Plus size={12} weight="bold" /> Add</Flex>
              </Text>
            )}
          </Flex>
        </Box>
      )}

      <Flex borderBottom="1px solid" borderColor="gray.200" gap={0}>
        <Box
          as="button"
          fontSize="13px"
          fontWeight={600}
          px={3}
          py={1.5}
          color={activeTab === "content" ? "brand.orange" : "gray.500"}
          borderBottom="2px solid"
          borderColor={activeTab === "content" ? "brand.orange" : "transparent"}
          cursor="pointer"
          onClick={() => setActiveTab("content")}
          _hover={{ color: "brand.orange" }}
        >
          Content
        </Box>
        {showStyleTab && (
          <Box
            as="button"
            fontSize="13px"
            fontWeight={600}
            px={3}
            py={1.5}
            color={activeTab === "style" ? "brand.orange" : "gray.500"}
            borderBottom="2px solid"
            borderColor={activeTab === "style" ? "brand.orange" : "transparent"}
            cursor="pointer"
            onClick={() => setActiveTab("style")}
            _hover={{ color: "brand.orange" }}
          >
            Style
          </Box>
        )}
      </Flex>

      {activeTab === "content" && (
        <>
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

          <Text fontSize="12px" color="gray.500" fontWeight={600} letterSpacing="1px" textTransform="uppercase">
            Narrative
          </Text>

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
        </>
      )}

      {activeTab === "style" && showStyleTab && (
        <Flex direction="column" gap={4} px={1} py={2}>
          {datasetType === "raster" && (
            <>
              <Box>
                <Text fontSize="12px" color="gray.500" fontWeight={600} letterSpacing="1px" textTransform="uppercase" mb={1}>Colormap</Text>
                <ColormapPicker
                  value={layerConfig.colormap}
                  onChange={(cm) => onLayerConfigChange({ ...layerConfig, colormap: cm })}
                />
              </Box>
              <Box>
                <Text fontSize="12px" color="gray.500" fontWeight={600} letterSpacing="1px" textTransform="uppercase" mb={1}>Opacity</Text>
                <input
                  type="range"
                  min={0} max={100}
                  value={Math.round(layerConfig.opacity * 100)}
                  onChange={(e) => onLayerConfigChange({ ...layerConfig, opacity: Number(e.target.value) / 100 })}
                />
              </Box>
            </>
          )}
        </Flex>
      )}
    </Flex>
  );
}
