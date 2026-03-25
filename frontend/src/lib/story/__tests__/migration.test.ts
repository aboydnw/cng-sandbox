import { describe, it, expect } from "vitest";
import { migrateStory } from "../migration";
import type { Story } from "../types";

function makeOldStory(): any {
  return {
    id: "s-1",
    title: "Old Story",
    dataset_id: "ds-abc",
    chapters: [
      {
        id: "ch-1",
        order: 0,
        title: "Chapter 1",
        narrative: "Hello",
        map_state: { center: [0, 0], zoom: 2, bearing: 0, pitch: 0, basemap: "streets" },
        transition: "fly-to",
        layer_config: { colormap: "viridis", opacity: 0.8, basemap: "streets" },
      },
      {
        id: "ch-2",
        order: 1,
        title: "Chapter 2",
        narrative: "World",
        map_state: { center: [10, 20], zoom: 5, bearing: 0, pitch: 0, basemap: "streets" },
        transition: "fly-to",
        layer_config: { colormap: "plasma", opacity: 0.6, basemap: "dark" },
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    published: false,
  };
}

describe("migrateStory", () => {
  it("backfills layer_config.dataset_id from story.dataset_id", () => {
    const old = makeOldStory();
    const migrated = migrateStory(old);
    expect(migrated.chapters[0].layer_config.dataset_id).toBe("ds-abc");
    expect(migrated.chapters[1].layer_config.dataset_id).toBe("ds-abc");
  });

  it("adds dataset_ids array if missing", () => {
    const old = makeOldStory();
    const migrated = migrateStory(old);
    expect(migrated.dataset_ids).toEqual(["ds-abc"]);
  });

  it("does not modify already-migrated stories", () => {
    const modern: Story = {
      id: "s-2",
      title: "Modern",
      dataset_id: "ds-1",
      dataset_ids: ["ds-1", "ds-2"],
      chapters: [
        {
          id: "ch-1", order: 0, type: "scrollytelling" as const, title: "Ch1", narrative: "",
          map_state: { center: [0, 0], zoom: 2, bearing: 0, pitch: 0, basemap: "streets" },
          transition: "fly-to" as const,
          layer_config: { dataset_id: "ds-1", colormap: "viridis", opacity: 0.8, basemap: "streets" },
        },
        {
          id: "ch-2", order: 1, type: "scrollytelling" as const, title: "Ch2", narrative: "",
          map_state: { center: [10, 20], zoom: 5, bearing: 0, pitch: 0, basemap: "streets" },
          transition: "fly-to" as const,
          layer_config: { dataset_id: "ds-2", colormap: "plasma", opacity: 0.6, basemap: "dark" },
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      published: false,
    };
    const result = migrateStory(modern);
    expect(result.chapters[0].layer_config.dataset_id).toBe("ds-1");
    expect(result.chapters[1].layer_config.dataset_id).toBe("ds-2");
    expect(result.dataset_ids).toEqual(["ds-1", "ds-2"]);
  });

  it("handles stories with no chapters", () => {
    const empty = { ...makeOldStory(), chapters: [] };
    const migrated = migrateStory(empty);
    expect(migrated.dataset_ids).toEqual(["ds-abc"]);
    expect(migrated.chapters).toEqual([]);
  });

  it("backfills chapter type as scrollytelling when missing", () => {
    const old = makeOldStory();
    const migrated = migrateStory(old);
    expect(migrated.chapters[0].type).toBe("scrollytelling");
    expect(migrated.chapters[1].type).toBe("scrollytelling");
  });

  it("preserves existing chapter type", () => {
    const old = makeOldStory();
    old.chapters[0].type = "prose";
    const migrated = migrateStory(old);
    expect(migrated.chapters[0].type).toBe("prose");
    expect(migrated.chapters[1].type).toBe("scrollytelling");
  });
});
