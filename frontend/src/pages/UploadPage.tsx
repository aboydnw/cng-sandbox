import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { HomepageHero } from "../components/HomepageHero";
import { PathCard } from "../components/PathCard";
import { ProgressTracker } from "../components/ProgressTracker";
import { VariablePicker } from "../components/VariablePicker";
import { ColumnPicker } from "../components/ColumnPicker";
import { DuplicateWarning } from "../components/DuplicateWarning";
import { BugReportModal } from "../components/BugReportModal";
import { VisualizeDataCardContent } from "../components/VisualizeDataCardContent";
import { InlineConnectionForm } from "../components/InlineConnectionForm";
import { GeoParquetPreviewModal } from "../components/GeoParquetPreviewModal";
import { FolderOpen } from "@phosphor-icons/react";
import { useConversionJob } from "../hooks/useConversionJob";
import { useDuckDB } from "../hooks/useDuckDB";
import { useGeoParquetValidation } from "../hooks/useGeoParquetValidation";
import { useGeoParquetQuery } from "../hooks/useGeoParquetQuery";
import { formatBytes } from "../utils/format";
import { workspaceFetch } from "../lib/api";
import {
  extractNameFromUrl,
  registerPMTilesConnection,
  registerCogConnection,
} from "../lib/connections";
import { pickRenderPath } from "../lib/geoparquet/pickRenderPath";
import type { UrlDetectionResult } from "../hooks/useUrlDetection";
import type { Connection } from "../types";

type PageMode =
  | "initial"
  | "upload-idle"
  | "uploading"
  | "error"
  | "variable-picker"
  | "duplicate"
  | "xyz-picker"
  | "registering";

