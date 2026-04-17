import { describe, it, expect } from "vitest";
import { buildCategoricalLut } from "../categoricalLut";

describe("buildCategoricalLut", () => {
  it("returns a 256×1 RGBA LUT", () => {
    const lut = buildCategoricalLut([
      { value: 1, color: "#ff0000", label: "A" },
    ]);
    expect(lut.length).toBe(256 * 4);
  });

  it("sets opaque color at the category value index", () => {
    const lut = buildCategoricalLut([
      { value: 3, color: "#112233", label: "X" },
    ]);
    expect(Array.from(lut.slice(3 * 4, 3 * 4 + 4))).toEqual([
      0x11, 0x22, 0x33, 255,
    ]);
  });

  it("leaves other indices transparent (alpha=0)", () => {
    const lut = buildCategoricalLut([
      { value: 3, color: "#112233", label: "X" },
    ]);
    expect(lut[0 * 4 + 3]).toBe(0); // alpha 0 at index 0
    expect(lut[10 * 4 + 3]).toBe(0);
  });

  it("handles multiple categories", () => {
    const lut = buildCategoricalLut([
      { value: 1, color: "#ff0000", label: "A" },
      { value: 2, color: "#00ff00", label: "B" },
      { value: 5, color: "#0000ff", label: "C" },
    ]);
    expect(Array.from(lut.slice(1 * 4, 1 * 4 + 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(lut.slice(2 * 4, 2 * 4 + 4))).toEqual([0, 255, 0, 255]);
    expect(Array.from(lut.slice(5 * 4, 5 * 4 + 4))).toEqual([0, 0, 255, 255]);
  });

  it("clips values outside 0..255", () => {
    const lut = buildCategoricalLut([
      { value: 300, color: "#ffffff", label: "out" },
      { value: -1, color: "#000000", label: "out" },
    ]);
    // No out-of-range writes: whole LUT should be transparent.
    for (let i = 3; i < lut.length; i += 4) {
      expect(lut[i]).toBe(0);
    }
  });
});
