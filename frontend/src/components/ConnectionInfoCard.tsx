import { useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { ArrowRight } from "@phosphor-icons/react";
import type { Connection, GeoZarrAttrs } from "../types";
import { connectionsApi } from "../lib/api";
import { ZarrGeoZarrAttrsFields } from "./ZarrGeoZarrAttrsFields";
import {
  transition,
  cardHover,
  cardActive,
  focusRing,
} from "../lib/interactionStyles";

const TYPE_LABELS: Record<string, string> = {
  cog: "Cloud-Optimized GeoTIFF",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ Raster Tiles",
  xyz_vector: "XYZ Vector Tiles",
  geoparquet: "Remote GeoParquet",
  zarr: "Zarr",
};

const TYPE_SHORT: Record<string, string> = {
  cog: "COG",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ raster",
  xyz_vector: "XYZ vector",
  geoparquet: "GeoParquet",
};

interface ConnectionInfoCardProps {
  connection: Connection;
  onDetailsClick: () => void;
  onConnectionUpdate?: (next: Connection) => void;
}

export function ConnectionInfoCard({
  connection,
  onDetailsClick,
  onConnectionUpdate,
}: ConnectionInfoCardProps) {
  const typeLabel =
    TYPE_LABELS[connection.connection_type] ?? connection.connection_type;
  const shortLabel =
    TYPE_SHORT[connection.connection_type] ?? connection.connection_type;
  const canEditOverride =
    connection.connection_type === "zarr" && !connection.is_example;
  const [currentAttrs, setCurrentAttrs] = useState<GeoZarrAttrs | null>(
    connection.geozarr_attrs
  );
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [pendingAttrs, setPendingAttrs] = useState<GeoZarrAttrs | null>(
    currentAttrs
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSaveOverride() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await connectionsApi.setGeoZarrAttrs(
        connection.id,
        pendingAttrs as Record<string, unknown> | null
      );
      setCurrentAttrs(updated.geozarr_attrs);
      onConnectionUpdate?.(updated);
      setOverrideOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save override");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box
      bg="white"
      borderRadius="8px"
      border="1px solid"
      borderColor="brand.border"
      borderLeftWidth="3px"
      borderLeftColor="brand.orange"
      p={4}
      cursor="pointer"
      onClick={onDetailsClick}
      transition={transition(200)}
      _hover={{ ...cardHover, borderColor: "brand.orange" }}
      _active={cardActive}
      _focusVisible={focusRing}
    >
      <Text
        fontSize="11px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.textSecondary"
        fontWeight={600}
        mb={2}
      >
        Connection details
      </Text>

      {/* Format badge */}
      <Flex align="center" gap={2} mb={3}>
        <Box bg="brand.bgSubtle" borderRadius="4px" px={2} py={0.5}>
          <Text fontSize="12px" color="brand.brown" fontWeight={600}>
            {typeLabel}
          </Text>
        </Box>
        {connection.tile_type && (
          <Box bg="brand.bgSubtle" borderRadius="4px" px={2} py={0.5}>
            <Text fontSize="12px" color="brand.textSecondary">
              {connection.tile_type}
            </Text>
          </Box>
        )}
      </Flex>

      {/* Summary line */}
      <Text fontSize="13px" color="brand.brown" fontWeight={700} mb={1}>
        {shortLabel} connection
        {connection.min_zoom != null &&
          `, zoom ${connection.min_zoom}–${connection.max_zoom}`}
      </Text>
      {connection.band_count != null && (
        <Text fontSize="11px" color="brand.textSecondary">
          {connection.band_count} band
          {connection.band_count === 1 ? "" : "s"}
        </Text>
      )}

      {/* CTA */}
      <Flex align="center" gap={1.5} mt={3}>
        <Text fontSize="12px" color="brand.orange" fontWeight={600}>
          Details
        </Text>
        <ArrowRight
          size={12}
          weight="bold"
          color="var(--chakra-colors-brand-orange)"
        />
      </Flex>

      {canEditOverride && (
        <Box mt={3} onClick={(e) => e.stopPropagation()}>
          {!overrideOpen ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setOverrideOpen(true);
                setPendingAttrs(currentAttrs);
                setSaveError(null);
              }}
            >
              {currentAttrs ? "Edit" : "Add"} GeoZarr override
            </Button>
          ) : (
            <Box>
              <ZarrGeoZarrAttrsFields
                initialAttrs={currentAttrs}
                storeHasGeoZarrAttrs={false}
                onChange={setPendingAttrs}
              />
              {saveError && (
                <Text fontSize="12px" color="red.500" mt={2}>
                  {saveError}
                </Text>
              )}
              <Flex gap={2} mt={2}>
                <Button
                  size="xs"
                  bg="brand.orange"
                  color="white"
                  disabled={saving}
                  onClick={handleSaveOverride}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setOverrideOpen(false);
                    setSaveError(null);
                  }}
                >
                  Cancel
                </Button>
              </Flex>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
