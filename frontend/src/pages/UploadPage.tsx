import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { HomepageHero } from "../components/HomepageHero";
import { PathCard } from "../components/PathCard";
import { FileUploader } from "../components/FileUploader";
import { ProgressTracker } from "../components/ProgressTracker";
import { VariablePicker } from "../components/VariablePicker";
import { BugReportModal } from "../components/BugReportModal";
import { FolderOpen, GlobeHemisphereWest } from "@phosphor-icons/react";
import { useConversionJob } from "../hooks/useConversionJob";
import { formatBytes } from "../utils/format";

type PageMode =
  | "initial"
  | "upload-idle"
  | "uploading"
  | "error"
  | "variable-picker";

export default function UploadPage() {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const {
    state,
    startUpload,
    startUrlFetch,
    startTemporalUpload,
    confirmVariable,
  } = useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({
    name: "",
    size: "",
  });
  const [mode, setMode] = useState<PageMode>("initial");
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isProcessing =
    state.isUploading || (state.jobId !== null && state.status !== "failed");

  // Derive mode from conversion job state
  useEffect(() => {
    if (state.scanResult) {
      setMode("variable-picker");
    } else if (state.status === "failed") {
      setMode("error");
    } else if (isProcessing) {
      setMode("uploading");
    }
  }, [state.scanResult, state.status, isProcessing]);

  // Navigate on success
  useEffect(() => {
    if (state.status === "ready" && state.datasetId) {
      navigate(workspacePath(`/map/${state.datasetId}`));
    }
  }, [state.status, state.datasetId, navigate, workspacePath]);

  const handleFile = useCallback(
    (file: File) => {
      fileRef.current = { name: file.name, size: formatBytes(file.size) };
      setMode("uploading");
      startUpload(file);
    },
    [startUpload]
  );

  const handleUrl = useCallback(
    (url: string) => {
      const filename = url.split("/").pop() || "download";
      fileRef.current = { name: filename, size: "fetching..." };
      setMode("uploading");
      startUrlFetch(url);
    },
    [startUrlFetch]
  );

  const handleTemporalUpload = useCallback(
    (files: File[]) => {
      fileRef.current = {
        name: `${files.length} files`,
        size: "calculating...",
      };
      setMode("uploading");
      startTemporalUpload(files);
    },
    [startTemporalUpload]
  );

  const handleRetry = useCallback(() => {
    setMode("upload-idle");
  }, []);

  const handleReport = useCallback(() => {
    setReportOpen(true);
  }, []);

  const uploadCardExpanded = mode !== "initial";
  const anyCardExpanded = uploadCardExpanded || storyExpanded;

  const handleUploadCardClick = () => {
    setStoryExpanded(false);
    setMode("upload-idle");
  };

  const handleStoryCardClick = () => {
    setMode("initial");
    setStoryExpanded(true);
  };

  return (
    <Flex direction="column" h="100vh" bg="white" overflow="hidden">
      <Header />
      <HomepageHero />

      <Flex
        gap={5}
        px={8}
        pb={4}
        pt={3}
        maxW="900px"
        mx="auto"
        w="100%"
        align="flex-start"
      >
        {/* Left card: Convert a file */}
        <PathCard
          icon={<FolderOpen size={36} />}
          title="Convert a file"
          description="Upload a geospatial file and we'll convert it to a shareable web map"
          ctaLabel="Browse files"
          onClick={handleUploadCardClick}
          expanded={uploadCardExpanded}
          faded={!uploadCardExpanded && storyExpanded}
          onCollapse={
            mode === "upload-idle" ? () => setMode("initial") : undefined
          }
        >
          <Box
            as="ul"
            mb={4}
            pl={4}
            fontSize="13px"
            color="brand.textSecondary"
            lineHeight={1.8}
            listStyleType="disc"
          >
            <li>Automatically converts your file to a cloud-optimized format</li>
            <li>Data is private to your workspace</li>
            <li>Files up to 15 GB accepted</li>
            <li>Hosted for 30 days, then automatically removed</li>
          </Box>
          {mode === "upload-idle" && (
            <FileUploader
              onFileSelected={handleFile}
              onFilesSelected={handleTemporalUpload}
              onUrlSubmitted={handleUrl}
              disabled={false}
              embedded
            />
          )}
          {(mode === "uploading" || mode === "error") && (
            <ProgressTracker
              stages={state.stages}
              filename={fileRef.current.name}
              fileSize={fileRef.current.size}
              onRetry={mode === "error" ? handleRetry : undefined}
              onReport={mode === "error" ? handleReport : undefined}
              embedded
            />
          )}
          {mode === "variable-picker" && state.scanResult && (
            <VariablePicker
              variables={state.scanResult.variables}
              onSelect={(variable, group) =>
                confirmVariable(state.scanResult!.scan_id, variable, group)
              }
            />
          )}
        </PathCard>

        {/* Right card: Build a story */}
        <PathCard
          icon={<GlobeHemisphereWest size={36} />}
          title="Build a story"
          description="Create a storytelling narrative with your data or from our public library"
          ctaLabel="Start building"
          onClick={handleStoryCardClick}
          expanded={storyExpanded}
          faded={!storyExpanded && uploadCardExpanded}
          onCollapse={() => setStoryExpanded(false)}
        >
          <Box
            as="ul"
            mb={5}
            pl={4}
            fontSize="13px"
            color="brand.textSecondary"
            lineHeight={1.8}
            listStyleType="disc"
          >
            <li>Combine maps, text, and media into a shareable narrative</li>
            <li>Add datasets from your workspace or our public library</li>
            <li>Publish a live URL anyone can view</li>
            <li>Data is hosted for 30 days — map layers may stop loading after that, but the story URL stays accessible</li>
          </Box>
          <Box
            as="button"
            onClick={() => navigate(workspacePath("/story/new"))}
            bg="brand.orange"
            color="white"
            px={5}
            py={2.5}
            borderRadius="10px"
            fontSize="14px"
            fontWeight={600}
            cursor="pointer"
            _hover={{ bg: "brand.orangeHover" }}
            transition="background 150ms ease"
          >
            Start building
          </Box>
        </PathCard>
      </Flex>

      <BugReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        jobId={state.jobId ?? undefined}
        errorMessage={state.error ?? undefined}
      />
    </Flex>
  );
}
