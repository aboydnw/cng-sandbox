import { describe, it, expect } from "vitest";
import {
  computeMaxSpeed,
  speedToColor,
  tracksTimeBounds,
  type TripTrack,
} from "../lib/trips";

const TRACKS: TripTrack[] = [
  {
    trajectory_id: "a",
    path: [
      [0, 0],
      [1, 1],
    ],
    timestamps: [100, 900],
    speeds: [0, 10],
  },
  {
    trajectory_id: "b",
    path: [
      [2, 2],
      [3, 3],
    ],
    timestamps: [50, 1200],
    speeds: [5, 3],
  },
];

describe("speedToColor", () => {
  it("returns the slow color at speed 0 and the fast color at speedMax", () => {
    expect(speedToColor(0, 10)).toEqual([43, 131, 186]);
    expect(speedToColor(10, 10)).toEqual([215, 25, 28]);
  });

  it("clamps out-of-range speeds", () => {
    expect(speedToColor(20, 10)).toEqual([215, 25, 28]);
  });
});

describe("computeMaxSpeed", () => {
  it("finds the max across all tracks in a single pass", () => {
    expect(computeMaxSpeed(TRACKS)).toBe(10);
  });

  it("floors at 1 for empty or zero-speed data", () => {
    expect(computeMaxSpeed([])).toBe(1);
  });
});

describe("tracksTimeBounds", () => {
  it("spans the min and max timestamps across tracks", () => {
    expect(tracksTimeBounds(TRACKS)).toEqual([50, 1200]);
  });

  it("returns [0, 0] for empty input", () => {
    expect(tracksTimeBounds([])).toEqual([0, 0]);
  });
});
