import { Box, Flex, Text } from "@chakra-ui/react";
import { Globe, LinkSimple } from "@phosphor-icons/react";
import type { Connection } from "../types";

const TYPE_LABELS: Record<string, string> = {
  cog: "Cloud-Optimized GeoTIFF",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ Raster Tiles",
  xyz_vector: "XYZ Vector Tiles",
};

function formatBounds(bounds: [number, number, number, number]): string {
  const fmt = (n: number) => n.toFixed(2);
  return `${fmt(bounds[0])}, ${fmt(bounds[1])} — ${fmt(bounds[2])}, ${fmt(bounds[3])}`;
}

interface ConnectionInfoCardProps {
  connection: Connection;
}

export function ConnectionInfoCard({ connection }: ConnectionInfoCardProps) {
  const typeLabel =
    TYPE_LABELS[connection.connection_type] ?? connection.connection_type;
  const tileLabel = connection.tile_type ?? "unknown";

  return (
    <Box
      bg="white"
      borderRadius="8px"
      border="1px solid"
      borderColor="brand.border"
      borderLeftWidth="3px"
      borderLeftColor="brand.orange"
      p={4}
    >
      <Text
        fontSize="11px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.textSecondary"
        fontWeight={600}
        mb={2}
      >
        Connection Details
      </Text>

      {/* Type badges */}
      <Flex align="center" gap={2} mb={3}>
        <Box bg="brand.bgSubtle" borderRadius="4px" px={2} py={0.5}>
          <Text fontSize="12px" color="brand.brown" fontWeight={600}>
            {typeLabel}
          </Text>
        </Box>
        <Box bg="brand.bgSubtle" borderRadius="4px" px={2} py={0.5}>
          <Text fontSize="12px" color="brand.textSecondary">
            {tileLabel}
          </Text>
        </Box>
      </Flex>

      {/* Metadata rows */}
      <Flex direction="column" gap={1.5}>
        {connection.bounds && (
          <Flex align="flex-start" gap={2}>
            <Globe
              size={13}
              style={{ flexShrink: 0, marginTop: 2, opacity: 0.5 }}
            />
            <Text fontSize="12px" color="brand.textSecondary" lineHeight="1.4">
              {formatBounds(connection.bounds)}
            </Text>
          </Flex>
        )}

        {connection.min_zoom != null && (
          <Text fontSize="12px" color="brand.textSecondary">
            Zoom {connection.min_zoom}–{connection.max_zoom}
          </Text>
        )}

        {connection.band_count != null && (
          <Text fontSize="12px" color="brand.textSecondary">
            {connection.band_count} band
            {connection.band_count === 1 ? "" : "s"}
          </Text>
        )}

        <Flex align="center" gap={2} mt={1}>
          <LinkSimple
            size={13}
            style={{ flexShrink: 0, opacity: 0.5 }}
          />
          <Text
            fontSize="11px"
            color="brand.textSecondary"
            wordBreak="break-all"
            lineHeight="1.4"
          >
            {connection.url}
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
}
