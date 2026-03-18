import { useState, useMemo, useCallback } from "react";
import { Box, Flex, NativeSelect, Text } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView, WebMercatorViewport } from "@deck.gl/core";
import Map from "react-map-gl/maplibre";
import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import { CreateTexture } from "@developmentseed/deck.gl-raster/gpu-modules";
import wktParser from "wkt-parser";
import type { Dataset } from "../types";
import "maplibre-gl/dist/maplibre-gl.css";

// Offline EPSG resolver — avoids network fetch to epsg.io.
// The library expects wkt-parser output format (units: "degree", not "degrees").
const EPSG_DEFS: Record<number, any> = {
  4326: {
    projName: "longlat",
    name: "WGS 84",
    srsCode: "WGS 84",
    ellps: "WGS 84",
    a: 6378137,
    rf: 298.257223563,
    axis: "neu",
    units: "degree",
  },
  3857: {
    projName: "merc",
    name: "WGS 84 / Pseudo-Mercator",
    srsCode: "WGS 84 / Pseudo-Mercator",
    ellps: "WGS 84",
    a: 6378137,
    rf: 298.257223563,
    axis: "enu",
    units: "metre",
  },
};
async function localEpsgResolver(epsg: number) {
  if (EPSG_DEFS[epsg]) return EPSG_DEFS[epsg];
  const resp = await fetch(`https://epsg.io/${epsg}.json`);
  if (!resp.ok) throw new Error(`Failed to fetch EPSG:${epsg}`);
  const projjson = await resp.json();
  const parsed = wktParser(projjson);
  EPSG_DEFS[epsg] = parsed;
  return parsed;
}

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Pad row data to satisfy WebGL's UNPACK_ALIGNMENT (4 bytes).
 * For r8unorm (1 byte/pixel), rows whose width isn't a multiple of 4 must be
 * padded so each row starts on a 4-byte boundary.
 */
function padToAlignment(
  src: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const rowBytes = width; // 1 byte per pixel for r8unorm
  const alignedRowBytes = Math.ceil(rowBytes / 4) * 4;
  if (alignedRowBytes === rowBytes) return src;
  const dst = new Uint8Array(alignedRowBytes * height);
  for (let r = 0; r < height; r++) {
    dst.set(src.subarray(r * rowBytes, (r + 1) * rowBytes), r * alignedRowBytes);
  }
  return dst;
}

const ViridisColorize = {
  name: "viridis-colorize",
  inject: {
    "fs:DECKGL_FILTER_COLOR": `
      float t = color.r;
      if (t <= 0.0) { discard; }
      vec3 c0 = vec3(0.267, 0.004, 0.329);
      vec3 c1 = vec3(0.282, 0.140, 0.458);
      vec3 c2 = vec3(0.127, 0.566, 0.551);
      vec3 c3 = vec3(0.544, 0.773, 0.247);
      vec3 c4 = vec3(0.993, 0.906, 0.144);
      vec3 rgb;
      if (t < 0.25) rgb = mix(c0, c1, t * 4.0);
      else if (t < 0.5) rgb = mix(c1, c2, (t - 0.25) * 4.0);
      else if (t < 0.75) rgb = mix(c2, c3, (t - 0.5) * 4.0);
      else rgb = mix(c3, c4, (t - 0.75) * 4.0);
      color = vec4(rgb, 1.0);
    `,
  },
};

interface DirectRasterMapProps {
  dataset: Dataset;
}

export function DirectRasterMap({ dataset }: DirectRasterMapProps) {
  const [opacity, setOpacity] = useState(0.8);
  const [basemap, setBasemap] = useState("streets");
  const rasterMin = dataset.raster_min ?? 0;
  const rasterMax = dataset.raster_max ?? 1;

  const initialViewState = useMemo(() => {
    if (!dataset.bounds) {
      return { longitude: 0, latitude: 0, zoom: 2 };
    }
    const [west, south, east, north] = dataset.bounds;
    const MERCATOR_LIMIT = 85.051129;
    const viewport = new WebMercatorViewport({ width: 800, height: 600 });
    const { longitude, latitude, zoom } = viewport.fitBounds(
      [
        [west, Math.max(south, -MERCATOR_LIMIT)],
        [east, Math.min(north, MERCATOR_LIMIT)],
      ],
      { padding: 40 },
    );
    return { longitude, latitude, zoom };
  }, [dataset.bounds]);

  const getTileData = useCallback(
    async (image: any, options: any) => {
      const { device, x, y, signal } = options;
      // Don't pass `pool` — Vite's dev server can't serve the decoder workers.
      // Main-thread decoding works fine for the tile sizes involved.
      const tile = await image.fetchTile(x, y, {
        boundless: false,
        signal,
      });
      const arr = tile.array;
      const { width, height } = arr;

      // Extract float data — handle both pixel-interleaved and band-separate
      let floatData: Float32Array;
      if (arr.layout === "band-separate") {
        floatData = arr.bands[0];
      } else {
        floatData = arr.data;
      }

      if (!floatData || !(floatData instanceof Float32Array)) {
        console.error("[DirectRasterMap] unexpected data type:", floatData);
        return { texture: null, width: 0, height: 0 };
      }

      // Normalize float32 elevation to uint8 [0, 255]
      const range = rasterMax - rasterMin || 1;
      const pixelCount = width * height;
      const uint8 = new Uint8Array(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        const v = floatData[i];
        if (v !== v) {
          // NaN → 0 (discard in shader)
          uint8[i] = 0;
          continue;
        }
        uint8[i] = Math.round(
          Math.max(0, Math.min(255, ((v - rasterMin) / range) * 255)),
        );
      }

      // Pad for WebGL UNPACK_ALIGNMENT (4-byte row boundary)
      const textureData = padToAlignment(uint8, width, height);

      const texture = device.createTexture({
        data: textureData,
        format: "r8unorm",
        width,
        height,
        sampler: { minFilter: "nearest", magFilter: "nearest" },
      });

      return { texture, width, height };
    },
    [rasterMin, rasterMax],
  );

  const renderTile = useCallback(
    (data: any) => [
      { module: CreateTexture, props: { textureName: data.texture } },
      { module: ViridisColorize },
    ],
    [],
  );

  const layers = useMemo(() => {
    if (!dataset.cog_url) return [];
    const url = window.location.origin + dataset.cog_url;
    return [
      new COGLayer({
        id: "direct-cog-layer",
        geotiff: url,
        opacity,
        getTileData,
        renderTile,
        epsgResolver: localEpsgResolver,
      } as any),
    ];
  }, [dataset.cog_url, opacity, getTileData, renderTile]);

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        initialViewState={initialViewState}
        controller
        layers={layers}
        views={new MapView({ repeat: true })}
        onError={(error) => console.error("DeckGL error:", error.message)}
      >
        <Map mapStyle={BASEMAPS[basemap]} />
      </DeckGL>

      <Box position="absolute" top={3} left={3} bg="white" borderRadius="4px" shadow="sm" p={1}>
        <NativeSelect.Root size="xs">
          <NativeSelect.Field
            value={basemap}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBasemap(e.target.value)}
          >
            <option value="streets">Streets</option>
            <option value="satellite">Satellite</option>
            <option value="dark">Dark</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>

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
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ width: 80, accentColor: "#CF3F02" }}
          />
        </Box>
      </Flex>
    </Box>
  );
}
