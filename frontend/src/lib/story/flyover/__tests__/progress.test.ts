import { describe, it, expect } from "vitest";
import { rawProgress, damp, steppedIndex } from "../progress";

describe("rawProgress", () => {
  // Container is 300vh tall in a 100vh viewport → scrollable span 200vh.
  it("is 0 before the container top reaches the viewport top", () => {
    expect(rawProgress(50, 3000, 1000)).toBe(0);
  });

  it("is 0.5 halfway through the scrollable span", () => {
    expect(rawProgress(-1000, 3000, 1000)).toBeCloseTo(0.5, 6);
  });

  it("is 1 when the container bottom reaches the viewport bottom", () => {
    expect(rawProgress(-2000, 3000, 1000)).toBe(1);
    expect(rawProgress(-2500, 3000, 1000)).toBe(1);
  });

  it("returns 1 for degenerate containers no taller than the viewport", () => {
    expect(rawProgress(0, 800, 1000)).toBe(1);
  });
});

describe("damp", () => {
  it("moves a fraction of the way toward the target", () => {
    expect(damp(0, 1, 0.12)).toBeCloseTo(0.12, 6);
  });

  it("converges to exactly the target", () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = damp(v, 1, 0.12);
    expect(v).toBe(1);
  });

  it("is stable at the target (no oscillation)", () => {
    expect(damp(1, 1, 0.12)).toBe(1);
  });
});

describe("steppedIndex", () => {
  it("maps progress to the nearest keyframe", () => {
    expect(steppedIndex(0, 5)).toBe(0);
    expect(steppedIndex(0.26, 5)).toBe(1);
    expect(steppedIndex(1, 5)).toBe(4);
  });

  it("clamps out-of-range progress", () => {
    expect(steppedIndex(-1, 5)).toBe(0);
    expect(steppedIndex(2, 5)).toBe(4);
  });
});
