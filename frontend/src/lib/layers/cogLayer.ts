import type { MutableRefObject } from "react";
import type { Layer } from "@deck.gl/core";
import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import {
  CreateTexture,
  Colormap,
} from "@developmentseed/deck.gl-raster/gpu-modules";
import { buildCategoricalLut, type LutCategory } from "./categoricalLut";
import wktParser from "wkt-parser";

// --- EPSG resolver (offline for common CRSes, network fallback) ---

// proj4 requires projection origin/scale params (long0, lat0, lat_ts, x0, y0,
// k0) on merc definitions; without them forward() emits NaN x, which NaNs out
// every reference-point reprojection downstream and crashes the TileLayer's
// bounding-volume calculation. The axis is "enu" so input is interpreted as
// [lon, lat], matching the rest of the code.
const EPSG_DEFS: Record<number, unknown> = {
  4326: {
    projName: "longlat",
    name: "WGS 84",
    srsCode: "WGS 84",
    ellps: "WGS 84",
    a: 6378137,
    rf: 298.257223563,
    long0: 0,
    lat0: 0,
    x0: 0,
    y0: 0,
    axis: "enu",
    units: "degree",
  },
  3857: {
    projName: "merc",
    name: "WGS 84 / Pseudo-Mercator",
    srsCode: "WGS 84 / Pseudo-Mercator",
    // Web Mercator is defined on a sphere with a = b = 6378137. Using the
    // WGS84 ellipsoid (rf ≈ 298.26) here would apply elliptical mercator math
    // and shift y by tens of km at mid/high latitudes, breaking alignment
    // with canonical tile-space (rescaleEPSG3857ToCommonSpace assumes
    // 2π * 6378137 circumference).
    a: 6378137,
    b: 6378137,
    long0: 0,
    lat0: 0,
    lat_ts: 0,
    x0: 0,
    y0: 0,
    k0: 1,
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

// --- WebGL helpers ---

function padToAlignment(
  src: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const rowBytes = width;
  const alignedRowBytes = Math.ceil(rowBytes / 4) * 4;
  if (alignedRowBytes === rowBytes) return src;
  const dst = new Uint8Array(alignedRowBytes * height);
  for (let r = 0; r < height; r++) {
    dst.set(
      src.subarray(r * rowBytes, (r + 1) * rowBytes),
      r * alignedRowBytes
    );
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

// --- Tile cache for pixel inspector ---

export interface TileCacheEntry {
  data: Float32Array;
  width: number;
  height: number;
}

const MAX_CACHED_TILES = 256;

// --- COG layer builder ---

export function resolveCogUrl(cogUrl: string): string {
  if (/^https?:\/\//i.test(cogUrl)) return cogUrl;
  return new URL(cogUrl, window.location.origin).toString();
}

interface CogLayerOptions {
  cogUrl: string;
  opacity: number;
  rasterMin: number;
  rasterMax: number;
  tileCacheRef: MutableRefObject<Map<string, TileCacheEntry>>;
}

interface CogLayerPalettedOptions {
  cogUrl: string;
  opacity: number;
  categories?: LutCategory[];
  tileCacheRef?: MutableRefObject<Map<string, TileCacheEntry>>;
}

export function buildCogLayerPaletted({
  cogUrl,
  opacity,
  categories,
  tileCacheRef,
}: CogLayerPalettedOptions): Layer[] {
  const url = resolveCogUrl(cogUrl);

  // Fallback: no categories → default library pipeline (unchanged behavior).
  if (!categories || categories.length === 0) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return [
      new COGLayer({
        id: "direct-cog-layer-paletted",
        geotiff: url,
        opacity,
        maxError: 0.03,
      } as any),
    ];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  // Categories-driven: cache raw values + LUT-based coloring.
  const lut = buildCategoricalLut(categories);

  const getTileData = async (
    image: {
      fetchTile: (
        x: number,
        y: number,
        opts: { boundless: boolean; signal: AbortSignal }
      ) => Promise<{
        array: {
          layout: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          bands: any[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: any;
          width: number;
          height: number;
        };
      }>;
    },
    options: {
      device: { createTexture: (opts: unknown) => unknown };
      x: number;
      y: number;
      signal: AbortSignal;
    }
  ) => {
    const { device, x, y, signal } = options;
    const tile = await image.fetchTile(x, y, { boundless: false, signal });
    const arr = tile.array;
    const { width, height } = arr;

    // Integer paletted data — could be Uint8Array / Int8Array / etc.
    const source = arr.layout === "band-separate" ? arr.bands[0] : arr.data;
    const raw = new Uint8Array(source.length);
    for (let i = 0; i < source.length; i++) {
      raw[i] = source[i] & 0xff;
    }

    if (tileCacheRef) {
      const cacheKey = `${x}/${y}`;
      const cache = tileCacheRef.current;
      // Widen to Float32Array to satisfy existing TileCacheEntry typing;
      // round-trips exactly for 0..255 integer values.
      const cached = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) cached[i] = raw[i];
      cache.set(cacheKey, {
        data: cached,
        width,
        height,
      });
      while (cache.size > MAX_CACHED_TILES) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
    }

    const valueTex = device.createTexture({
      data: padToAlignment(raw, width, height),
      format: "r8unorm",
      width,
      height,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    const lutTex = device.createTexture({
      data: lut,
      format: "rgba8unorm",
      width: 256,
      height: 1,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    return { texture: valueTex, lutTexture: lutTex, width, height };
  };

  const renderTile = (data: { texture: unknown; lutTexture: unknown }) => [
    { module: CreateTexture, props: { textureName: data.texture } },
    { module: Colormap, props: { colormapTexture: data.lutTexture } },
  ];

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return [
    new COGLayer({
      id: "direct-cog-layer-paletted",
      geotiff: url,
      opacity,
      getTileData,
      renderTile,
      maxError: 0.03,
      pickable: true,
    } as any),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function buildCogLayerContinuous({
  cogUrl,
  opacity,
  rasterMin,
  rasterMax,
  tileCacheRef,
}: CogLayerOptions): Layer[] {
  const url = resolveCogUrl(cogUrl);
  const range = rasterMax - rasterMin || 1;

  const getTileData = async (
    image: {
      fetchTile: (
        x: number,
        y: number,
        opts: { boundless: boolean; signal: AbortSignal }
      ) => Promise<{
        array: {
          layout: string;
          bands: ArrayBufferView[];
          data: ArrayBufferView;
          width: number;
          height: number;
        };
      }>;
    },
    options: {
      device: { createTexture: (opts: unknown) => unknown };
      x: number;
      y: number;
      signal: AbortSignal;
    }
  ) => {
    const { device, x, y, signal } = options;
    const tile = await image.fetchTile(x, y, {
      boundless: false,
      signal,
    });
    const arr = tile.array;
    const { width, height } = arr;

    const raw = arr.layout === "band-separate" ? arr.bands[0] : arr.data;
    let floatData: Float32Array;
    if (raw instanceof Float32Array) {
      floatData = raw;
    } else if (ArrayBuffer.isView(raw) && !(raw instanceof DataView)) {
      // Integer typed arrays (Uint32Array, Int16Array, etc.) — convert to float32
      const src = raw as unknown as ArrayLike<number>;
      floatData = new Float32Array(src.length);
      for (let i = 0; i < src.length; i++) floatData[i] = src[i];
    } else {
      console.error("[cogLayer] unexpected data type:", raw);
      return { texture: null, width: 0, height: 0 };
    }

    // Cache raw float data for pixel inspector
    {
      const cacheKey = `${x}/${y}`;
      const cache = tileCacheRef.current;
      cache.set(cacheKey, {
        data: new Float32Array(floatData),
        width,
        height,
      });
      while (cache.size > MAX_CACHED_TILES) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
    }

    // Normalize float32 to uint8 [0, 255]
    const pixelCount = width * height;
    const uint8 = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const v = floatData[i];
      if (v !== v) {
        uint8[i] = 0;
        continue;
      }
      uint8[i] = Math.round(
        Math.max(0, Math.min(255, ((v - rasterMin) / range) * 255))
      );
    }

    const textureData = padToAlignment(uint8, width, height);

    const texture = device.createTexture({
      data: textureData,
      format: "r8unorm",
      width,
      height,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    return { texture, width, height };
  };

  const renderTile = (data: { texture: unknown }) => [
    { module: CreateTexture, props: { textureName: data.texture } },
    { module: ViridisColorize },
  ];

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return [
    new COGLayer({
      id: "direct-cog-layer-continuous",
      geotiff: url,
      opacity,
      getTileData,
      renderTile,
      maxError: 0.03,
      pickable: true,
    } as any),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export { localEpsgResolver };
