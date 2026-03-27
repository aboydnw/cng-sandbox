import { useState, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Text,
} from "@chakra-ui/react";
import { X as XIcon, Link as LinkIcon, SpinnerGap } from "@phosphor-icons/react";
import { detectConnectionType, extractNameFromUrl, probePMTiles, probeCOG } from "../lib/connections";
import type { ProbeMetadata } from "../lib/connections";
import { connectionsApi } from "../lib/api";
import type { ConnectionType, Connection } from "../types";

const TYPE_LABELS: Record<ConnectionType, string> = {
  cog: "COG",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ Raster Tiles",
  xyz_vector: "XYZ Vector Tiles",
};

const ALL_TYPES: ConnectionType[] = ["cog", "pmtiles", "xyz_raster", "xyz_vector"];

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (connection: Connection) => void;
}

export function ConnectionModal({ isOpen, onClose, onCreated }: ConnectionModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [connectionType, setConnectionType] = useState<ConnectionType | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeMetadata, setProbeMetadata] = useState<ProbeMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect type and name when URL changes
  const handleUrlBlur = useCallback(async () => {
    if (!url) return;
    const detected = detectConnectionType(url);
    if (detected) {
      setConnectionType(detected);
      setAutoDetected(true);
    }
    if (!name) {
      setName(extractNameFromUrl(url));
    }
    // Probe metadata for PMTiles and COGs
    if (detected === "pmtiles" || detected === "cog") {
      setProbing(true);
      try {
        const metadata = detected === "pmtiles"
          ? await probePMTiles(url)
          : await probeCOG(url);
        setProbeMetadata(metadata);
      } catch {
        setProbeMetadata(null);
      } finally {
        setProbing(false);
      }
    } else {
      setProbeMetadata(null);
    }
  }, [url, name]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUrl("");
      setName("");
      setConnectionType(null);
      setAutoDetected(false);
      setSaving(false);
      setProbing(false);
      setProbeMetadata(null);
      setError(null);
    }
  }, [isOpen]);

  async function handleSave() {
    if (!url || !name || !connectionType) return;
    setSaving(true);
    setError(null);
    try {
      const connection = await connectionsApi.create({
        name,
        url,
        connection_type: connectionType,
        ...(probeMetadata && {
          tile_type: probeMetadata.tileType,
          bounds: probeMetadata.bounds ?? undefined,
          min_zoom: probeMetadata.minZoom ?? undefined,
          max_zoom: probeMetadata.maxZoom ?? undefined,
          band_count: probeMetadata.bandCount ?? undefined,
          rescale: probeMetadata.rescale ? `${probeMetadata.rescale[0]},${probeMetadata.rescale[1]}` : undefined,
        }),
        ...(connectionType === "pmtiles" && !probeMetadata && { tile_type: "vector" }),
        ...(connectionType === "cog" && !probeMetadata && { tile_type: "raster" }),
        ...(connectionType === "xyz_raster" && { tile_type: "raster" }),
        ...(connectionType === "xyz_vector" && { tile_type: "vector" }),
      });
      onCreated(connection);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create connection");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const canSave = !!url && !!name && !!connectionType && !saving && !probing;

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {/* Backdrop */}
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.500"
        onClick={onClose}
      />

      {/* Modal */}
      <Box
        position="relative"
        bg="white"
        borderRadius="12px"
        shadow="xl"
        w="480px"
        maxW="90vw"
        p={6}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <Flex align="center" gap={2}>
            <LinkIcon size={20} weight="bold" />
            <Heading size="md">Add connection</Heading>
          </Flex>
          <Box as="button" onClick={onClose} p={1} cursor="pointer">
            <XIcon size={18} />
          </Box>
        </Flex>

        <Flex direction="column" gap={4}>
          {/* URL input */}
          <Box>
            <Text fontSize="13px" fontWeight={600} color="gray.600" mb={1}>
              URL
            </Text>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://bucket.s3.amazonaws.com/scene.tif"
              size="sm"
            />
          </Box>

          {/* Name input */}
          <Box>
            <Text fontSize="13px" fontWeight={600} color="gray.600" mb={1}>
              Name
            </Text>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My satellite imagery"
              size="sm"
            />
          </Box>

          {/* Type selector */}
          <Box>
            <Text fontSize="13px" fontWeight={600} color="gray.600" mb={1}>
              Type
              {autoDetected && (
                <Text as="span" color="green.600" fontWeight={400} ml={2}>
                  (auto-detected)
                </Text>
              )}
            </Text>
            <select
              value={connectionType ?? ""}
              onChange={(e) => {
                setConnectionType(e.target.value as ConnectionType);
                setAutoDetected(false);
              }}
              style={{
                width: "100%",
                fontSize: "14px",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
              }}
            >
              <option value="">Select type...</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Box>

          {probing && (
            <Flex align="center" gap={2}>
              <SpinnerGap
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
              <Text fontSize="13px" color="gray.500">
                Reading metadata...
              </Text>
            </Flex>
          )}

          {probeMetadata && !probing && (
            <Text fontSize="13px" color="green.600">
              Detected {probeMetadata.tileType} data
              {probeMetadata.bandCount != null && ` (${probeMetadata.bandCount} band${probeMetadata.bandCount === 1 ? "" : "s"})`}
              {probeMetadata.bounds && " with bounds"}
              {probeMetadata.minZoom != null && `, zoom ${probeMetadata.minZoom}–${probeMetadata.maxZoom}`}
            </Text>
          )}

          {error && (
            <Text fontSize="13px" color="red.500">
              {error}
            </Text>
          )}

          {/* Actions */}
          <Flex justify="flex-end" gap={2} mt={2}>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              bg="brand.orange"
              color="white"
              disabled={!canSave}
              onClick={handleSave}
            >
              {saving ? (
                <SpinnerGap
                  size={16}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                "Save"
              )}
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
