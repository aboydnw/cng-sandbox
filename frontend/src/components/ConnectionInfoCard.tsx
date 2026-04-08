import { Box, Flex, Text } from "@chakra-ui/react";
import { Globe, LinkSimple } from "@phosphor-icons/react";
import type { Connection } from "../types";

const TYPE_LABELS: Record<string, string> = {
  cog: "Cloud-Optimized GeoTIFF",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ Raster Tiles",
  xyz_vector: "XYZ Vector Tiles",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  cog: "A GeoTIFF restructured for the cloud. The browser requests just the pixels it needs via HTTP range requests — no server-side processing required.",
  pmtiles:
    "A single-file tile archive. The browser reads individual tiles using HTTP range requests, so there's no need for a tile server.",
  xyz_raster:
    "A traditional tile service that returns pre-rendered image tiles at each zoom level. The URL template specifies how to fetch tiles by zoom/column/row.",
  xyz_vector:
    "A tile service that returns vector data (points, lines, polygons) as Mapbox Vector Tiles. Styled and rendered in the browser.",
};

interface ConnectionInfoCardProps {
  connection: Connection;
}

export function ConnectionInfoCard({ connection }: ConnectionInfoCardProps) {
  const typeLabel =
    TYPE_LABELS[connection.connection_type] ?? connection.connection_type;
  const description = TYPE_DESCRIPTIONS[connection.connection_type] ?? null;

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

      {/* Format label */}
      <Box
        bg="brand.bgSubtle"
        borderRadius="4px"
        px={2}
        py={0.5}
        mb={2}
        display="inline-block"
      >
        <Text fontSize="12px" color="brand.brown" fontWeight={600}>
          {typeLabel}
        </Text>
      </Box>

      {/* Description */}
      {description && (
        <Text
          fontSize="12px"
          color="brand.textSecondary"
          lineHeight="1.6"
          mb={3}
        >
          {description}
        </Text>
      )}

      {/* Metadata rows */}
      <Flex direction="column" gap={1.5}>
        {connection.min_zoom != null && (
          <Flex align="center" gap={2}>
            <Globe size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
            <Text fontSize="12px" color="brand.textSecondary">
              Zoom levels {connection.min_zoom}–{connection.max_zoom}
              {connection.tile_type && ` (${connection.tile_type})`}
            </Text>
          </Flex>
        )}

        {connection.band_count != null && (
          <Text fontSize="12px" color="brand.textSecondary" pl="21px">
            {connection.band_count} band
            {connection.band_count === 1 ? "" : "s"}
          </Text>
        )}

        <Flex align="center" gap={2} mt={1}>
          <LinkSimple size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
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
