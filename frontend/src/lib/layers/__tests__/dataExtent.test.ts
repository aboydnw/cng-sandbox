import { describe, it, expect } from "vitest";
import {
  shouldShowZoomPrompt,
  boundsCenter,
  buildExtentOutlineLayer,
} from "../dataExtent";

describe("shouldShowZoomPrompt", () => {
  it("returns true when current zoom is below min zoom", () => {
    expect(shouldShowZoomPrompt(8, 12)).toBe(true);
  });

  it("returns false when current zoom reaches min zoom", () => {
    expect(shouldShowZoomPrompt(12, 12)).toBe(false);
  });

  it("returns false when current zoom is above min zoom", () => {
    expect(shouldShowZoomPrompt(14, 12)).toBe(false);
  });

  it("returns false when min zoom is missing", () => {
    expect(shouldShowZoomPrompt(2, null)).toBe(false);
    expect(shouldShowZoomPrompt(2, undefined)).toBe(false);
  });

  it("returns false when min zoom is zero or negative", () => {
    expect(shouldShowZoomPrompt(2, 0)).toBe(false);
    expect(shouldShowZoomPrompt(2, -1)).toBe(false);
  });

  it("returns false when min zoom is not finite", () => {
    expect(shouldShowZoomPrompt(2, NaN)).toBe(false);
    expect(shouldShowZoomPrompt(2, Infinity)).toBe(false);
  });

  it("handles fractional zooms", () => {
    expect(shouldShowZoomPrompt(11.9, 12)).toBe(true);
    expect(shouldShowZoomPrompt(12.1, 12)).toBe(false);
  });
});

describe("boundsCenter", () => {
  it("returns the midpoint of the bounding box", () => {
    expect(boundsCenter([10, 20, 30, 40])).toEqual([20, 30]);
  });

  it("handles bounds spanning the equator and prime meridian", () => {
    expect(boundsCenter([-10, -20, 10, 20])).toEqual([0, 0]);
  });
});

describe("buildExtentOutlineLayer", () => {
  it("builds a closed dashed outline of the bounds", () => {
    const layer = buildExtentOutlineLayer([10, 20, 30, 40]);
    expect(layer.id).toBe("data-extent-outline");
    const data = layer.props.data as { path: [number, number][] }[];
    expect(data).toHaveLength(1);
    expect(data[0].path).toEqual([
      [10, 20],
      [30, 20],
      [30, 40],
      [10, 40],
      [10, 20],
    ]);
    expect(data[0].path[0]).toEqual(data[0].path[data[0].path.length - 1]);
    expect(layer.props.pickable).toBe(false);
  });

  it("accepts a custom layer id", () => {
    const layer = buildExtentOutlineLayer([0, 0, 1, 1], "custom-extent");
    expect(layer.id).toBe("custom-extent");
  });
});
