import { Box, Flex } from "@chakra-ui/react";
import "maplibre-gl/dist/maplibre-gl.css";

export const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export const BRAND_COLOR = "#CF3F02";
export const BRAND_COLOR_RGBA = [207, 63, 2] as const;

interface BasemapPickerProps {
  value: string;
  onChange: (value: string) => void;
}

const BASEMAP_OPTIONS = [
  { key: "streets", label: "Light", bg: "#e8e8e8" },
  { key: "satellite", label: "Color", bg: "#a8c8e8" },
  { key: "dark", label: "Dark", bg: "#2d2d2d" },
];

export function BasemapPicker({ value, onChange }: BasemapPickerProps) {
  return (
    <Flex gap={1}>
      {BASEMAP_OPTIONS.map((opt) => (
        <Box
          key={opt.key}
          as="button"
          w="36px"
          h="36px"
          borderRadius="4px"
          bg={opt.bg}
          border="2px solid"
          borderColor={value === opt.key ? "blue.500" : "transparent"}
          onClick={() => onChange(opt.key)}
          title={opt.label}
        />
      ))}
    </Flex>
  );
}
