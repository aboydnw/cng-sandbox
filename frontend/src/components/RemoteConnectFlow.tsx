import { useState, useCallback, useEffect } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";
import {
  MagnifyingGlass,
  CloudArrowDown,
  SpinnerGap,
  Stack,
  SquaresFour,
  Warning,
} from "@phosphor-icons/react";
import { useRemoteConnect } from "../hooks/useRemoteConnect";
import { transition } from "../lib/interactionStyles";
import { useGeoParquetValidation } from "../hooks/useGeoParquetValidation";
import { GeoParquetPreviewModal } from "./GeoParquetPreviewModal";
import { useDuckDB } from "../hooks/useDuckDB";
import { useGeoParquetQuery } from "../hooks/useGeoParquetQuery";
import { workspaceFetch } from "../lib/api";

interface RemoteConnectFlowProps {
  onDatasetReady: (datasetId: string) => void;
}

export function RemoteConnectFlow({ onDatasetReady }: RemoteConnectFlowProps) {
  const { state, discover, startIngestion } = useRemoteConnect();
  const [inputUrl, setInputUrl] = useState("");

  // GeoParquet validation modal state
  const { conn, initialize: initializeDuckDB } = useDuckDB();
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const {
    validating,
    valid,
    error,
    geometryInfo,
    sizeBytes,
    sizeSource,
    renderPath,
    validate: validateGeoParquet,
  } = useGeoParquetValidation(conn, previewUrl);

  const { result: queryResult } = useGeoParquetQuery(conn, previewUrl);

  useEffect(() => {
    if (state.phase === "idle" && state.datasetId) {
      onDatasetReady(state.datasetId);
    }
  }, [state.phase, state.datasetId, onDatasetReady]);

  const isGeoParquetUrl = (url: string): boolean => {
    return url.toLowerCase().endsWith(".parquet");
  };

  const handleScan = useCallback(async () => {
    if (!inputUrl.trim()) return;
    const trimmedUrl = inputUrl.trim();

    // If the URL points to a single GeoParquet file, validate it before connecting
    if (isGeoParquetUrl(trimmedUrl)) {
      setPreviewUrl(trimmedUrl);
      setShowPreview(true);
      // Ensure DuckDB is initialized and use the freshly-returned conn
      // to avoid racing with React state updates.
      let activeConn = conn;
      if (!activeConn) {
        try {
          const result = await initializeDuckDB();
          activeConn = result?.conn ?? null;
        } catch (e) {
          console.error("DuckDB initialization failed:", e);
          // Error will be displayed in modal via useGeoParquetValidation hook
          return;
        }
      }
      await validateGeoParquet(activeConn);
      return; // Don't proceed to discovery
    }

    // Otherwise, use the existing discovery flow
    discover(trimmedUrl);
  }, [inputUrl, conn, discover, initializeDuckDB, validateGeoParquet]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleScan();
    },
    [handleScan]
  );

  const handleConfirmConnection = useCallback(async () => {
    if (!valid || !previewUrl) return;

    setShowPreview(false);
    setConnectionError(null);

    try {
      const response = await workspaceFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: previewUrl,
          connection_type: "geoparquet",
          name: previewUrl.split("/").pop() || "Untitled",
          render_path: renderPath,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create connection");
      }

      const data = await response.json();
      if (!data.id) {
        throw new Error("No connection ID returned");
      }
      onDatasetReady(data.id);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      console.error("Connection creation failed:", e);
      setConnectionError(`Connection creation failed: ${errorMsg}`);
      setShowPreview(true);
    }
  }, [valid, previewUrl, renderPath, onDatasetReady]);

  if (state.phase === "discovering") {
    return (
      <Flex align="center" gap={2} color="brand.textSecondary" py={2}>
        <SpinnerGap size={16} className="animate-spin" />
        <Text fontSize="13px">Scanning for files...</Text>
      </Flex>
    );
  }

  if (state.phase === "ingesting") {
    return (
      <Flex align="center" gap={2} color="brand.textSecondary" py={2}>
        <SpinnerGap size={16} className="animate-spin" />
        <Text fontSize="13px">
          Ingesting {state.discoverResult?.count ?? ""} files...
        </Text>
      </Flex>
    );
  }

  if (state.phase === "preview" && state.discoverResult) {
    const { count, dominant_extension } = state.discoverResult;
    return (
      <Box>
        <Box
          bg="brand.bgSubtle"
          border="1px solid"
          borderColor="brand.border"
          borderRadius="8px"
          px={3}
          py={2.5}
          mb={3}
          fontSize="13px"
        >
          <Flex align="center" gap={2} mb={1}>
            <CloudArrowDown
              size={14}
              color="var(--chakra-colors-brand-orange)"
            />
            <Text fontWeight={600} color="brand.brown">
              Found {count} {dominant_extension} file{count !== 1 ? "s" : ""}
            </Text>
          </Flex>
          <Text color="brand.textSecondary" fontSize="12px">
            Choose how to load them as a dataset
          </Text>
        </Box>
        <Flex gap={2}>
          <Button
            size="sm"
            flex={1}
            bg="brand.orange"
            color="white"
            _hover={{ bg: "brand.orangeHover" }}
            transition={transition()}
            onClick={() => startIngestion("mosaic")}
          >
            <SquaresFour size={14} />
            Mosaic
          </Button>
          <Button
            size="sm"
            flex={1}
            bg="brand.orange"
            color="white"
            _hover={{ bg: "brand.orangeHover" }}
            transition={transition()}
            onClick={() => startIngestion("temporal")}
          >
            <Stack size={14} />
            Temporal Stack
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box>
      {state.phase === "error" && state.error && (
        <Flex
          align="center"
          gap={2}
          mb={3}
          p={2.5}
          bg="red.50"
          border="1px solid"
          borderColor="red.200"
          borderRadius="6px"
          color="red.600"
          fontSize="12px"
        >
          <Warning size={14} style={{ flexShrink: 0 }} />
          <Text>{state.error}</Text>
        </Flex>
      )}
      <Flex gap={2}>
        <Input
          size="sm"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com/data/"
          flex={1}
          fontSize="13px"
        />
        <Button
          size="sm"
          bg="brand.orange"
          color="white"
          _hover={{ bg: "brand.orangeHover" }}
          transition={transition()}
          onClick={handleScan}
          disabled={!inputUrl.trim()}
          px={3}
        >
          <MagnifyingGlass size={14} />
          Scan
        </Button>
      </Flex>

      <GeoParquetPreviewModal
        open={showPreview}
        filename={previewUrl.split("/").pop() || "data.parquet"}
        validating={validating}
        valid={valid}
        error={error || connectionError}
        geometryInfo={geometryInfo}
        schema={queryResult.columnStats}
        samples={queryResult.table}
        sizeBytes={sizeBytes}
        sizeSource={sizeSource}
        renderPath={renderPath}
        onConfirm={handleConfirmConnection}
        onCancel={() => {
          setShowPreview(false);
          setConnectionError(null);
        }}
      />
    </Box>
  );
}
