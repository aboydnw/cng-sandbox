import { COLORMAPS, getColormap } from "../maptool/colormaps";

const TWO_STOP_TEST = "__test_two_stop__";

function getPalette(name: string): string[] {
  if (name === TWO_STOP_TEST) return ["#000000", "#ffffff"];
  return getColormap(name);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Builds a 256-entry RGBA LUT from a named colormap palette by linearly
 * interpolating between hex stops. Suitable for the `Colormap` GPU module
 * from `@developmentseed/deck.gl-raster/gpu-modules`.
 *
 * Falls back to `viridis` if `name` is not a known colormap. When `reversed`
 * is true, the palette is reversed before sampling — matching the
 * `${name}_r` convention used in server-side tile URLs.
 */
export function buildContinuousLut(name: string, reversed = false): Uint8Array {
  const stops = getPalette(name).map(hexToRgb);
  const palette = reversed ? [...stops].reverse() : stops;
  const segments = palette.length - 1;
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const scaled = t * segments;
    const lo = Math.min(Math.floor(scaled), segments);
    const hi = Math.min(lo + 1, segments);
    const f = scaled - lo;
    const a = palette[lo];
    const b = palette[hi];
    lut[i * 4] = Math.round(a[0] + (b[0] - a[0]) * f);
    lut[i * 4 + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 4 + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

// Re-export so callers don't have to dig into maptool when they only want the
// list of available colormap names.
export const COLORMAP_NAMES = Object.keys(COLORMAPS);
