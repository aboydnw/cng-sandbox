import { describe, expect, it } from "vitest";
import { createChapter, createStory, DEFAULT_LAYER_CONFIG } from "../types";

describe("createChapter — preferred colormap snapshot", () => {
  it("uses DEFAULT_LAYER_CONFIG.colormap when no preferred colormap is provided", () => {
    const ch = createChapter();
    expect(ch.layer_config.colormap).toBe(DEFAULT_LAYER_CONFIG.colormap);
  });

  it("accepts an explicit layer_config override (backward compat)", () => {
    const ch = createChapter({
      layer_config: {
        ...DEFAULT_LAYER_CONFIG,
        colormap: "plasma",
      },
    });
    expect(ch.layer_config.colormap).toBe("plasma");
  });
});

describe("createStory — first chapter picks up preferred colormap", () => {
  it("snapshots preferredColormap into the first chapter's layer_config", () => {
    const story = createStory("ds-abc", {
      preferredColormap: "terrain",
      preferredColormapReversed: false,
    });
    expect(story.chapters[0].layer_config.colormap).toBe("terrain");
    expect(story.chapters[0].layer_config.colormap_reversed).toBe(false);
    expect(story.chapters[0].layer_config.dataset_id).toBe("ds-abc");
  });

  it("falls back to DEFAULT_LAYER_CONFIG when no preference is provided", () => {
    const story = createStory("ds-abc");
    expect(story.chapters[0].layer_config.colormap).toBe(
      DEFAULT_LAYER_CONFIG.colormap
    );
    expect(story.chapters[0].layer_config.colormap_reversed).toBe(undefined);
  });
});
