import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { FileUploader } from "./FileUploader";
import { ProgressTracker } from "./ProgressTracker";
import { VariablePicker } from "./VariablePicker";
import { useConversionJob } from "../hooks/useConversionJob";
import { formatBytes } from "../utils/format";

interface InlineUploadProps {
  onCancel: () => void;
}

export function InlineUpload({ onCancel }: InlineUploadProps) {
  const navigate = useNavigate();
  const { state, startUpload, startUrlFetch, startTemporalUpload, confirmVariable } =
    useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({ name: "", size: "" });

  const isProcessing = state.isUploading || (state.jobId !== null && state.status !== "failed");

  // Navigate on success
  useEffect(() => {
    if (state.status === "ready" && state.datasetId) {
      navigate(`/map/${state.datasetId}`);
    }
  }, [state.status, state.datasetId, navigate]);

  const handleFile = useCallback(
    (file: File) => {
      fileRef.current = { name: file.name, size: formatBytes(file.size) };
      startUpload(file);
    },
    [startUpload],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        fileRef.current = {
          name: `${files.length} files`,
          size: formatBytes(files.reduce((sum, f) => sum + f.size, 0)),
        };
        startTemporalUpload(files);
      }
    },
    [startTemporalUpload],
  );

  const handleUrl = useCallback(
    (url: string) => {
      fileRef.current = { name: url.split("/").pop() || "remote file", size: "" };
      startUrlFetch(url);
    },
    [startUrlFetch],
  );

  const showUploader = !isProcessing && !state.scanResult;
  const showProgress = isProcessing || state.status === "failed";
  const showVariablePicker = !!state.scanResult;

  return (
    <Box h="100%" overflowY="auto">
      <Flex align="center" justify="space-between" mb={4}>
        <Text fontSize="sm" fontWeight="bold" color="white">
          Upload a new file
        </Text>
        <Button size="xs" variant="ghost" color="gray.400" onClick={onCancel}>
          ← Back
        </Button>
      </Flex>

      {showUploader && (
        <FileUploader
          onFileSelected={handleFile}
          onFilesSelected={handleFiles}
          onUrlSubmitted={handleUrl}
          embedded
        />
      )}

      {showProgress && (
        <ProgressTracker
          stages={state.stages}
          filename={fileRef.current.name}
          fileSize={fileRef.current.size}
          embedded
        />
      )}

      {showVariablePicker && state.scanResult && (
        <VariablePicker
          variables={state.scanResult.variables}
          onSelect={(variable, group) =>
            confirmVariable(state.scanResult!.scan_id, variable, group)
          }
        />
      )}
    </Box>
  );
}
