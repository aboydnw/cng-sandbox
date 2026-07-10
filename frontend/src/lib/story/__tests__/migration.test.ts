import { describe, it, expect } from "vitest";
import { migrateStory } from "../migration";
import { chapterAllowsTerrain } from "../terrainPolicy";
import type { Story } from "../types";

function makeOldStory(): Record<string, unknown> {
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
        map_state: {
          center: [0, 0],
          zoom: 2,
          bearing: 0,
          pitch: 0,
          basemap: "streets",
        },
        transition: "fly-to",
        layer_config: { colormap: "viridis", opacity: 0.8, basemap: "streets" },
      },
      {
        id: "ch-2",
        order: 1,
        title: "Chapter 2",
        narrative: "World",
        map_state: {
          center: [10, 20],
          zoom: 5,
          bearing: 0,
          pitch: 0,
          basemap: "streets",
        },
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
    const ch0 = migrated.chapters[0];
    const ch1 = migrated.chapters[1];
    expect(ch0.type === "scrollytelling" && ch0.layer_config.dataset_id).toBe(
      "ds-abc"
    );
    expect(ch1.type === "scrollytelling" && ch1.layer_config.dataset_id).toBe(
      "ds-abc"
    );
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
          id: "ch-1",
          order: 0,
          type: "scrollytelling" as const,
          title: "Ch1",
          narrative: "",
          map_state: {
            center: [0, 0],
            zoom: 2,
            bearing: 0,
            pitch: 0,
            basemap: "streets",
          },
          transition: "fly-to" as const,
          overlay_position: "left" as const,
          layer_config: {
            dataset_id: "ds-1",
            colormap: "viridis",
            opacity: 0.8,
            basemap: "streets",
          },
        },
        {
          id: "ch-2",
          order: 1,
          type: "scrollytelling" as const,
          title: "Ch2",
          narrative: "",
          map_state: {
            center: [10, 20],
            zoom: 5,
            bearing: 0,
            pitch: 0,
            basemap: "streets",
          },
          transition: "fly-to" as const,
          overlay_position: "left" as const,
          layer_config: {
            dataset_id: "ds-2",
            colormap: "plasma",
            opacity: 0.6,
            basemap: "dark",
          },
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      published: false,
    };
    const result = migrateStory(modern as unknown as Record<string, unknown>);
    const r0 = result.chapters[0];
    const r1 = result.chapters[1];
    expect(r0.type === "scrollytelling" && r0.layer_config.dataset_id).toBe(
      "ds-1"
    );
    expect(r1.type === "scrollytelling" && r1.layer_config.dataset_id).toBe(
      "ds-2"
    );
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
    (old.chapters as Record<string, unknown>[])[0].type = "prose";
    const migrated = migrateStory(old);
    expect(migrated.chapters[0].type).toBe("prose");
    expect(migrated.chapters[1].type).toBe("scrollytelling");
  });

  it("backfills overlay_position as left when missing", () => {
    const old = makeOldStory();
    const migrated = migrateStory(old);
    const m0 = migrated.chapters[0];
    const m1 = migrated.chapters[1];
    expect(m0.type === "scrollytelling" && m0.overlay_position).toBe("left");
    expect(m1.type === "scrollytelling" && m1.overlay_position).toBe("left");
  });

  it("preserves existing overlay_position", () => {
    const old = makeOldStory();
    (old.chapters as Record<string, unknown>[])[1].overlay_position = "right";
    const migrated = migrateStory(old);
    const m0 = migrated.chapters[0];
    const m1 = migrated.chapters[1];
    expect(m0.type === "scrollytelling" && m0.overlay_position).toBe("left");
    expect(m1.type === "scrollytelling" && m1.overlay_position).toBe("right");
  });

  it("strips map_state and layer_config from prose chapters during migration", () => {
    const old = {
      chapters: [
        {
          id: "a",
          order: 0,
          type: "prose",
          title: "Intro",
          narrative: "Hello",
          // legacy stored map_state/layer_config that should be dropped
          map_state: {
            center: [0, 0],
            zoom: 2,
            bearing: 0,
            pitch: 0,
            basemap: "streets",
          },
          layer_config: {
            dataset_id: "x",
            colormap: "viridis",
            opacity: 0.8,
            basemap: "streets",
          },
        },
      ],
    } as Record<string, unknown>;

    const migrated = migrateStory(old);
    expect(migrated.chapters[0].type).toBe("prose");
    expect("map_state" in migrated.chapters[0]).toBe(false);
    expect("layer_config" in migrated.chapters[0]).toBe(false);
  });

  it("does not backfill the story dataset into chapters with an explicit null layer_config", () => {
    const old = {
      id: "s-3",
      dataset_id: "ds-gebco",
      chapters: [
        {
          id: "scene",
          order: 0,
          type: "scrollytelling",
          title: "The Himalaya",
          narrative: "",
          map_state: {
            center: [86.925, 27.988],
            zoom: 9,
            bearing: 20,
            pitch: 68,
            basemap: "streets",
            terrain: { enabled: true, exaggeration: 1.5 },
          },
          transition: "fly-to",
          overlay_position: "left",
          layer_config: null,
        },
      ],
    } as Record<string, unknown>;

    const migrated = migrateStory(old);
    const ch = migrated.chapters[0];
    expect(ch.type).toBe("scrollytelling");
    if (ch.type === "scrollytelling") {
      expect(ch.layer_config.dataset_id).toBe("");
      expect(ch.layer_config.connection_id).toBeUndefined();
    }
  });

  it("still backfills the story dataset when layer_config is absent (legacy story)", () => {
    const old = {
      id: "s-4",
      dataset_id: "ds-legacy",
      chapters: [
        {
          id: "legacy",
          order: 0,
          title: "Legacy",
          narrative: "",
          map_state: {
            center: [0, 0],
            zoom: 2,
            bearing: 0,
            pitch: 0,
            basemap: "streets",
          },
          transition: "fly-to",
        },
      ],
    } as Record<string, unknown>;

    const migrated = migrateStory(old);
    const ch = migrated.chapters[0];
    expect(ch.type === "scrollytelling" && ch.layer_config.dataset_id).toBe(
      "ds-legacy"
    );
  });

  it("keeps terrain allowed on seeded scene chapters after migration", () => {
    const seeded = {
      id: "high-places",
      title: "Earth's high places",
      dataset_id: "ds-gebco",
      chapters: [
        {
          id: "globe",
          order: 0,
          type: "scrollytelling",
          title: "One planet, seen whole",
          narrative: "",
          map_state: {
            center: [80, 20],
            zoom: 1.7,
            bearing: 0,
            pitch: 0,
            basemap: "streets",
            globe: true,
          },
          transition: "fly-to",
          overlay_position: "left",
          layer_config: null,
        },
        {
          id: "himalaya",
          order: 1,
          type: "scrollytelling",
          title: "The Himalaya",
          narrative: "",
          map_state: {
            center: [86.925, 27.988],
            zoom: 9,
            bearing: 20,
            pitch: 68,
            basemap: "streets",
            terrain: { enabled: true, exaggeration: 1.5 },
          },
          transition: "fly-to",
          overlay_position: "left",
          layer_config: null,
        },
        {
          id: "data",
          order: 2,
          type: "scrollytelling",
          title: "Global relief",
          narrative: "",
          map_state: {
            center: [0, 0],
            zoom: 2,
            bearing: 0,
            pitch: 0,
            basemap: "streets",
          },
          transition: "fly-to",
          overlay_position: "left",
          layer_config: {
            dataset_id: "ds-gebco",
            colormap: "gist_earth",
            opacity: 0.9,
            basemap: "streets",
          },
        },
      ],
    } as Record<string, unknown>;

    const migrated = migrateStory(seeded);
    const [globe, himalaya, data] = migrated.chapters;
    if (
      globe.type !== "scrollytelling" ||
      himalaya.type !== "scrollytelling" ||
      data.type !== "scrollytelling"
    ) {
      throw new Error("expected scrollytelling chapters");
    }
    expect(chapterAllowsTerrain(globe.layer_config)).toBe(true);
    expect(chapterAllowsTerrain(himalaya.layer_config)).toBe(true);
    expect(himalaya.map_state.terrain).toEqual({
      enabled: true,
      exaggeration: 1.5,
    });
    expect(globe.map_state.globe).toBe(true);
    expect(chapterAllowsTerrain(data.layer_config)).toBe(false);
  });

  it("preserves map_state and layer_config on scrollytelling and map chapters", () => {
    const old = {
      chapters: [
        {
          id: "a",
          order: 0,
          type: "scrollytelling",
          title: "A",
          narrative: "",
          map_state: {
            center: [10, 20],
            zoom: 5,
            bearing: 0,
            pitch: 0,
            basemap: "streets",
          },
          layer_config: {
            dataset_id: "x",
            colormap: "viridis",
            opacity: 0.8,
            basemap: "streets",
          },
          transition: "fly-to",
          overlay_position: "left",
        },
      ],
    } as Record<string, unknown>;

    const migrated = migrateStory(old);
    const ch = migrated.chapters[0];
    expect(ch.type).toBe("scrollytelling");
    if (ch.type === "scrollytelling") {
      expect(ch.map_state.zoom).toBe(5);
      expect(ch.layer_config.dataset_id).toBe("x");
    }
  });
});

