import { describe, it, expect } from "vitest";
import { buildContinuousLut } from "../continuousLut";

describe("buildContinuousLut", () => {
  it("returns a 256x4 RGBA Uint8Array", () => {
    const lut = buildContinuousLut("viridis");
    expect(lut).toBeInstanceOf(Uint8Array);
    expect(lut.length).toBe(256 * 4);
  });

  it("first entry equals the first palette stop", () => {
    const lut = buildContinuousLut("viridis");
    // viridis[0] = "#440154" → r=68, g=1, b=84
    expect(lut[0]).toBe(0x44);
    expect(lut[1]).toBe(0x01);
    expect(lut[2]).toBe(0x54);
    expect(lut[3]).toBe(255);
  });

  it("last entry equals the last palette stop", () => {
    const lut = buildContinuousLut("viridis");
    // viridis[last] = "#fee825" → r=254, g=232, b=37
    expect(lut[255 * 4]).toBe(0xfe);
    expect(lut[255 * 4 + 1]).toBe(0xe8);
    expect(lut[255 * 4 + 2]).toBe(0x25);
    expect(lut[255 * 4 + 3]).toBe(255);
  });

  it("interpolates between adjacent stops", () => {
    // For a 2-stop palette ["#000000", "#ffffff"], the midpoint should be ~127/127/127.
    const lut = buildContinuousLut("__test_two_stop__");
    expect(lut[128 * 4]).toBeGreaterThanOrEqual(126);
    expect(lut[128 * 4]).toBeLessThanOrEqual(129);
  });

  it("reversed=true reverses the gradient", () => {
    const forward = buildContinuousLut("viridis");
    const reversed = buildContinuousLut("viridis", true);
    expect(reversed[0]).toBe(forward[255 * 4]);
    expect(reversed[1]).toBe(forward[255 * 4 + 1]);
    expect(reversed[2]).toBe(forward[255 * 4 + 2]);
    expect(reversed[255 * 4]).toBe(forward[0]);
    expect(reversed[255 * 4 + 1]).toBe(forward[1]);
    expect(reversed[255 * 4 + 2]).toBe(forward[2]);
  });

  it("falls back to viridis for unknown colormap names", () => {
    const unknown = buildContinuousLut("not-a-real-colormap");
    const viridis = buildContinuousLut("viridis");
    expect(unknown).toEqual(viridis);
  });
});
