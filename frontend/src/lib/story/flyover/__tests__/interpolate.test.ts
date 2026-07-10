import { describe, it, expect } from "vitest";
import {
  interpolateFlyover,
  shortestArcBearing,
  unwrapLongitudes,
  keyframeProgress,
  captionOpacity,
} from "../interpolate";
import type { FlyoverKeyframe } from "../types";

function kf(overrides: Partial<FlyoverKeyframe> = {}): FlyoverKeyframe {
  return { center: [0, 0], zoom: 5, bearing: 0, pitch: 0, ...overrides };
}

describe("interpolateFlyover", () => {
  const path: FlyoverKeyframe[] = [
    kf({ center: [0, 0], zoom: 4, bearing: 0, pitch: 0 }),
    kf({ center: [10, 10], zoom: 8, bearing: 90, pitch: 60 }),
    kf({ center: [20, 0], zoom: 12, bearing: 180, pitch: 30 }),
  ];

  it("returns null for fewer than 2 keyframes", () => {
    expect(interpolateFlyover([], 0.5)).toBeNull();
    expect(interpolateFlyover([kf()], 0.5)).toBeNull();
  });

  it("clamps t to [0, 1]", () => {
    const start = interpolateFlyover(path, -0.7)!;
    const end = interpolateFlyover(path, 1.9)!;
    expect(start.center).toEqual([0, 0]);
    expect(start.zoom).toBe(4);
    expect(end.center).toEqual([20, 0]);
    expect(end.zoom).toBe(12);
  });

  it("passes exactly through every keyframe pose", () => {
    for (let i = 0; i < path.length; i++) {
      const pose = interpolateFlyover(path, i / (path.length - 1))!;
      expect(pose.center[0]).toBeCloseTo(path[i].center[0], 6);
      expect(pose.center[1]).toBeCloseTo(path[i].center[1], 6);
      expect(pose.zoom).toBeCloseTo(path[i].zoom, 6);
      expect(pose.pitch).toBeCloseTo(path[i].pitch, 6);
      expect(pose.bearing).toBeCloseTo(path[i].bearing, 6);
    }
  });

  it("interpolates zoom and pitch linearly within a segment", () => {
    const mid = interpolateFlyover(path, 0.25)!; // halfway through segment 0
    expect(mid.zoom).toBeCloseTo(6, 6);
    expect(mid.pitch).toBeCloseTo(30, 6);
  });

  it("interpolates centers with Catmull-Rom (collinear points stay on line)", () => {
    const line = [
      kf({ center: [0, 0] }),
      kf({ center: [10, 0] }),
      kf({ center: [20, 0] }),
    ];
    const pose = interpolateFlyover(line, 0.25)!;
    expect(pose.center[1]).toBeCloseTo(0, 6);
    expect(pose.center[0]).toBeCloseTo(5, 6);
  });

  it("crosses the antimeridian the short way", () => {
    const cross = [kf({ center: [170, 0] }), kf({ center: [-170, 0] })];
    const mid = interpolateFlyover(cross, 0.5)!;
    // Short way is through ±180, i.e. |lng| near 180, never near 0.
    expect(Math.abs(mid.center[0])).toBeGreaterThan(150);
  });
});

describe("shortestArcBearing", () => {
  it("crosses 0° going 350 → 10", () => {
    expect(shortestArcBearing(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(shortestArcBearing(350, 10, 0.25)).toBeCloseTo(355, 6);
  });

  it("crosses 0° going 10 → 350", () => {
    expect(shortestArcBearing(10, 350, 0.5)).toBeCloseTo(0, 6);
  });

  it("is a plain lerp when no wrap is needed", () => {
    expect(shortestArcBearing(30, 90, 0.5)).toBeCloseTo(60, 6);
  });

  it("returns endpoints at s=0 and s=1", () => {
    expect(shortestArcBearing(350, 10, 0)).toBeCloseTo(350, 6);
    expect(shortestArcBearing(350, 10, 1)).toBeCloseTo(10, 6);
  });
});

describe("unwrapLongitudes", () => {
  it("keeps already-continuous sequences unchanged", () => {
    expect(unwrapLongitudes([0, 10, 20])).toEqual([0, 10, 20]);
  });

  it("unwraps a 170 → -170 crossing to 170 → 190", () => {
    expect(unwrapLongitudes([170, -170])).toEqual([170, 190]);
  });

  it("unwraps a -170 → 170 crossing to -170 → -190", () => {
    expect(unwrapLongitudes([-170, 170])).toEqual([-170, -190]);
  });
});

describe("caption helpers", () => {
  it("keyframeProgress spreads keyframes evenly over [0,1]", () => {
    expect(keyframeProgress(0, 5)).toBe(0);
    expect(keyframeProgress(2, 5)).toBeCloseTo(0.5, 6);
    expect(keyframeProgress(4, 5)).toBe(1);
  });

  it("captionOpacity is 1 at the keyframe and 0 at the segment midpoint", () => {
    // 3 keyframes → segment width 0.5; keyframe 1 sits at t=0.5
    expect(captionOpacity(0.5, 1, 3)).toBe(1);
    expect(captionOpacity(0.25, 1, 3)).toBe(0);
    expect(captionOpacity(0.75, 1, 3)).toBe(0);
  });

  it("captionOpacity ramps between plateau and edge", () => {
    const partial = captionOpacity(0.35, 1, 3);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
  });
});
