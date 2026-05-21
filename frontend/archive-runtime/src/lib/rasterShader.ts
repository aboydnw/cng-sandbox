import { COLORMAPS, type Rgba } from "./colormaps";

const DEFAULT_COLORMAP = "viridis";

export { COLORMAPS };

export function decodeTerrainRgb(
  r: number,
  g: number,
  b: number,
  a = 255
): number {
  if (a === 0) return Number.NaN;
  return -10_000 + (r * 65536 + g * 256 + b) * 0.1;
}

export function sampleColormap(name: string, t: number, reversed = false): Rgba {
  const lut = COLORMAPS[name] ?? COLORMAPS[DEFAULT_COLORMAP];
  if (!lut) throw new Error("no default colormap registered");
  const clamped = Math.max(0, Math.min(1, reversed ? 1 - t : t));
  const idx = Math.min(255, Math.floor(clamped * 256));
  return lut[idx];
}

export function applyColormapToTile(
  png: Uint8ClampedArray,
  width: number,
  height: number,
  rescale: [number, number],
  colormap: string,
  reversed = false
): Uint8ClampedArray {
  const [vmin, vmax] = rescale;
  const span = vmax - vmin;
  const validSpan = Number.isFinite(span) && span > 0;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    const value = decodeTerrainRgb(
      png[off],
      png[off + 1],
      png[off + 2],
      png[off + 3]
    );
    if (Number.isNaN(value)) {
      out[off + 3] = 0;
      continue;
    }
    const t = validSpan ? (value - vmin) / span : 0;
    const [r, g, b, a] = sampleColormap(colormap, t, reversed);
    out[off] = r;
    out[off + 1] = g;
    out[off + 2] = b;
    out[off + 3] = a;
  }
  return out;
}
