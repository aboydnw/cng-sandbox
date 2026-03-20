import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import { listColormaps } from "../lib/maptool";
import { BRAND_COLOR } from "./MapShell";

const COLORMAP_NAMES = listColormaps();

interface BandInfo {
  name: string;
  index: number;
}

interface RasterControlsProps {
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
}

export function RasterControls({
  opacity,
  onOpacityChange,
  colormapName,
  onColormapChange,
  showColormap,
  bands = [],
  hasRgb = false,
  selectedBand,
  onBandChange,
  showBands,
}: RasterControlsProps) {
  return (
    <Flex
      position="absolute"
      bottom={3}
      right={3}
      bg="white"
      borderRadius="6px"
      shadow="sm"
      p={2}
      direction="column"
      gap={2}
    >
      {showBands && (
        <Box>
          <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
            Band
          </Text>
          <NativeSelect.Root size="xs">
            <NativeSelect.Field
              value={String(selectedBand)}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const val = e.target.value;
                onBandChange(val === "rgb" ? "rgb" : Number(val));
              }}
            >
              {hasRgb && <option value="rgb">RGB</option>}
              {bands.map((b) => (
                <option key={b.index} value={String(b.index)}>
                  {b.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>
      )}
      {showColormap && (
        <Box>
          <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
            Colormap
          </Text>
          <NativeSelect.Root size="xs">
            <NativeSelect.Field
              value={colormapName}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onColormapChange(e.target.value)
              }
            >
              {COLORMAP_NAMES.map((cm) => (
                <option key={cm} value={cm}>
                  {cm}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>
      )}
      <Box>
        <Text fontSize="10px" color="brand.textSecondary" fontWeight={500} mb={1}>
          Opacity
        </Text>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          style={{ width: 80, accentColor: BRAND_COLOR }}
        />
      </Box>
    </Flex>
  );
}
