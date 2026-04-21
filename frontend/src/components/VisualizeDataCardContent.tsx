import { useState } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";
import { FileUploader } from "./FileUploader";
import { useUrlDetection } from "../hooks/useUrlDetection";
import type { UrlDetectionResult } from "../hooks/useUrlDetection";

interface VisualizeDataCardContentProps {
  onFileSelected: (file: File) => void;
  onFilesSelected: (files: File[]) => void;
  onExampleClicked: (datasetId: string) => void;
  onUrlSubmitted: (result: UrlDetectionResult) => void;
  inlineContent?: React.ReactNode;
}

export function VisualizeDataCardContent({
  onFileSelected,
  onFilesSelected,
  onExampleClicked,
  onUrlSubmitted,
  inlineContent,
}: VisualizeDataCardContentProps) {
  const [urlInput, setUrlInput] = useState("");
  const { detect, detecting } = useUrlDetection();

  const handleContinue = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const result = await detect(trimmed);
    if (result) {
      onUrlSubmitted(result);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleContinue();
    }
  };

  return (
    <Box>
      <FileUploader
        onFileSelected={onFileSelected}
        onFilesSelected={onFilesSelected}
        onUrlSubmitted={() => {}}
        disabled={false}
        embedded
      />

      <Flex gap={2} mt={3}>
        <Input
          aria-label="URL"
          placeholder="Paste a URL to a COG, PMTiles, GeoJSON…"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          size="sm"
          flex={1}
        />
        <Button
          size="sm"
          colorPalette="orange"
          onClick={handleContinue}
          disabled={detecting || !urlInput.trim()}
        >
          {detecting ? "Detecting…" : "Continue"}
        </Button>
      </Flex>

      {inlineContent}
    </Box>
  );
}
