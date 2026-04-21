import { useState, useEffect } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";
import { FileUploader } from "./FileUploader";
import { useUrlDetection } from "../hooks/useUrlDetection";
import { workspaceFetch } from "../lib/api";
import type { UrlDetectionResult } from "../hooks/useUrlDetection";

interface ExampleDataset {
  id: string;
  title: string | null;
  filename: string | null;
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
                bg="white"
                color="brand.brown"
                borderColor="brand.border"
                flexShrink={0}
                fontWeight={500}
                _hover={{ borderColor: "brand.orange", color: "brand.orange" }}
                onClick={() => onExampleClicked(ds.id)}
              >
                {ds.title || ds.filename || "Untitled"}
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
        hideUrlInput
      />

      <Flex align="center" gap={4} w="100%" mt={3}>
        <Box flex={1} h="1px" bg="brand.border" />
        <Text
          color="#aaa"
          fontSize="12px"
          textTransform="uppercase"
          letterSpacing="1px"
        >
          or
        </Text>
        <Box flex={1} h="1px" bg="brand.border" />
      </Flex>

      <Flex gap={2} mt={3} align="center">
        <Input
          aria-label="URL"
          placeholder="Paste a URL — we'll detect tile sources vs. files to convert"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          size="md"
          borderColor="#ddd"
          flex={1}
        />
        <Button
          bg="brand.orange"
          color="white"
          size="md"
          fontWeight={600}
          borderRadius="4px"
          _hover={{ bg: "brand.orangeHover" }}
          onClick={handleContinue}
          disabled={detecting || !urlInput.trim()}
        >
          {detecting ? "Detecting…" : "Continue"}
        </Button>
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
