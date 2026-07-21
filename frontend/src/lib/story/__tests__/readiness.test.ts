import { describe, expect, it } from "vitest";
import type { Story } from "../types";
import { chapterReadiness, storyReadiness } from "../readiness";

const completeStory: Story = {
  id: "story-1",
  title: "A changing coastline",
  description: "",
  dataset_id: null,
  dataset_ids: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  published: false,
  chapters: [
    {
      id: "chapter-1",
      order: 0,
      type: "prose",
      title: "What changed",
      narrative: "The shoreline moved inland after the storm.",
    },
  ],
};

describe("story readiness", () => {
  it("blocks publishing only when the story itself cannot identify content", () => {
    const result = storyReadiness({ ...completeStory, title: "" });
    expect(result.readyToPublish).toBe(false);
    expect(result.blocking).toEqual([
      { id: "story-title", message: "Add a story title" },
    ]);
  });

  it("treats unfinished chapter content as advisory", () => {
    const story = {
      ...completeStory,
      chapters: [{ ...completeStory.chapters[0], narrative: "" }],
    };
    const result = storyReadiness(story);
    expect(result.readyToPublish).toBe(true);
    expect(result.advisory[0].message).toMatch(/reader-facing text/i);
  });

  it("reports missing map data and flyover keyframes", () => {
    expect(
      chapterReadiness({
        id: "map-1",
        order: 0,
        type: "map",
        title: "Map",
        narrative: "Context",
        map_state: {
          center: [0, 0],
          zoom: 2,
          bearing: 0,
          pitch: 0,
          basemap: "streets",
        },
        layer_config: {
          dataset_id: "",
          colormap: "viridis",
          opacity: 1,
          basemap: "streets",
        },
      }).issues
    ).toContain("Choose data for the map");
  });
});
