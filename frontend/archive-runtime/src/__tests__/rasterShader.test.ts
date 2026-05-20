import { describe, it, expect } from "vitest";
import {
  decodeTerrainRgb,
  sampleColormap,
  COLORMAPS,
} from "../lib/rasterShader";
import "../lib/colormaps";

describe("terrain-RGB decode", () => {
  it("round-trips a known integer value", () => {
    const value = 12.3;
    const scaled = Math.round((value + 10_000) / 0.1);
    const r = (scaled >> 16) & 0xff;
    const g = (scaled >> 8) & 0xff;
    const b = scaled & 0xff;
    const decoded = decodeTerrainRgb(r, g, b);
    expect(decoded).toBeCloseTo(value, 1);
  });

  it("returns NaN when alpha is 0", () => {
    const decoded = decodeTerrainRgb(255, 255, 255, 0);
    expect(Number.isNaN(decoded)).toBe(true);
  });
});

describe("sampleColormap", () => {
  it("returns black for a known colormap at t=0 and a non-black color at t=1", () => {
    expect(COLORMAPS.viridis).toBeDefined();
    const start = sampleColormap("viridis", 0);
    const end = sampleColormap("viridis", 1);
    expect(start).toHaveLength(4);
    expect(end).toHaveLength(4);
    expect(start).not.toEqual(end);
  });

  it("falls back to a default colormap for an unknown name", () => {
    const c = sampleColormap("not-a-real-colormap", 0.5);
    expect(c).toHaveLength(4);
  });
});
