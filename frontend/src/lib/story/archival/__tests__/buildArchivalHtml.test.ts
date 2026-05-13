import { describe, it, expect, vi } from "vitest";
import { buildArchivalHtml } from "../buildArchivalHtml";
import type { CngRcConfig } from "../../cngRcTypes";
import type { Story } from "../../types";
import {
  createMapChapter,
  createProseChapter,
  createScrollytellingChapter,
} from "../../types";

vi.mock("../captureMap", () => ({
  captureChapterMap: vi
    .fn()
    .mockResolvedValue("data:image/png;base64,iVBORw0KGgo="),
}));

vi.mock("../inlineAsset", () => ({
  fetchAndInlineAsBase64: vi
    .fn()
    .mockResolvedValue("data:image/jpeg;base64,/9j/4AAQ"),
}));

function makeStory(chapters: Story["chapters"]): Story {
  return {
    id: "s1",
    title: "T",
    dataset_id: null,
    dataset_ids: [],
    chapters,
    created_at: "",
    updated_at: "",
    published: false,
  };
}

const emptyMaps = {
  datasetMap: new Map(),
  connectionMap: new Map(),
};

describe("buildArchivalHtml", () => {
  it("emits Dublin Core meta tags from story metadata", async () => {
    const config: CngRcConfig = {
      version: "1",
      origin: {
        story_id: "s1",
        workspace_id: null,
        exported_at: "2026-04-29T00:00:00Z",
      },
      metadata: {
        title: "Coastal Erosion 2024",
        description: "Analysis of shoreline change",
        author: "Dr. Smith",
        created: "2026-01-01T00:00:00Z",
        updated: "2026-04-28T00:00:00Z",
      },
      chapters: [],
      layers: {},
      assets: {},
    };

    const html = await buildArchivalHtml({
      config,
      story: makeStory([]),
      ...emptyMaps,
    });
    expect(html).toContain(
      '<meta name="dc.title" content="Coastal Erosion 2024">'
    );
    expect(html).toContain('<meta name="dc.creator" content="Dr. Smith">');
    expect(html).toContain(
      '<meta name="dc.date" content="2026-04-28T00:00:00Z">'
    );
  });

  it("renders prose chapters as inline HTML", async () => {
    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s1", workspace_id: null, exported_at: "" },
      metadata: {
        title: "T",
        description: null,
        author: null,
        created: "",
        updated: "",
      },
      chapters: [
        {
          id: "c1",
          type: "prose",
          title: "Introduction",
          body: "Hello **world**.",
          map: null,
          layers: [],
        },
      ],
      layers: {},
      assets: {},
    };

    const story = makeStory([
      createProseChapter({
        id: "c1",
        title: "Introduction",
        narrative: "Hello **world**.",
      }),
    ]);

    const html = await buildArchivalHtml({ config, story, ...emptyMaps });
    expect(html).toContain("Introduction");
    expect(html).toContain("Hello");
    expect(html).toContain("<strong>world</strong>");
  });

  it("inlines map snapshots as base64 PNG <img> tags", async () => {
    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s1", workspace_id: null, exported_at: "" },
      metadata: {
        title: "T",
        description: null,
        author: null,
        created: "",
        updated: "",
      },
      chapters: [
        {
          id: "c1",
          type: "map",
          title: "Map",
          body: null,
          map: { center: [0, 0], zoom: 5, bearing: 0, pitch: 0 },
          layers: ["l1"],
        },
      ],
      layers: {},
      assets: {},
    };

    const story = makeStory([createMapChapter({ id: "c1", title: "Map" })]);

    const html = await buildArchivalHtml({ config, story, ...emptyMaps });
    expect(html).toContain('src="data:image/png;base64,');
  });

  it("propagates errors from captureChapterMap (no silent fallback)", async () => {
    const { captureChapterMap } = await import("../captureMap");
    (captureChapterMap as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Chapter snapshot timed out after 30s")
    );

    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s1", workspace_id: null, exported_at: "" },
      metadata: {
        title: "T",
        description: null,
        author: null,
        created: "",
        updated: "",
      },
      chapters: [
        {
          id: "ch",
          type: "scrollytelling",
          title: "X",
          body: "",
          layers: [],
          map: { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 },
        },
      ],
      layers: {},
      assets: {},
    };

    const story = makeStory([
      createScrollytellingChapter({ id: "ch", title: "X" }),
    ]);

    await expect(
      buildArchivalHtml({ config, story, ...emptyMaps })
    ).rejects.toThrow(/timed out/);
  });

  it("uses video thumbnail for video chapters (per spec)", async () => {
    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s1", workspace_id: null, exported_at: "" },
      metadata: {
        title: "T",
        description: null,
        author: null,
        created: "",
        updated: "",
      },
      chapters: [
        {
          id: "c1",
          type: "video",
          title: "Field Video",
          body: null,
          map: null,
          layers: [],
          extra: {
            video_url: "https://example.com/v.mp4",
            thumbnail_url: "https://example.com/v.jpg",
          },
        },
      ],
      layers: {},
      assets: {},
    };

    const html = await buildArchivalHtml({
      config,
      story: makeStory([]),
      ...emptyMaps,
    });
    expect(html).toContain('src="data:image/jpeg;base64,');
    expect(html).toContain("https://example.com/v.mp4");
    expect(html).not.toContain("<video");
  });

  it("includes the citations block at the bottom", async () => {
    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s1", workspace_id: null, exported_at: "" },
      metadata: {
        title: "T",
        description: null,
        author: null,
        created: "",
        updated: "",
      },
      chapters: [],
      layers: {
        l1: {
          type: "raster-cog",
          source_url: "https://example.com/data.tif",
          cng_url: null,
          label: "Test layer",
          attribution: "Test attribution",
          render: {
            colormap: null,
            rescale: null,
            opacity: 1,
            band: null,
            timestep: null,
          },
        },
      },
      assets: {},
    };

    const html = await buildArchivalHtml({
      config,
      story: makeStory([]),
      ...emptyMaps,
    });
    expect(html).toContain("Data citations");
    expect(html).toContain("Test layer");
    expect(html).toContain("https://example.com/data.tif");
  });
});
