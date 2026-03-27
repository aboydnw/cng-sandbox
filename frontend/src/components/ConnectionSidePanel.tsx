import { Box, Flex, Text } from "@chakra-ui/react";
import type { Connection, ConnectionType } from "../types";

const TYPE_LABELS: Record<ConnectionType, string> = {
  cog: "COG",
  pmtiles: "PMTiles",
  xyz_raster: "XYZ Raster Tiles",
  xyz_vector: "XYZ Vector Tiles",
};

interface ConnectionSidePanelProps {
  connection: Connection;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  colormapName?: string;
  onColormapChange?: (name: string) => void;
  showColormap: boolean;
  children?: React.ReactNode;
}

export function ConnectionSidePanel({
  connection,
  opacity,
  onOpacityChange,
  colormapName,
  onColormapChange,
  showColormap,
  children,
}: ConnectionSidePanelProps) {
  return (
    <Flex direction="column" h="100%">
      <Box p={4} flexShrink={0}>
        {/* Connection info card */}
        <Box
          bg="white"
          borderRadius="8px"
          border="1px solid"
          borderColor="brand.border"
          p={3}
        >
          <Text fontWeight={600} fontSize="14px" color="gray.800" mb={1}>
            {connection.name}
          </Text>
          <Text
            fontSize="xs"
            fontWeight={600}
            textTransform="uppercase"
            color="orange.600"
            mb={2}
          >
            {TYPE_LABELS[connection.connection_type]}
          </Text>
          <Text fontSize="12px" color="gray.500" wordBreak="break-all">
            {connection.url}
          </Text>
        </Box>

        {/* Opacity control — always shown */}
        <Box mt={4}>
          <Text
            fontSize="12px"
            color="gray.500"
            fontWeight={600}
            letterSpacing="1px"
            textTransform="uppercase"
            mb={1}
          >
            Opacity
          </Text>
          <Flex align="center" gap={2}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(opacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
              style={{ flex: 1 }}
            />
            <Text fontSize="12px" color="gray.600" w="36px" textAlign="right">
              {Math.round(opacity * 100)}%
            </Text>
          </Flex>
        </Box>

        {/* Colormap control — only for COG connections */}
        {showColormap && colormapName && onColormapChange && (
          <Box mt={4}>
            <Text
              fontSize="12px"
              color="gray.500"
              fontWeight={600}
              letterSpacing="1px"
              textTransform="uppercase"
              mb={1}
            >
              Colormap
            </Text>
            {/* Reuse the existing ColormapPicker pattern from RasterSidebarControls */}
            {children}
          </Box>
        )}
      </Box>
    </Flex>
  );
}
