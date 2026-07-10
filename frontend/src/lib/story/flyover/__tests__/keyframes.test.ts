import { describe, it, expect } from "vitest";
import {
  captureKeyframe,
  addKeyframe,
  removeKeyframe,
  moveKeyframe,
  recaptureKeyframe,
  setKeyframeCaption,
} from "../keyframes";
import type { FlyoverKeyframe } from "../types";

const camera = { longitude: 10, latitude: 20, zoom: 8, bearing: 45, pitch: 60 };

const base: FlyoverKeyframe[] = [
  { center: [0, 0], zoom: 4, bearing: 0, pitch: 0, caption: "a" },
  { center: [1, 1], zoom: 5, bearing: 10, pitch: 10 },
  { center: [2, 2], zoom: 6, bearing: 20, pitch: 20, caption: "c" },
];

describe("keyframe operations", () => {
  it("captureKeyframe converts CameraState to a pose keyframe", () => {
    expect(captureKeyframe(camera)).toEqual({
      center: [10, 20],
      zoom: 8,
      bearing: 45,
      pitch: 60,
    });
  });

  it("addKeyframe appends without mutating", () => {
    const next = addKeyframe(base, captureKeyframe(camera));
    expect(next).toHaveLength(4);
    expect(base).toHaveLength(3);
  });

  it("removeKeyframe drops by index; out-of-range is a no-op", () => {
    expect(removeKeyframe(base, 1)).toHaveLength(2);
    expect(removeKeyframe(base, 9)).toBe(base);
  });

  it("moveKeyframe reorders", () => {
    const next = moveKeyframe(base, 0, 2);
    expect(next.map((k) => k.caption)).toEqual([undefined, "c", "a"]);
  });

  it("recaptureKeyframe replaces the pose but keeps the caption", () => {
    const next = recaptureKeyframe(base, 0, camera);
    expect(next[0].center).toEqual([10, 20]);
    expect(next[0].caption).toBe("a");
  });

  it("setKeyframeCaption sets and clears captions", () => {
    expect(setKeyframeCaption(base, 1, "hello")[1].caption).toBe("hello");
    expect("caption" in setKeyframeCaption(base, 0, "")[0]).toBe(false);
  });
});
