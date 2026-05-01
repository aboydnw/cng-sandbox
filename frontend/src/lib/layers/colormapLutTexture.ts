/**
 * Creates the LUT texture consumed by deck.gl-raster's `Colormap` GPU module.
 *
 * The shape (`dimension: "2d-array"`, 256×1×1, rgba8unorm) is dictated by the
 * upstream module since the 0.5→0.6 bump — a plain 2D texture renders fully
 * black. Centralising the spec here keeps zarrLayer/cogLayer from drifting
 * apart on the next library update.
 *
 * Caller picks the sampler filter:
 *   - `"linear"` for continuous colormaps (smooth interpolation between
 *     palette stops).
 *   - `"nearest"` for categorical lookups (no blending across class values).
 *
 * Caching (per-device, per-tile, etc.) is intentionally left to the caller.
 */
export function createColormapLutTexture(
  device: { createTexture: (opts: unknown) => unknown },
  lut: Uint8Array,
  filter: "linear" | "nearest"
): unknown {
  return device.createTexture({
    dimension: "2d-array",
    data: lut,
    format: "rgba8unorm",
    width: 256,
    height: 1,
    depth: 1,
    mipLevels: 1,
    sampler: {
      minFilter: filter,
      magFilter: filter,
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
    },
  });
}
