import { useState, useEffect } from "react";
import { Box, Button, Flex, Input, Spinner, Text } from "@chakra-ui/react";
import { FileUploader } from "./FileUploader";
import { useUrlDetection } from "../hooks/useUrlDetection";
import { workspaceFetch } from "../lib/api";
import type { UrlDetectionResult } from "../hooks/useUrlDetection";

interface ExampleDataset {
  id: string;
  title: string;
  is_example?: boolean;
}

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
  const { detect, detecting, error } = useUrlDetection();
  const [examples, setExamples] = useState<ExampleDataset[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    workspaceFetch("/api/datasets", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: ExampleDataset[]) => {
        setExamples(data.filter((ds) => ds.is_example).slice(0, 5));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

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
      handleContinue().catch(() => {});
    }
  };

  return (
    <Box>
      {examples.length > 0 && (
        <Box mb={3}>
          <Text fontSize="xs" color="brand.textSecondary" mb={1.5}>
            Featured datasets
          </Text>
          <Flex gap={2} overflowX="auto" pb={1}>
            {examples.map((ds) => (
              <Button
                key={ds.id}
                size="xs"
                variant="outline"
                colorPalette="orange"
                flexShrink={0}
                onClick={() => onExampleClicked(ds.id)}
              >
                {ds.title}
              </Button>
            ))}
          </Flex>
        </Box>
      )}

      <FileUploader
        onFileSelected={onFileSelected}
        onFilesSelected={onFilesSelected}
        onUrlSubmitted={() => {}}
        disabled={false}
        embedded
      />

      <Flex gap={2} mt={3} align="center">
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
        {detecting && <Spinner size="sm" />}
      </Flex>

      {error && (
        <Text color="red.400" fontSize="xs" mt={1}>
          {error}
        </Text>
      )}

      {inlineContent}
    </Box>
  );
}
