import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import { listColormaps } from "../lib/maptool";

const COLORMAP_NAMES = listColormaps();

interface BandInfo {
  name: string;
  index: number;
}

interface RasterSidebarControlsProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  colormapName: string;
  onColormapChange: (colormap: string) => void;
  showColormap: boolean;
  bands?: BandInfo[];
  hasRgb?: boolean;
  selectedBand: "rgb" | number;
  onBandChange: (band: "rgb" | number) => void;
  showBands: boolean;
  canClientRender?: boolean;
  renderMode?: "server" | "client";
  onRenderModeChange?: (mode: "server" | "client") => void;
}

export function RasterSidebarControls({
  opacity,
  onOpacityChange,
  colormapName,
  onColormapChange,
  showColormap,
  bands,
  hasRgb,
  selectedBand,
  onBandChange,
  showBands,
  canClientRender,
  renderMode,
  onRenderModeChange,
}: RasterSidebarControlsProps) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase" letterSpacing="wide" mb={3}>
        Visualization
      </Text>

      {/* Band selector */}
      {showBands && bands && bands.length > 0 && (
        <Box mb={3}>
          <Text fontSize="xs" color="gray.400" mb={1}>Band</Text>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={String(selectedBand)}
              onChange={(e) => {
                const val = e.target.value;
                onBandChange(val === "rgb" ? "rgb" : Number(val));
              }}
            >
              {hasRgb && <option value="rgb">RGB</option>}
              {bands.map((b) => (
                <option key={b.index} value={b.index}>{b.name}</option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Box>
      )}

      {/* Colormap selector */}
      {showColormap && (
        <Box mb={3}>
          <Text fontSize="xs" color="gray.400" mb={1}>Colormap</Text>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={colormapName}
              onChange={(e) => onColormapChange(e.target.value)}
            >
              {COLORMAP_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Box>
      )}

      {/* Opacity slider */}
      <Box mb={3}>
        <Flex justify="space-between" mb={1}>
          <Text fontSize="xs" color="gray.400">Opacity</Text>
          <Text fontSize="xs" color="gray.400">{Math.round(opacity * 100)}%</Text>
        </Flex>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </Box>

      {/* Client-side rendering toggle */}
      {canClientRender && onRenderModeChange && (
        <Box mb={3}>
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontSize="xs" color="gray.400">Client-side rendering</Text>
              <Text fontSize="2xs" color="gray.500">Reads COG directly in browser</Text>
            </Box>
            <Box
              as="button"
              w="40px"
              h="22px"
              borderRadius="full"
              bg={renderMode === "client" ? "brand.orange" : "gray.600"}
              position="relative"
              cursor="pointer"
              onClick={() => onRenderModeChange(renderMode === "client" ? "server" : "client")}
            >
              <Box
                position="absolute"
                top="2px"
                left={renderMode === "client" ? "20px" : "2px"}
                w="18px"
                h="18px"
                borderRadius="full"
                bg="white"
                transition="left 0.15s"
              />
            </Box>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
