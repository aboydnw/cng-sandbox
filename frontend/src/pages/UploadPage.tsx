import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { FileUploader } from "../components/FileUploader";
import { ProgressTracker } from "../components/ProgressTracker";
import { useConversionJob } from "../hooks/useConversionJob";

function formatSize(file: File): string {
  const mb = file.size / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { state, startUpload, startUrlFetch, startTemporalUpload } = useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({ name: "", size: "" });

  const isProcessing = state.isUploading || (state.jobId !== null && state.status !== "failed");

  const handleFile = (file: File) => {
    fileRef.current = { name: file.name, size: formatSize(file) };
    startUpload(file);
  };

  const handleUrl = (url: string) => {
    const filename = url.split("/").pop() || "download";
    fileRef.current = { name: filename, size: "fetching..." };
    startUrlFetch(url);
  };

  useEffect(() => {
    if (state.status === "ready" && state.datasetId) {
      navigate(`/map/${state.datasetId}`);
    }
  }, [state.status, state.datasetId, navigate]);

  return (
    <Box minH="100vh" bg="white">
      <Header />
      {isProcessing ? (
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
          <Text color="red.500" fontSize="14px">{state.error}</Text>
        </Box>
      )}
    </Box>
  );
}
