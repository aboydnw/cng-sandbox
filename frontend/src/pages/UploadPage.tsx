import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { Box, Flex } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { HomepageHero } from "../components/HomepageHero";
import { PathCard } from "../components/PathCard";
import { ProgressTracker } from "../components/ProgressTracker";
import { VariablePicker } from "../components/VariablePicker";
import { DuplicateWarning } from "../components/DuplicateWarning";
import { BugReportModal } from "../components/BugReportModal";
import { VisualizeDataCardContent } from "../components/VisualizeDataCardContent";
import { BuildStoryCardContent } from "../components/BuildStoryCardContent";
import { FolderOpen, GlobeHemisphereWest } from "@phosphor-icons/react";
import { useConversionJob } from "../hooks/useConversionJob";
import { useDuckDB } from "../hooks/useDuckDB";
import { formatBytes } from "../utils/format";
import type { UrlDetectionResult } from "../hooks/useUrlDetection";

type PageMode =
  | "initial"
  | "upload-idle"
  | "uploading"
  | "error"
  | "variable-picker"
  | "duplicate";

export default function UploadPage() {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const {
    state,
    startUpload,
    startUrlFetch,
    startTemporalUpload,
    confirmVariable,
    resetJob,
  } = useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({
    name: "",
    size: "",
  });
  const [mode, setMode] = useState<PageMode>("initial");
  const [activeCard, setActiveCard] = useState<"none" | "visualize" | "story">(
    "none"
  );
  const [reportOpen, setReportOpen] = useState(false);
  const { initialize: initializeDuckDB } = useDuckDB();

  useEffect(() => {
    initializeDuckDB().catch((err) => {
      console.warn("DuckDB initialization in background failed:", err);
    });
  }, [initializeDuckDB]);

  const isProcessing =
    state.isUploading || (state.jobId !== null && state.status !== "failed");

  // Derive mode from conversion job state
  useEffect(() => {
    if (state.duplicate) {
      setMode("duplicate");
    } else if (state.scanResult) {
      setMode("variable-picker");
    } else if (state.status === "failed") {
      setMode("error");
    } else if (isProcessing) {
      setMode("uploading");
    }
  }, [state.duplicate, state.scanResult, state.status, isProcessing]);

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

  const handleUrlSubmitted = useCallback(
    (result: UrlDetectionResult) => {
      handleUrl(result.url);
    },
    [handleUrl]
  );

  const handleRetry = useCallback(() => {
    setMode("upload-idle");
  }, []);

  const handleUploadAnother = useCallback(() => {
    resetJob();
    setMode("upload-idle");
  }, [resetJob]);

  const handleReport = useCallback(() => {
    setReportOpen(true);
  }, []);

  const visualizeCardExpanded =
    activeCard === "visualize" && mode !== "initial";
  const storyExpanded = activeCard === "story" && mode === "initial";

  const handleVisualizeCardClick = useCallback(() => {
    setActiveCard("visualize");
    setMode("upload-idle");
  }, []);

  const handleStoryCardClick = useCallback(() => {
    setActiveCard("story");
    setMode("initial");
  }, []);

  const handleCollapse = useCallback(() => {
    setActiveCard("none");
    setMode("initial");
  }, []);

  const inlineContent = (
    <>
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
          onSelect={(variable, group, temporal) =>
            confirmVariable(state.scanResult!.scan_id, variable, group, temporal)
          }
        />
      )}
      {mode === "duplicate" && state.duplicate && (
        <DuplicateWarning
          filename={state.duplicate.filename}
          onUploadAnother={handleUploadAnother}
        />
      )}
    </>
  );

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
        align={{ base: "stretch", md: "flex-start" }}
        direction={{ base: "column", md: "row" }}
      >
        {/* Left card: Visualize data */}
        <PathCard
          icon={<FolderOpen size={36} />}
          title="Visualize data"
          description="Upload a file or connect to a cloud source"
          ctaLabel="Explore data"
          onClick={handleVisualizeCardClick}
          expanded={visualizeCardExpanded}
          faded={!visualizeCardExpanded && storyExpanded}
          onCollapse={mode === "upload-idle" ? handleCollapse : undefined}
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
            <li>Upload GeoTIFF, GeoJSON, Shapefile, NetCDF, or HDF5</li>
            <li>Connect a COG, PMTiles, or XYZ tile source</li>
            <li>Data is private to your workspace</li>
            <li>Files hosted for 30 days</li>
          </Box>
          {visualizeCardExpanded && (
            <VisualizeDataCardContent
              onFileSelected={handleFile}
              onFilesSelected={handleTemporalUpload}
              onExampleClicked={(id) =>
                navigate(workspacePath(`/map/${id}`))
              }
              onUrlSubmitted={handleUrlSubmitted}
              inlineContent={inlineContent}
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
          faded={!storyExpanded && visualizeCardExpanded}
          onCollapse={storyExpanded ? handleCollapse : undefined}
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
            <li>
              Data is hosted for 30 days — map layers may stop loading after
              that, but the story URL stays accessible
            </li>
          </Box>
          <BuildStoryCardContent />
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
