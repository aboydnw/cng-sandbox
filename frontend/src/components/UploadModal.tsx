import { useEffect, useRef } from "react";
import {
  Box,
  Button,
  CloseButton,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Text,
} from "@chakra-ui/react";
import { FileUploader } from "./FileUploader";
import { ProgressTracker } from "./ProgressTracker";
import { VariablePicker } from "./VariablePicker";
import { useConversionJob } from "../hooks/useConversionJob";
import { formatBytes } from "../utils/format";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onDatasetReady: (datasetId: string) => void;
}

export function UploadModal({ open, onClose, onDatasetReady }: UploadModalProps) {
  const { state, startUpload, startUrlFetch, startTemporalUpload, confirmVariable } =
    useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({ name: "", size: "" });

  const isProcessing =
    state.isUploading || (state.jobId !== null && state.status !== "failed");

  function handleFile(file: File) {
    fileRef.current = { name: file.name, size: formatBytes(file.size) };
    startUpload(file);
  }

  function handleUrl(url: string) {
    const filename = url.split("/").pop() || "download";
    fileRef.current = { name: filename, size: "fetching..." };
    startUrlFetch(url);
  }

  useEffect(() => {
    if (state.status === "ready" && state.datasetId) {
      onDatasetReady(state.datasetId);
    }
  }, [state.status, state.datasetId]);

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a dataset</DialogTitle>
          <DialogCloseTrigger asChild>
            <CloseButton size="sm" />
          </DialogCloseTrigger>
        </DialogHeader>
        <DialogBody pb={6}>
          {state.scanResult ? (
            <VariablePicker
              variables={state.scanResult.variables}
              onSelect={(variable, group) =>
                confirmVariable(state.scanResult!.scan_id, variable, group)
              }
            />
          ) : isProcessing ? (
            <ProgressTracker
              stages={state.stages}
              filename={fileRef.current.name}
              fileSize={fileRef.current.size}
            />
          ) : (
            <FileUploader
              onFileSelected={handleFile}
              onFilesSelected={startTemporalUpload}
              onUrlSubmitted={handleUrl}
              disabled={false}
            />
          )}
          {state.status === "failed" && state.error && (
            <Box textAlign="center" py={4}>
              <Text color="red.500" fontSize="14px">
                {state.error}
              </Text>
            </Box>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
