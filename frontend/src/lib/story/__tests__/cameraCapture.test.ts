import { describe, it, expect } from "vitest";
import { captureCameraToChapter } from "../cameraCapture";
import {
  createScrollytellingChapter,
  createProseChapter,
  type Story,
} from "../types";

function makeStory(): Story {
  return {
    id: "s-1",
    title: "Story",
    dataset_id: null,
    dataset_ids: [],
    chapters: [
      createScrollytellingChapter({
        id: "ch-3d",
        order: 0,
        map_state: {
          center: [86.925, 27.988],
          zoom: 9,
          bearing: 20,
          pitch: 68,
          basemap: "streets",
          terrain: { enabled: true, exaggeration: 1.5 },
          globe: true,
          buildings: true,
        },
      }),
      createScrollytellingChapter({ id: "ch-other", order: 1 }),
      createProseChapter({ id: "ch-prose", order: 2 }),
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    published: false,
  };
}

const camera = {
  longitude: -70.011,
  latitude: -32.653,
  zoom: 8.5,
  bearing: 0,
  pitch: 30,
};

describe("captureCameraToChapter", () => {
  it("preserves terrain, globe and buildings when merging a camera change", () => {
    const updated = captureCameraToChapter(
      makeStory(),
      "ch-3d",
      camera,
      "dark"
    );
    const ch = updated.chapters[0];
    if (ch.type !== "scrollytelling")
      throw new Error("expected scrollytelling");
    expect(ch.map_state.terrain).toEqual({ enabled: true, exaggeration: 1.5 });
    expect(ch.map_state.globe).toBe(true);
    expect(ch.map_state.buildings).toBe(true);
  });

  it("overwrites the camera fields and basemap", () => {
    const updated = captureCameraToChapter(
      makeStory(),
      "ch-3d",
      camera,
      "dark"
    );
    const ch = updated.chapters[0];
    if (ch.type !== "scrollytelling")
      throw new Error("expected scrollytelling");
    expect(ch.map_state.center).toEqual([-70.011, -32.653]);
    expect(ch.map_state.zoom).toBe(8.5);
    expect(ch.map_state.bearing).toBe(0);
    expect(ch.map_state.pitch).toBe(30);
    expect(ch.map_state.basemap).toBe("dark");
  });

  it("leaves other chapters untouched", () => {
    const story = makeStory();
    const updated = captureCameraToChapter(story, "ch-3d", camera, "dark");
    expect(updated.chapters[1]).toBe(story.chapters[1]);
    expect(updated.chapters[2]).toBe(story.chapters[2]);
  });
});
