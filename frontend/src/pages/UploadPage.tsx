import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { Box, Flex } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { HomepageHero } from "../components/HomepageHero";
import { PathCard } from "../components/PathCard";
import { FileUploader } from "../components/FileUploader";
import { ProgressTracker } from "../components/ProgressTracker";
import { VariablePicker } from "../components/VariablePicker";
import { DuplicateWarning } from "../components/DuplicateWarning";
import { BugReportModal } from "../components/BugReportModal";
import { InlineConnectionForm } from "../components/InlineConnectionForm";
import { RemoteConnectFlow } from "../components/RemoteConnectFlow";
import {
  FolderOpen,
  GlobeHemisphereWest,
  LinkSimple,
} from "@phosphor-icons/react";
import { useConversionJob } from "../hooks/useConversionJob";
import { formatBytes } from "../utils/format";
import type { Connection } from "../types";

type PageMode =
  | "initial"
  | "upload-idle"
  | "uploading"
  | "error"
  | "variable-picker"
  | "connect-idle"
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
    resetDuplicate,
  } = useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({
    name: "",
    size: "",
  });
  const [mode, setMode] = useState<PageMode>("initial");
  const [activeCard, setActiveCard] = useState<
    "none" | "upload" | "connect" | "story"
  >("none");
  const [reportOpen, setReportOpen] = useState(false);

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

  const handleRetry = useCallback(() => {
    setMode("upload-idle");
  }, []);

  const handleUploadAnother = useCallback(() => {
    resetDuplicate();
    setMode("upload-idle");
  }, [resetDuplicate]);

  const handleReport = useCallback(() => {
    setReportOpen(true);
  }, []);

  const uploadCardExpanded = mode !== "initial" && mode !== "connect-idle";
  const connectCardExpanded = mode === "connect-idle";
  const storyExpanded = activeCard === "story" && mode === "initial";

  const handleUploadCardClick = useCallback(() => {
    setActiveCard("upload");
    setMode("upload-idle");
  }, []);

  const handleConnectCardClick = useCallback(() => {
    setActiveCard("connect");
    setMode("connect-idle");
  }, []);

  const handleStoryCardClick = useCallback(() => {
    setActiveCard("story");
    setMode("initial");
  }, []);

  const handleCollapse = useCallback(() => {
    setActiveCard("none");
    setMode("initial");
  }, []);

  const handleConnectionCreated = useCallback(
    (conn: Connection) => {
      navigate(workspacePath(`/map/connection/${conn.id}`));
    },
    [navigate, workspacePath]
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
        {/* Left card: Convert a file */}
        <PathCard
          icon={<FolderOpen size={36} />}
          title="Convert a file"
          description="Upload a geospatial file and we'll convert it to a shareable web map"
          ctaLabel="Browse files"
          onClick={handleUploadCardClick}
          expanded={uploadCardExpanded}
          faded={!uploadCardExpanded && (connectCardExpanded || storyExpanded)}
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
            <li>
              Automatically converts your file to a cloud-optimized format
            </li>
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
              onSelect={(variable, group, temporal) =>
                confirmVariable(
                  state.scanResult!.scan_id,
                  variable,
                  group,
                  temporal
                )
              }
            />
          )}
          {mode === "duplicate" && state.duplicate && (
            <DuplicateWarning
              filename={state.duplicate.filename}
              onUploadAnother={handleUploadAnother}
            />
          )}
        </PathCard>

        {/* Middle card: Connect a source */}
        <PathCard
          icon={<LinkSimple size={36} />}
          title="Connect a source"
          description="Point to data already hosted in the cloud"
          ctaLabel="Add a URL"
          onClick={handleConnectCardClick}
          expanded={connectCardExpanded}
          faded={!connectCardExpanded && (uploadCardExpanded || storyExpanded)}
          onCollapse={connectCardExpanded ? handleCollapse : undefined}
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
            <li>COGs, PMTiles, XYZ tiles, or a page of files</li>
            <li>Auto-detects format from your URL</li>
            <li>Cloud-optimized files served directly — no upload needed</li>
          </Box>
          <RemoteConnectFlow
            onDatasetReady={(id) => navigate(workspacePath(`/map/${id}`))}
          />
          <Box
            my={4}
            borderTop="1px solid"
            borderColor="brand.border"
            position="relative"
          >
            <Box
              position="absolute"
              top="-10px"
              left="50%"
              transform="translateX(-50%)"
              bg="white"
              px={2}
              fontSize="11px"
              color="brand.textSecondary"
              whiteSpace="nowrap"
            >
              Or connect a single tile source:
            </Box>
          </Box>
          <InlineConnectionForm
            onCancel={() => {
              setActiveCard("none");
              setMode("initial");
            }}
            onCreated={handleConnectionCreated}
          />
        </PathCard>

        {/* Right card: Build a story */}
        <PathCard
          icon={<GlobeHemisphereWest size={36} />}
          title="Build a story"
          description="Create a storytelling narrative with your data or from our public library"
          ctaLabel="Start building"
          onClick={handleStoryCardClick}
          expanded={storyExpanded}
          faded={!storyExpanded && (uploadCardExpanded || connectCardExpanded)}
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
