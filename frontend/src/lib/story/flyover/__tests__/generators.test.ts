import { describe, it, expect } from "vitest";
import {
  orbitKeyframes,
  approachKeyframes,
  zoomGapWarnings,
} from "../generators";
import { shortestArcBearing } from "../interpolate";

const pose = {
  center: [86.9, 27.9] as [number, number],
  zoom: 11,
  bearing: 20,
  pitch: 62,
};

describe("orbitKeyframes", () => {
  it("produces 5 keyframes sweeping 180° by default", () => {
    const kfs = orbitKeyframes(pose);
    expect(kfs).toHaveLength(5);
    expect(kfs[0].bearing).toBeCloseTo(20, 6);
    expect(kfs[4].bearing).toBeCloseTo((20 + 180) % 360, 6);
    expect(kfs[2].bearing).toBeCloseTo((20 + 90) % 360, 6);
  });

  it("keeps center and zoom constant", () => {
    for (const k of orbitKeyframes(pose)) {
      expect(k.center).toEqual([86.9, 27.9]);
      expect(k.zoom).toBe(11);
    }
  });

  it("respects count and sweep options and wraps bearings into [0,360)", () => {
    const kfs = orbitKeyframes(
      { ...pose, bearing: 300 },
      { count: 3, sweepDeg: 120 }
    );
    expect(kfs).toHaveLength(3);
    expect(kfs[2].bearing).toBeCloseTo(60, 6); // 300 + 120 wraps
  });

  it("consecutive orbit bearings are shortest-arc-contiguous (no long-way jumps)", () => {
    const kfs = orbitKeyframes({ ...pose, bearing: 300 });
    for (let i = 0; i < kfs.length - 1; i++) {
      const mid = shortestArcBearing(kfs[i].bearing, kfs[i + 1].bearing, 0.5);
      const gap = Math.abs(
        ((kfs[i + 1].bearing - kfs[i].bearing + 540) % 360) - 180
      );
      expect(gap).toBeLessThanOrEqual(90); // 180°/4 segments = 45° steps
      expect(Number.isFinite(mid)).toBe(true);
    }
  });

  it("raises a flat pitch to 60 so the orbit reads as 3D", () => {
    expect(orbitKeyframes({ ...pose, pitch: 0 })[0].pitch).toBe(60);
    expect(orbitKeyframes({ ...pose, pitch: 45 })[0].pitch).toBe(45);
  });
});

describe("approachKeyframes", () => {
  it("builds wide → mid → close ending exactly at the target", () => {
    const kfs = approachKeyframes(pose);
    expect(kfs).toHaveLength(3);
    expect(kfs[0].zoom).toBeCloseTo(6, 6);
    expect(kfs[0].pitch).toBe(0);
    expect(kfs[1].zoom).toBeCloseTo(8.5, 6);
    expect(kfs[2]).toEqual({
      center: [86.9, 27.9],
      zoom: 11,
      bearing: 20,
      pitch: 62,
    });
  });

  it("floors the wide zoom at 1.5", () => {
    expect(approachKeyframes({ ...pose, zoom: 3 })[0].zoom).toBe(1.5);
  });

  it("never trips the zoom-gap warning itself", () => {
    expect(zoomGapWarnings(approachKeyframes(pose))).toEqual([]);
  });
});

describe("zoomGapWarnings", () => {
  it("flags segments with more than 3 zoom levels between keyframes", () => {
    const kfs = [
      { center: [0, 0] as [number, number], zoom: 2, bearing: 0, pitch: 0 },
      { center: [0, 0] as [number, number], zoom: 9, bearing: 0, pitch: 0 },
      { center: [0, 0] as [number, number], zoom: 10, bearing: 0, pitch: 0 },
    ];
    expect(zoomGapWarnings(kfs)).toEqual([0]);
  });

  it("returns empty for gentle paths and short lists", () => {
    expect(zoomGapWarnings([])).toEqual([]);
    expect(
      zoomGapWarnings([
        { center: [0, 0] as [number, number], zoom: 2, bearing: 0, pitch: 0 },
      ])
    ).toEqual([]);
  });
});
