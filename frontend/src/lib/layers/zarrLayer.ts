import type { Layer } from "@deck.gl/core";
import { ZarrLayer, type SliceInput } from "@developmentseed/deck.gl-zarr";
import { CreateTexture } from "@developmentseed/deck.gl-raster/gpu-modules";
import * as zarr from "zarrita";

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

export interface ZarrLayerOptions {
  node: zarr.Group<zarr.Readable> | zarr.Array<zarr.DataType, zarr.Readable>;
  variable?: string;
  selection: Record<string, SliceInput>;
  opacity: number;
  rescaleMin: number;
  rescaleMax: number;
}

export function buildZarrLayer({
  node,
  variable,
  selection,
  opacity,
  rescaleMin,
  rescaleMax,
}: ZarrLayerOptions): Layer[] {
  const range = rescaleMax - rescaleMin || 1;

  const getTileData = async (
    arr: zarr.Array<zarr.DataType, zarr.Readable>,
    options: {
      device: { createTexture: (opts: unknown) => unknown };
      sliceSpec: SliceInput[];
      width: number;
      height: number;
      signal?: AbortSignal;
    }
  ) => {
    const { device, sliceSpec, width, height } = options;
    const chunk = (await zarr.get(arr, sliceSpec)) as {
      data: ArrayLike<number>;
    };

    const pixelCount = width * height;
    const uint8 = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const v = chunk.data[i];
      if (v !== v) {
        uint8[i] = 0;
        continue;
      }
      uint8[i] = Math.round(
        Math.max(0, Math.min(255, ((v - rescaleMin) / range) * 255))
      );
    }

    const texture = device.createTexture({
      data: uint8,
      format: "r8unorm",
      width,
      height,
      sampler: { minFilter: "nearest", magFilter: "nearest" },
    });

    return { texture, width, height };
  };

  const renderTile = (data: { texture: unknown }) => ({
    renderPipeline: [
      { module: CreateTexture, props: { textureName: data.texture } },
      { module: ViridisColorize },
    ],
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return [
    new ZarrLayer({
      id: "zarr-spike-layer",
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
