import type { Layer } from "@deck.gl/core";
import { ZarrLayer, type SliceInput } from "@developmentseed/deck.gl-zarr";
import {
  CreateTexture,
  Colormap,
} from "@developmentseed/deck.gl-raster/gpu-modules";
import * as zarr from "zarrita";
import { buildContinuousLut } from "./continuousLut";

export interface ZarrLayerOptions {
  node: zarr.Group<zarr.Readable> | zarr.Array<zarr.DataType, zarr.Readable>;
  variable?: string;
  selection: Record<string, SliceInput>;
  opacity: number;
  rescaleMin: number;
  rescaleMax: number;
  colormapName: string;
  colormapReversed?: boolean;
  /** Used to scope the layer's id so React/deck.gl rebuild on item change. */
  id?: string;
}

interface ZarrTileData {
  texture: unknown;
  lutTexture: unknown;
  width: number;
  height: number;
}

/**
 * Builds a deck.gl `ZarrLayer` configured to render a single zarr variable
 * with a GPU colormap. The colormap is sampled from the existing
 * `lib/maptool/colormaps.ts` palette set, so the user's selection in the
 * existing colormap picker drives the render.
 */
export function buildZarrLayer({
  node,
  variable,
  selection,
  opacity,
  rescaleMin,
  rescaleMax,
  colormapName,
  colormapReversed = false,
  id = "zarr-layer",
}: ZarrLayerOptions): Layer[] {
  const range = rescaleMax - rescaleMin || 1;
  const lut = buildContinuousLut(colormapName, colormapReversed);

  const getTileData = async (
    arr: zarr.Array<zarr.DataType, zarr.Readable>,
    options: {
      device: { createTexture: (opts: unknown) => unknown };
      sliceSpec: SliceInput[];
      width: number;
      height: number;
      signal?: AbortSignal;
    }
  ): Promise<ZarrTileData> => {
    const { device, sliceSpec, width, height } = options;
    const chunk = (await zarr.get(arr, sliceSpec)) as {
      data: ArrayLike<number>;
    };

    const pixelCount = width * height;
    const uint8 = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const v = chunk.data[i];
      if (Number.isNaN(v)) {
        uint8[i] = 0;
        continue;
      }
      const n = Math.max(0, Math.min(1, (v - rescaleMin) / range));
      uint8[i] = 1 + Math.round(n * 254);
    }

    const texture = device.createTexture({
      data: uint8,
      format: "r8unorm",
      width,
      height,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    const lutTexture = device.createTexture({
      data: lut,
      format: "rgba8unorm",
      width: 256,
      height: 1,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    return { texture, lutTexture, width, height };
  };

  const renderTile = (data: ZarrTileData) => ({
    renderPipeline: [
      { module: CreateTexture, props: { textureName: data.texture } },
      { module: Colormap, props: { colormapTexture: data.lutTexture } },
    ],
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return [
    new ZarrLayer({
      id,
      node,
      variable,
      selection,
      opacity,
      getTileData,
      renderTile,
    } as any),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