describe("flyover migration", () => {
  const rawFlyover = {
    id: "fly-1",
    order: 2,
    type: "flyover",
    title: "Around the peak",
    narrative: "",
    keyframes: [
      { center: [86.9, 27.9], zoom: 11, bearing: 0, pitch: 60, caption: "hi" },
      { center: [86.95, 28.0], zoom: 11, bearing: 90, pitch: 60 },
    ],
    scroll_length: 1.5,
    map_state: {
      center: [86.9, 27.9],
      zoom: 11,
      bearing: 0,
      pitch: 60,
      basemap: "streets",
      terrain: { enabled: true, exaggeration: 1.5 },
    },
  };

  it("preserves flyover chapters through migration", () => {
    const migrated = migrateStory({
      id: "s-f",
      dataset_id: null,
      chapters: [rawFlyover],
    });
    const ch = migrated.chapters[0];
    expect(ch.type).toBe("flyover");
    if (ch.type === "flyover") {
      expect(ch.keyframes).toHaveLength(2);
      expect(ch.keyframes[0].caption).toBe("hi");
      expect(ch.scroll_length).toBe(1.5);
      expect(ch.map_state.terrain).toEqual({
        enabled: true,
        exaggeration: 1.5,
      });
    }
  });

  it("does NOT backfill story dataset_id into flyover layer_config (terrain trap)", () => {
    const migrated = migrateStory({
      id: "s-f2",
      dataset_id: "ds-abc",
      chapters: [rawFlyover],
    });
    const ch = migrated.chapters[0];
    expect(ch.type).toBe("flyover");
    expect((ch as { layer_config?: unknown }).layer_config).toBeUndefined();
  });

  it("keeps an explicit flyover layer_config that names a dataset", () => {
    const migrated = migrateStory({
      id: "s-f3",
      dataset_id: "ds-abc",
      chapters: [
        {
          ...rawFlyover,
          layer_config: {
            dataset_id: "ds-real",
            colormap: "viridis",
            opacity: 0.8,
            basemap: "streets",
          },
        },
      ],
    });
    const ch = migrated.chapters[0];
    if (ch.type === "flyover") {
      expect(ch.layer_config?.dataset_id).toBe("ds-real");
    }
    expect(migrated.dataset_ids).toContain("ds-real");
  });

  it("drops malformed keyframes and defaults scroll_length", () => {
    const migrated = migrateStory({
      chapters: [
        {
          ...rawFlyover,
          keyframes: [rawFlyover.keyframes[0], { zoom: "bad" }, null],
          scroll_length: -2,
        },
      ],
    });
    const ch = migrated.chapters[0];
    if (ch.type === "flyover") {
      expect(ch.keyframes).toHaveLength(1);
      expect(ch.scroll_length).toBe(1);
    }
  });
});
