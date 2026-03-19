import { useState, useMemo, useCallback, useRef } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import DeckGL from "@deck.gl/react";
import { MapView, WebMercatorViewport } from "@deck.gl/core";
import MapGL from "react-map-gl/maplibre";
import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import { CreateTexture } from "@developmentseed/deck.gl-raster/gpu-modules";
import wktParser from "wkt-parser";
import type { Dataset } from "../types";
import { BASEMAPS, BasemapPicker, BRAND_COLOR } from "./MapShell";

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

/** Look up raw raster value at a geographic point from the tile cache. */
function lookupValue(
  cache: Map<string, TileCacheEntry>,
  lng: number,
  lat: number,
): number | null {
  let bestEntry: TileCacheEntry | null = null;
  let bestRes = Infinity;

  for (const [, entry] of cache) {
    const [west, south, east, north] = entry.bounds;
    if (lng >= west && lng <= east && lat >= south && lat <= north) {
      const res = (east - west) / entry.width;
      if (res < bestRes) {
        bestRes = res;
        bestEntry = entry;
      }
    }
  }

  if (!bestEntry) return null;

  const [west, south, east, north] = bestEntry.bounds;
  const px = Math.floor(
    ((lng - west) / (east - west)) * bestEntry.width,
  );
  const py = Math.floor(
    ((north - lat) / (north - south)) * bestEntry.height,
  );

  if (px < 0 || px >= bestEntry.width || py < 0 || py >= bestEntry.height) {
    return null;
  }

  const val = bestEntry.data[py * bestEntry.width + px];
  if (val !== val) return null; // NaN check
  return val;
}

function formatCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) return value.toFixed(1);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  if (Math.abs(value) >= 0.01) return value.toFixed(4);
  return value.toPrecision(4);
}

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

interface TileCacheEntry {
  data: Float32Array;
  width: number;
  height: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
}

const MAX_CACHED_TILES = 256;

interface DirectRasterMapProps {
  dataset: Dataset;
}

export function DirectRasterMap({ dataset }: DirectRasterMapProps) {
  const [opacity, setOpacity] = useState(0.8);
  const [basemap, setBasemap] = useState("streets");
  const tileCacheRef = useRef<Map<string, TileCacheEntry>>(new Map());
  const hoverRafRef = useRef<number | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    lng: number;
    lat: number;
    value: number;
    bandName: string | null;
  } | null>(null);
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

      // Cache raw float32 data for pixel inspector
      if (dataset.bounds) {
        const [dsWest, dsSouth, dsEast, dsNorth] = dataset.bounds;
        // Use dataset bounds as the tile extent. For the overview level
        // (single tile covering the whole image), this is exact.
        const cacheKey = `${x}/${y}`;
        const cache = tileCacheRef.current;
        cache.set(cacheKey, {
          data: new Float32Array(floatData),
          width,
          height,
          bounds: [dsWest, dsSouth, dsEast, dsNorth],
        });
        // Simple eviction: drop oldest entries when over cap
        while (cache.size > MAX_CACHED_TILES) {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) cache.delete(firstKey);
        }
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
    [rasterMin, rasterMax, dataset.bounds],
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

  const onHover = useCallback(
    (info: any) => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
      }
      if (!info.coordinate) {
        hoverRafRef.current = null;
        setHoverInfo(null);
        return;
      }
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const [lng, lat] = info.coordinate;
        const value = lookupValue(tileCacheRef.current, lng, lat);
        if (value === null) {
          setHoverInfo(null);
          return;
        }
        setHoverInfo({
          x: info.x,
          y: info.y,
          lng,
          lat,
          value,
          bandName: dataset.band_names?.[0] ?? null,
        });
      });
    },
    [dataset.band_names],
  );

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        initialViewState={initialViewState}
        controller
        layers={layers}
        views={new MapView({ repeat: true })}
        onHover={onHover}
        onError={(error) => console.error("DeckGL error:", error.message)}
      >
        <MapGL mapStyle={BASEMAPS[basemap]} />
      </DeckGL>

      <Box position="absolute" top={3} left={3} bg="white" borderRadius="4px" shadow="sm" p={1}>
        <BasemapPicker value={basemap} onChange={setBasemap} />
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
            style={{ width: 80, accentColor: BRAND_COLOR }}
          />
        </Box>
      </Flex>

      {hoverInfo && (
        <Box
          position="absolute"
          left={`${hoverInfo.x + 12}px`}
          top={`${hoverInfo.y - 40}px`}
          bg="white"
          borderRadius="4px"
          shadow="sm"
          px={2}
          py={1}
          pointerEvents="none"
          zIndex={10}
          whiteSpace="nowrap"
        >
          <Text fontSize="13px" fontWeight={600} color="brand.brown">
            {hoverInfo.bandName
              ? `${hoverInfo.bandName}: ${formatValue(hoverInfo.value)}`
              : formatValue(hoverInfo.value)}
          </Text>
          <Text fontSize="11px" color="brand.textSecondary">
            {formatCoord(hoverInfo.lat, hoverInfo.lng)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
