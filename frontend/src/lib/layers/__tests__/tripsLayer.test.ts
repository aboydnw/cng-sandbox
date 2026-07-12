import { describe, it, expect } from "vitest";
import { buildTripsLayer, speedToColor } from "../tripsLayer";

const tracks = [
  {
    trajectory_id: "a",
    path: [
      [0, 0],
      [1, 1],
    ] as [number, number][],
    timestamps: [0, 10],
    speeds: [0, 100],
  },
];

describe("tripsLayer", () => {
  it("maps low vs high speed to different colors", () => {
    const slow = speedToColor(0, 100);
    const fast = speedToColor(100, 100);
    expect(slow).not.toEqual(fast);
  });

  it("builds a TripsLayer carrying currentTime and trailLength", () => {
    const layer = buildTripsLayer({ tracks, currentTime: 5, trailLength: 3 });
    expect(layer.props.currentTime).toBe(5);
    expect(layer.props.trailLength).toBe(3);
  });
});
