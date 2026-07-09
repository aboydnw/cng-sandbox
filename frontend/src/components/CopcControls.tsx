import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import { DotsNine } from "@phosphor-icons/react";
import type { CopcColorMode } from "../lib/layers/copcLayer";

const COLOR_MODES: { value: CopcColorMode; label: string }[] = [
  { value: "elevation", label: "Elevation" },
  { value: "intensity", label: "Intensity" },
  { value: "classification", label: "Classification" },
  { value: "rgb", label: "RGB" },
];

interface CopcControlsProps {
  colorMode: CopcColorMode;
  onColorModeChange: (mode: CopcColorMode) => void;
  pointSize: number;
  onPointSizeChange: (size: number) => void;
  pointCount?: number | null;
}

/** Color-mode + point-size controls for a COPC point-cloud layer. */
export function CopcControls({
  colorMode,
  onColorModeChange,
  pointSize,
  onPointSizeChange,
  pointCount,
}: CopcControlsProps) {
  return (
    <Box>
      <Flex align="center" gap={2} mb={3}>
        <DotsNine
          size={16}
          weight="bold"
          color="var(--chakra-colors-brand-orange)"
        />
        <Text fontSize="13px" fontWeight="semibold" color="brand.brown">
          Point cloud
        </Text>
        {pointCount != null && (
          <Text fontSize="11px" color="brand.textSecondary" ml="auto">
            {pointCount.toLocaleString()} pts
          </Text>
        )}
      </Flex>

      <Box mb={3}>
        <Text fontSize="11px" color="brand.textSecondary" mb={1}>
          Color by
        </Text>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            value={colorMode}
            onChange={(e) => onColorModeChange(e.target.value as CopcColorMode)}
            borderColor="brand.border"
          >
            {COLOR_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Box>

      <Box>
        <Flex justify="space-between" mb={1}>
          <Text fontSize="11px" color="brand.textSecondary">
            Point size
          </Text>
          <Text fontSize="11px" color="brand.textSecondary">
            {pointSize.toFixed(1)}px
          </Text>
        </Flex>
        <input
          type="range"
          min={0.5}
          max={8}
          step={0.5}
          value={pointSize}
          onChange={(e) => onPointSizeChange(Number(e.target.value))}
          style={{ width: "100%" }}
          aria-label="Point size"
        />
      </Box>
    </Box>
  );
}
