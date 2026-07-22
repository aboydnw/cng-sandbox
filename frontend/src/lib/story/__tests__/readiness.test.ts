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

    expect(
      chapterReadiness({
        id: "flyover-1",
        order: 1,
        type: "flyover",
        title: "Flyover",
        narrative: "Approach the landscape",
        keyframes: [{ center: [0, 0], zoom: 2, bearing: 0, pitch: 45 }],
        scroll_length: 1.5,
        map_state: {
          center: [0, 0],
          zoom: 2,
          bearing: 0,
          pitch: 45,
          basemap: "streets",
        },
      }).issues
    ).toContain("Add at least two flyover keyframes");
  });

  it("reports an empty chart as incomplete", () => {
    expect(
      chapterReadiness({
        id: "chart-1",
        order: 0,
        type: "chart",
        title: "Chart",
        narrative: "Context",
        chart: {
          source: { kind: "csv", asset_id: "", url: "", columns: [] },
          viz: { kind: "line", x_field: "", y_fields: [] },
        },
      }).issues
    ).toEqual(["Choose data for the chart", "Configure the chart axes"]);
  });

  it("accepts deliberate terrain-only and overlay-only map chapters", () => {
    const baseMap = {
      id: "scene-1",
      order: 0,
      type: "map" as const,
      title: "Scene",
      narrative: "Context",
      layer_config: {
        dataset_id: "",
        colormap: "viridis",
        opacity: 1,
        basemap: "streets",
      },
      map_state: {
        center: [0, 0] as [number, number],
        zoom: 2,
        bearing: 0,
        pitch: 45,
        basemap: "streets",
        terrain: { enabled: true, exaggeration: 1.5 },
      },
    };
    expect(chapterReadiness(baseMap).issues).not.toContain(
      "Choose data for the map"
    );
    expect(
      chapterReadiness({
        ...baseMap,
        map_state: { ...baseMap.map_state, terrain: undefined },
        overlays: [{ connection_id: "boundaries", opacity: 1, visible: true }],
      }).issues
    ).not.toContain("Choose data for the map");
  });
});