export default function UploadPage() {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const {
    state,
    startUpload,
    startUrlFetch,
    startTemporalUpload,
    confirmVariable,
    confirmColumns,
    resetJob,
  } = useConversionJob();
  const fileRef = useRef<{ name: string; size: string }>({
    name: "",
    size: "",
  });
  const [mode, setMode] = useState<PageMode>("initial");
  const [reportOpen, setReportOpen] = useState(false);
  const [xyzPickerUrl, setXyzPickerUrl] = useState<string | null>(null);
  const [parquetPreviewUrl, setParquetPreviewUrl] = useState<string | null>(
    null
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { conn: duckConn, initialize: initializeDuckDB } = useDuckDB();
  const {
    validating,
    valid,
    error: validationError,
    geometryInfo,
    sizeBytes,
    sizeSource,
    validate: validateGeoParquet,
  } = useGeoParquetValidation(duckConn, parquetPreviewUrl ?? "");
  const { result: parquetQueryResult } = useGeoParquetQuery(
    duckConn,
    parquetPreviewUrl ?? ""
  );
  const effectiveRenderPath = pickRenderPath({
    sizeBytes,
    featureCount:
      parquetQueryResult.totalCount > 0 ? parquetQueryResult.totalCount : null,
  });

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

  const handleConnectionCreated = useCallback(
    (conn: Connection) => {
      navigate(workspacePath(`/map/connection/${conn.id}`));
    },
    [navigate, workspacePath]
  );

  const handleParquetConfirm = useCallback(async () => {
    if (!valid || !parquetPreviewUrl) return;
    setMode("registering");
    setConnectionError(null);
    try {
      const response = await workspaceFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: parquetPreviewUrl,
          connection_type: "geoparquet",
          name: extractNameFromUrl(parquetPreviewUrl) || "Untitled",
          render_path: effectiveRenderPath,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create connection");
      }
      const data = await response.json();
      if (!data.id) {
        throw new Error("No connection ID returned");
      }
      setParquetPreviewUrl(null);
      navigate(workspacePath(`/map/connection/${data.id}`));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setConnectionError(`Connection creation failed: ${msg}`);
      setMode("upload-idle");
    }
  }, [valid, parquetPreviewUrl, effectiveRenderPath, navigate, workspacePath]);

  const handleUrlSubmitted = useCallback(
    async (result: UrlDetectionResult) => {
      setConnectionError(null);
      switch (result.route) {
        case "discover":
          navigate(
            workspacePath("/discover") +
              "?url=" +
              encodeURIComponent(result.url)
          );
          return;
        case "convert-url":
          handleUrl(result.url);
          return;
        case "xyz":
          setXyzPickerUrl(result.url);
          setMode("xyz-picker");
          return;
        case "parquet": {
          let activeConn = duckConn;
          if (!activeConn) {
            try {
              const dbResult = await initializeDuckDB();
              activeConn = dbResult?.conn ?? null;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              setConnectionError(
                `Failed to initialize database for parquet preview: ${msg}`
              );
              setMode("upload-idle");
              return;
            }
          }
          setParquetPreviewUrl(result.url);
          await validateGeoParquet(activeConn, result.url);
          return;
        }
        case "pmtiles":
          setMode("registering");
          try {
            const conn = await registerPMTilesConnection(result.url);
            handleConnectionCreated(conn);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setConnectionError(`Failed to register PMTiles: ${msg}`);
            setMode("upload-idle");
          }
          return;
        case "cog":
          setMode("registering");
          try {
            const conn = await registerCogConnection(result.url);
            handleConnectionCreated(conn);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setConnectionError(`Failed to register COG: ${msg}`);
            setMode("upload-idle");
          }
          return;
      }
    },
    [
      handleUrl,
      navigate,
      workspacePath,
      handleConnectionCreated,
      duckConn,
      initializeDuckDB,
      validateGeoParquet,
    ]
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

  const visualizeCardExpanded = mode !== "initial";

  const handleVisualizeCardClick = useCallback(() => {
    setMode("upload-idle");
  }, []);

  const handleCollapse = useCallback(() => {
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
      {mode === "variable-picker" &&
        state.scanResult &&
        (state.scanResult.kind === "columns" ? (
          <ColumnPicker
            columns={state.scanResult.columns ?? []}
            onConfirm={(mapping) =>
              confirmColumns(state.scanResult!.scan_id, mapping)
            }
          />
        ) : (
          <VariablePicker
            variables={state.scanResult.variables ?? []}
            onSelect={(variable, group, temporal) =>
              confirmVariable(
                state.scanResult!.scan_id,
                variable,
                group,
                temporal
              )
            }
          />
        ))}
      {mode === "duplicate" && state.duplicate && (
        <DuplicateWarning
          filename={state.duplicate.filename}
          onUploadAnother={handleUploadAnother}
        />
      )}
      {mode === "registering" && (
        <Text fontSize="sm" color="brand.textSecondary" mt={3}>
          Registering connection…
        </Text>
      )}
      {connectionError && (
        <Text fontSize="sm" color="red.500" mt={3}>
          {connectionError}
        </Text>
      )}
    </>
  );

  return (
    <Flex direction="column" minH="100vh" bg="bg">
      <Header />
      <Box as="main" id="main-content">
        <HomepageHero />

        <Flex
          gap={5}
          px={8}
          pb={4}
          pt={3}
          maxW="560px"
          mx="auto"
          w="100%"
          direction="column"
        >
          <PathCard
            icon={<FolderOpen size={36} />}
            title="Create a map"
            description="Upload a file or connect to a cloud source"
            ctaLabel="Add data"
            onClick={handleVisualizeCardClick}
            expanded={visualizeCardExpanded}
            faded={false}
            onCollapse={mode === "upload-idle" ? handleCollapse : undefined}
          >
            <Text mb={4} fontSize="sm" color="fg.muted" lineHeight="1.6">
              Upload a local file to convert it, or add a URL to connect cloud
              data without downloading it first. Your workspace stays private;
              uploaded files are hosted for 30 days.
            </Text>
            {visualizeCardExpanded && (
              <>
                <Box display={mode === "xyz-picker" ? "none" : "block"}>
                  <VisualizeDataCardContent
                    onFileSelected={handleFile}
                    onFilesSelected={handleTemporalUpload}
                    onExampleClicked={(id) =>
                      navigate(workspacePath(`/map/${id}`))
                    }
                    onUrlSubmitted={handleUrlSubmitted}
                    inlineContent={inlineContent}
                  />
                </Box>
                {mode === "xyz-picker" && xyzPickerUrl && (
                  <InlineConnectionForm
                    prefilledUrl={xyzPickerUrl}
                    onCancel={() => {
                      setXyzPickerUrl(null);
                      setMode("upload-idle");
                    }}
                    onCreated={handleConnectionCreated}
                  />
                )}
              </>
            )}
          </PathCard>
        </Flex>
      </Box>

      <BugReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        jobId={state.jobId ?? undefined}
        errorMessage={state.error ?? undefined}
      />

      <GeoParquetPreviewModal
        open={parquetPreviewUrl !== null}
        filename={
          (parquetPreviewUrl && extractNameFromUrl(parquetPreviewUrl)) ||
          "data.parquet"
        }
        validating={validating}
        valid={valid}
        error={validationError || connectionError}
        geometryInfo={geometryInfo}
        schema={parquetQueryResult.columnStats}
        samples={parquetQueryResult.table}
        sizeBytes={sizeBytes}
        sizeSource={sizeSource}
        renderPath={effectiveRenderPath}
        onConfirm={handleParquetConfirm}
        onCancel={() => {
          setParquetPreviewUrl(null);
          setConnectionError(null);
        }}
      />

      <Footer />
    </Flex>
  );
}
