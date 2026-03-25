import { Box, Flex, Text, Textarea } from "@chakra-ui/react";
import { Plus, Sparkle } from "@phosphor-icons/react";
import { useState } from "react";
import type { ChapterType, LayerConfig } from "../lib/story";
import type { Dataset } from "../types";
import { ChapterTypePicker } from "./ChapterTypePicker";

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
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [roughNotes, setRoughNotes] = useState("");

  function generatePrompt() {
    const prompt = `Context:
- This is a chapter titled "${title}" in a scrollytelling map story.

My rough notes:
"${roughNotes}"

Task: Write 2-3 paragraphs of narrative text for this chapter of a scrollytelling story about geospatial data. Use clear, accessible language suitable for a non-technical audience. Write in the style of a scientific narrative, not marketing copy. Output as markdown.`;

    navigator.clipboard?.writeText(prompt);
    setShowAiPrompt(false);
    setRoughNotes("");
  }

  return (
    <Flex direction="column" h="100%" p={3} gap={2}>
      <ChapterTypePicker value={chapterType} onChange={onChapterTypeChange} />

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

      <Flex justify="space-between" align="center">
        <Text fontSize="10px" color="gray.500" fontWeight={600} letterSpacing="1px" textTransform="uppercase">
          Narrative
        </Text>
        <Text fontSize="10px" color="gray.400">
          Markdown supported
        </Text>
      </Flex>

      <Textarea
        flex={1}
        value={narrative}
        onChange={(e) => onNarrativeChange(e.target.value)}
        placeholder="Write your narrative here... (markdown supported)"
        fontFamily="mono"
        fontSize="13px"
        resize="none"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="6px"
        p={3}
        _focus={{ borderColor: "blue.300", boxShadow: "none" }}
      />

      {chapterType !== "prose" && (
        <Flex gap={4} px={4} py={2} borderTop="1px solid" borderColor="gray.100" flexWrap="wrap">
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>Dataset</Text>
            <Flex gap={1} align="center">
              <select
                value={layerConfig.dataset_id}
                onChange={(e) => onLayerConfigChange({ ...layerConfig, dataset_id: e.target.value })}
                style={{ fontSize: "13px", padding: "4px 8px", maxWidth: "200px" }}
              >
                {datasets.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.filename} ({ds.dataset_type})</option>
                ))}
              </select>
              {onAddDataset && (
                <Text
                  as="button"
                  fontSize="12px"
                  color="blue.500"
                  fontWeight={600}
                  cursor="pointer"
                  onClick={onAddDataset}
                  _hover={{ color: "blue.600" }}
                  whiteSpace="nowrap"
                >
                  <Flex align="center" gap={1.5}><Plus size={12} weight="bold" /> Add</Flex>
                </Text>
              )}
            </Flex>
          </Box>
          {datasetType === "raster" && (
            <>
              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>Colormap</Text>
                <select
                  value={layerConfig.colormap}
                  onChange={(e) => onLayerConfigChange({ ...layerConfig, colormap: e.target.value })}
                  style={{ fontSize: "13px", padding: "4px 8px" }}
                >
                  {["viridis", "plasma", "inferno", "magma", "cividis", "terrain", "blues", "reds"].map(cm => (
                    <option key={cm} value={cm}>{cm}</option>
                  ))}
                </select>
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>Opacity</Text>
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

      {showAiPrompt ? (
        <Box border="1px solid" borderColor="gray.200" borderRadius="6px" p={3}>
          <Text fontSize="12px" color="gray.600" mb={2}>
            What's the story here? (rough notes)
          </Text>
          <Textarea
            value={roughNotes}
            onChange={(e) => setRoughNotes(e.target.value)}
            placeholder="deforestation got way worse after 2015, especially near palm oil plantations..."
            fontSize="12px"
            rows={3}
            resize="none"
            mb={2}
          />
          <Flex gap={2} justify="flex-end">
            <Text
              as="button"
              fontSize="11px"
              color="gray.500"
              onClick={() => setShowAiPrompt(false)}
              cursor="pointer"
            >
              Cancel
            </Text>
            <Text
              as="button"
              fontSize="11px"
              color="blue.500"
              fontWeight={600}
              onClick={generatePrompt}
              cursor="pointer"
            >
              Copy prompt to clipboard
            </Text>
          </Flex>
        </Box>
      ) : (
        <Text
          as="button"
          fontSize="11px"
          color="gray.500"
          cursor="pointer"
          textAlign="left"
          onClick={() => setShowAiPrompt(true)}
          _hover={{ color: "blue.500" }}
        >
          <Flex align="center" gap={1.5} display="inline-flex"><Sparkle size={14} /> Draft with AI</Flex>
        </Text>
      )}
    </Flex>
  );
}
