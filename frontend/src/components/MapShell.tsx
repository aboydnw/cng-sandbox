import { Box, Flex } from "@chakra-ui/react";
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
          borderColor={value === opt.key ? "brand.orange" : "transparent"}
          onClick={() => onChange(opt.key)}
          title={opt.label}
        />
      ))}
    </Flex>
  );
}
