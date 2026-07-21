import { Box, Flex, Text } from "@chakra-ui/react";
import { Check } from "@phosphor-icons/react";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const ESRI_WORLD_IMAGERY: StyleSpecification = {
  version: 8,
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "esri-imagery", type: "raster", source: "esri-imagery" }],
};

export const BASEMAPS: Record<string, string | StyleSpecification> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  imagery: ESRI_WORLD_IMAGERY,
};

// Mapterhorn hosted terrain-RGB (terrarium encoding). Single constant so
// self-hosting the source.coop PMTiles is a one-line config swap.
export const TERRAIN_DEM_URL = "https://tiles.mapterhorn.com/{z}/{x}/{y}.png";
export const TERRAIN_DEM_ATTRIBUTION = "Mapterhorn";
// OpenFreeMap vector tiles carry render_height / render_min_height on the
// `building` source-layer for fill-extrusion.
export const BUILDINGS_SOURCE_URL = "https://tiles.openfreemap.org/planet";

export const BRAND_COLOR = "#CF3F02";
export const BRAND_COLOR_RGBA = [207, 63, 2] as const;

interface BasemapPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const BASEMAP_OPTIONS = [
  { key: "streets", label: "Light", bg: "#e8e8e8" },
  { key: "satellite", label: "Color", bg: "#a8c8e8" },
  { key: "dark", label: "Dark", bg: "#2d2d2d" },
  { key: "imagery", label: "Satellite", bg: "#3d5a45" },
];

export function BasemapPicker({ value, onChange }: BasemapPickerProps) {
  return (
    <Flex gap={1} role="group" aria-label="Basemap">
      {BASEMAP_OPTIONS.map((opt) => (
        <Flex
          key={opt.key}
          as="button"
          direction="column"
          align="center"
          gap={1}
          p={1}
          minW="52px"
          borderRadius="control"
          border="1px solid"
          borderColor={value === opt.key ? "action.primary" : "transparent"}
          bg={value === opt.key ? "bg.emphasized" : "transparent"}
          color={value === opt.key ? "action.primary" : "fg.muted"}
          onClick={() => onChange(opt.key)}
          title={opt.label}
          aria-label={`${opt.label} basemap`}
          aria-pressed={value === opt.key}
          _hover={{ bg: "bg.subtle", color: "fg" }}
        >
          <Box
            w="32px"
            h="22px"
            borderRadius="3px"
            bg={opt.bg}
            border="1px solid"
            borderColor="border.emphasized"
            position="relative"
          >
            {value === opt.key && (
              <Flex
                position="absolute"
                inset={0}
                align="center"
                justify="center"
                color={
                  opt.key === "dark" || opt.key === "imagery"
                    ? "white"
                    : "brand.brown"
                }
              >
                <Check size={14} weight="bold" />
              </Flex>
            )}
          </Box>
          <Text fontSize="10px" lineHeight="1">
            {opt.label}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
