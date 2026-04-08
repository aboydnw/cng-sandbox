import { Box, Flex, Text } from "@chakra-ui/react";
import { ArrowRight } from "@phosphor-icons/react";
import type { Connection } from "../types";
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
};

const TYPE_SHORT: Record<string, string> = {
  cog: "COG",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ raster",
  xyz_vector: "XYZ vector",
};

interface ConnectionInfoCardProps {
  connection: Connection;
  onDetailsClick: () => void;
}

export function ConnectionInfoCard({
  connection,
  onDetailsClick,
}: ConnectionInfoCardProps) {
  const typeLabel =
    TYPE_LABELS[connection.connection_type] ?? connection.connection_type;
  const shortLabel =
    TYPE_SHORT[connection.connection_type] ?? connection.connection_type;

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
    </Box>
  );
}
