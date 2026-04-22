import { useState, useCallback, useEffect, useRef } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";
import { ArrowLeft, Link as LinkIcon, SpinnerGap } from "@phosphor-icons/react";
import {
  detectConnectionType,
  extractNameFromUrl,
  probePMTiles,
  probeCOG,
} from "../lib/connections";
import type { ProbeMetadata } from "../lib/connections";
import { connectionsApi } from "../lib/api";
import type { ConnectionType, Connection } from "../types";
import { transition } from "../lib/interactionStyles";

const TYPE_LABELS: Record<ConnectionType, string> = {
  cog: "COG",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ Raster Tiles",
  xyz_vector: "XYZ Vector Tiles",
  geoparquet: "Remote GeoParquet",
};

const ALL_TYPES: ConnectionType[] = [
  "cog",
  "pmtiles",
  "xyz_raster",
  "xyz_vector",
];

interface InlineConnectionFormProps {
  onCancel: () => void;
  onCreated: (connection: Connection) => void;
  prefilledUrl?: string;
}

export function InlineConnectionForm({
  onCancel,
  onCreated,
  prefilledUrl,
}: InlineConnectionFormProps) {
  const [url, setUrl] = useState(prefilledUrl ?? "");
  const [name, setName] = useState("");
  const [connectionType, setConnectionType] = useState<ConnectionType | null>(
    null
  );
  const [autoDetected, setAutoDetected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeMetadata, setProbeMetadata] = useState<ProbeMetadata | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [probeWarning, setProbeWarning] = useState<string | null>(null);

  const handleUrlBlur = useCallback(async () => {
    if (!url.trim()) return;
    setError(null);
    setProbeMetadata(null);
    setProbeWarning(null);

    const detected = detectConnectionType(url);
    if (detected) {
      setConnectionType(detected);
      setAutoDetected(true);
    }

    const extractedName = extractNameFromUrl(url);
    if (extractedName && !name) {
      setName(extractedName);
    }

    if (detected === "pmtiles" || detected === "cog") {
      setProbing(true);
      try {
        const metadata =
          detected === "pmtiles"
            ? await probePMTiles(url)
            : await probeCOG(url);
        setProbeMetadata(metadata);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setProbeWarning(
          detected === "pmtiles"
            ? `Could not read PMTiles header — file may not be valid PMTiles v3. ${msg}`
            : `Could not read COG metadata. ${msg}`
        );
      } finally {
        setProbing(false);
      }
    }
  }, [url, name]);

  const autoProbedRef = useRef(false);
  useEffect(() => {
    if (!prefilledUrl || autoProbedRef.current) return;
    autoProbedRef.current = true;
    handleUrlBlur().catch(() => {});
  }, [prefilledUrl, handleUrlBlur]);

  const handleSave = useCallback(async () => {
    if (!url.trim() || !connectionType) return;
    setSaving(true);
    setError(null);

    try {
      const conn = await connectionsApi.create({
        name: name || extractNameFromUrl(url) || "Untitled",
        url,
        connection_type: connectionType,
        bounds: probeMetadata?.bounds ?? null,
        min_zoom: probeMetadata?.minZoom ?? null,
        max_zoom: probeMetadata?.maxZoom ?? null,
        tile_type:
          probeMetadata?.tileType ??
          (connectionType === "pmtiles"
            ? "vector"
            : connectionType === "cog" || connectionType === "xyz_raster"
              ? "raster"
              : connectionType === "xyz_vector"
                ? "vector"
                : null),
        band_count: probeMetadata?.bandCount ?? null,
        rescale: probeMetadata?.rescale
          ? probeMetadata.rescale.join(",")
          : null,
      });
      onCreated(conn);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save connection");
    } finally {
      setSaving(false);
    }
  }, [url, name, connectionType, probeMetadata, onCreated]);

  const canSave = url.trim() && connectionType && !saving && !probing;

  return (
    <Box>
      {/* Header */}
      <Flex align="center" gap={2} mb={4}>
        <Flex
          as="button"
          onClick={onCancel}
          align="center"
          gap={1}
          color="whiteAlpha.600"
          _hover={{ color: "white" }}
          cursor="pointer"
          {...transition}
        >
          <ArrowLeft size={14} />
          <Text fontSize="sm">Back</Text>
        </Flex>
      </Flex>

      <Text fontSize="md" fontWeight={600} mb={3}>
        Add Connection
      </Text>

      {/* URL input */}
      <Box mb={3}>
        <Text fontSize="xs" color="whiteAlpha.600" mb={1}>
          URL
        </Text>
        <Flex align="center" gap={2}>
          <LinkIcon size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
          <Input
            size="sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://example.com/tiles.pmtiles"
          />
        </Flex>
      </Box>

      {/* Name input */}
      <Box mb={3}>
        <Text fontSize="xs" color="whiteAlpha.600" mb={1}>
          Name
        </Text>
        <Input
          size="sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Layer name"
        />
      </Box>

      {/* Type selector */}
      <Box mb={3}>
        <Text fontSize="xs" color="whiteAlpha.600" mb={1}>
          Type{autoDetected ? " (auto-detected)" : ""}
        </Text>
        <Flex gap={1} flexWrap="wrap">
          {ALL_TYPES.map((t) => (
            <Button
              key={t}
              size="xs"
              variant={connectionType === t ? "solid" : "outline"}
              colorPalette={connectionType === t ? "orange" : "gray"}
              onClick={() => {
                setConnectionType(t);
                setAutoDetected(false);
                setProbeMetadata(null);
              }}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </Flex>
      </Box>

      {/* Probe status */}
      {probing && (
        <Flex align="center" gap={2} mb={3} color="whiteAlpha.600">
          <SpinnerGap size={14} className="animate-spin" />
          <Text fontSize="xs">Detecting metadata...</Text>
        </Flex>
      )}

      {probeMetadata && !probing && (
        <Box mb={3} fontSize="xs" color="whiteAlpha.500">
          {probeMetadata.bounds && <Text>Bounds detected</Text>}
          {probeMetadata.bandCount && (
            <Text>{probeMetadata.bandCount} band(s)</Text>
          )}
          {probeMetadata.minZoom != null && (
            <Text>
              Zoom: {probeMetadata.minZoom}–{probeMetadata.maxZoom}
            </Text>
          )}
        </Box>
      )}

      {/* Probe warning */}
      {probeWarning && !probing && (
        <Text fontSize="xs" color="yellow.400" mb={3}>
          {probeWarning}
        </Text>
      )}

      {/* Error */}
      {error && (
        <Text fontSize="xs" color="red.400" mb={3}>
          {error}
        </Text>
      )}

      {/* Save button */}
      <Button
        size="sm"
        colorPalette="orange"
        onClick={handleSave}
        disabled={!canSave}
        w="100%"
      >
        {saving ? "Saving..." : "Save Connection"}
      </Button>
    </Box>
  );
}
