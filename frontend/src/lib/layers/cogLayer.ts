import type { Layer } from "@deck.gl/core";
import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import {
  CreateTexture,
  Colormap,
} from "@developmentseed/deck.gl-raster/gpu-modules";
import { buildCategoricalLut, type LutCategory } from "./categoricalLut";
import { cngEpsgResolver } from "./epsg/resolver";

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
}

interface CogLayerPalettedOptions {
  cogUrl: string;
  opacity: number;
  categories?: LutCategory[];
}

export function buildCogLayerPaletted({
  cogUrl,
  opacity,
  categories,
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
        epsgResolver: cngEpsgResolver,
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

    const valueTex = device.createTexture({
      data: raw,
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

    // `raw` travels on the tile's data so the pixel inspector can sample it
    // without a separate cache. Keyed by tile identity, not by (x, y), so
    // zoom-level collisions can't return stale values.
    return { texture: valueTex, lutTexture: lutTex, width, height, raw };
  };

  const renderTile = (data: { texture: unknown; lutTexture: unknown }) => ({
    renderPipeline: [
      { module: CreateTexture, props: { textureName: data.texture } },
      { module: Colormap, props: { colormapTexture: data.lutTexture } },
    ],
  });

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
      epsgResolver: cngEpsgResolver,
    } as any),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function buildCogLayerContinuous({
  cogUrl,
  opacity,
  rasterMin,
  rasterMax,
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

    // Snapshot raw float data; travels on the tile so the pixel inspector
    // can sample it without a separate cache.
    const rawSnapshot = new Float32Array(floatData);

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

    const texture = device.createTexture({
      data: uint8,
      format: "r8unorm",
      width,
      height,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    return { texture, width, height, raw: rawSnapshot };
  };

  const renderTile = (data: { texture: unknown }) => ({
    renderPipeline: [
      { module: CreateTexture, props: { textureName: data.texture } },
      { module: ViridisColorize },
    ],
  });

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
      epsgResolver: cngEpsgResolver,
    } as any),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
