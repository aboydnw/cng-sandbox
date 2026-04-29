import { describe, it, expect } from "vitest";
import { cngRcToStory, pickLayerUrl } from "../cngRcAdapter";
import type { CngRcConfig, CngRcLayer } from "../cngRcTypes";

function makeLayer(overrides: Partial<CngRcLayer> = {}): CngRcLayer {
  return {
    type: "raster-cog",
    source_url: null,
    cng_url: null,
    label: null,
    attribution: null,
    render: {
      colormap: null,
      rescale: null,
      opacity: 1,
      band: null,
      timestep: null,
    },
    ...overrides,
  };
}

function makeConfig(overrides: Partial<CngRcConfig> = {}): CngRcConfig {
  return {
    version: "1",
    origin: {
      story_id: "story-abc",
      workspace_id: "ws-1",
      exported_at: "2026-04-28T00:00:00Z",
    },
    metadata: {
      title: "Sample Story",
      description: "A description",
      author: null,
      created: "2026-04-20T00:00:00Z",
      updated: "2026-04-21T00:00:00Z",
    },
    chapters: [],
    layers: {},
    assets: {},
    ...overrides,
  };
}

describe("pickLayerUrl", () => {
  it("prefers source_url over cng_url", () => {
    const layer = makeLayer({
      source_url: "https://example.com/source.tif",
      cng_url: "https://example.com/cng.tif",
    });
    expect(pickLayerUrl(layer)).toBe("https://example.com/source.tif");
  });

  it("falls back to cng_url when source_url is null", () => {
    const layer = makeLayer({
      source_url: null,
      cng_url: "https://example.com/cng.tif",
    });
    expect(pickLayerUrl(layer)).toBe("https://example.com/cng.tif");
  });

  it("returns null when both URLs are missing", () => {
    expect(pickLayerUrl(makeLayer())).toBeNull();
  });
});

describe("cngRcToStory", () => {
  it("preserves story id, title, description, published, and timestamps", () => {
    const config = makeConfig();
    const { story } = cngRcToStory(config);
    expect(story.id).toBe("story-abc");
    expect(story.title).toBe("Sample Story");
    expect(story.description).toBe("A description");
    expect(story.published).toBe(true);
    expect(story.created_at).toBe("2026-04-20T00:00:00Z");
    expect(story.updated_at).toBe("2026-04-21T00:00:00Z");
    expect(story.dataset_id).toBeNull();
    expect(story.dataset_ids).toEqual([]);
  });

  it("maps null description to undefined on the story", () => {
    const config = makeConfig({
      metadata: {
        title: "Sample Story",
        description: null,
        author: null,
        created: "2026-04-20T00:00:00Z",
        updated: "2026-04-21T00:00:00Z",
      },
    });
    const { story } = cngRcToStory(config);
    expect(story.description).toBeUndefined();
  });

  it("converts a scrollytelling chapter with map_state and layer_config", () => {
    const config = makeConfig({
      chapters: [
        {
          id: "ch-1",
          type: "scrollytelling",
          title: "Chapter 1",
          body: "Some narrative",
          map: { center: [10, 20], zoom: 5, bearing: 30, pitch: 40 },
          layers: ["primary"],
        },
      ],
      layers: {
        primary: makeLayer({
          type: "raster-cog",
          source_url: "https://example.com/data.tif",
          label: "Primary",
          render: {
            colormap: "magma",
            rescale: [0, 100],
            opacity: 0.6,
            band: 2,
            timestep: "3",
          },
        }),
      },
    });

    const { story } = cngRcToStory(config);
    expect(story.chapters).toHaveLength(1);
    const chapter = story.chapters[0];
    expect(chapter.type).toBe("scrollytelling");
    expect(chapter.id).toBe("ch-1");
    expect(chapter.title).toBe("Chapter 1");
    expect(chapter.narrative).toBe("Some narrative");
    expect(chapter.order).toBe(0);
    if (chapter.type !== "scrollytelling")
      throw new Error("expected scrollytelling");
    expect(chapter.map_state.center).toEqual([10, 20]);
    expect(chapter.map_state.zoom).toBe(5);
    expect(chapter.map_state.bearing).toBe(30);
    expect(chapter.map_state.pitch).toBe(40);
    expect(chapter.map_state.basemap).toBe("streets");
    expect(chapter.layer_config.connection_id).toBe("portable-primary");
    expect(chapter.layer_config.colormap).toBe("magma");
    expect(chapter.layer_config.opacity).toBe(0.6);
    expect(chapter.layer_config.band).toBe(2);
    expect(chapter.layer_config.timestep).toBe(3);
    expect(chapter.layer_config.rescale_min).toBe(0);
    expect(chapter.layer_config.rescale_max).toBe(100);
    expect(chapter.layer_config.dataset_id).toBe("");
  });

  it("synthesizes a Connection for each layer with a usable URL", () => {
    const config = makeConfig({
      layers: {
        cogLayer: makeLayer({
          type: "raster-cog",
          source_url: "https://example.com/a.tif",
          label: "COG",
        }),
        gpqLayer: makeLayer({
          type: "vector-geoparquet",
          source_url: "https://example.com/a.parquet",
        }),
        pmtilesLayer: makeLayer({
          type: "pmtiles",
          source_url: "https://example.com/a.pmtiles",
        }),
        xyzLayer: makeLayer({
          type: "xyz",
          source_url: "https://tiles.example/{z}/{x}/{y}.png",
        }),
      },
    });

    const { connections } = cngRcToStory(config);

    const cog = connections.get("portable-cogLayer");
    expect(cog).toBeDefined();
    expect(cog!.connection_type).toBe("cog");
    expect(cog!.tile_type).toBe("raster");
    expect(cog!.url).toBe("https://example.com/a.tif");
    expect(cog!.name).toBe("COG");
    expect(cog!.render_path).toBe("client");
    expect(cog!.conversion_status).toBe("ready");

    const gpq = connections.get("portable-gpqLayer");
    expect(gpq).toBeDefined();
    expect(gpq!.connection_type).toBe("geoparquet");
    expect(gpq!.tile_type).toBe("vector");
    expect(gpq!.url).toBe("https://example.com/a.parquet");
    expect(gpq!.tile_url).toBe("https://example.com/a.parquet");

    const pmt = connections.get("portable-pmtilesLayer");
    expect(pmt).toBeDefined();
    expect(pmt!.connection_type).toBe("pmtiles");

    const xyz = connections.get("portable-xyzLayer");
    expect(xyz).toBeDefined();
    expect(xyz!.connection_type).toBe("xyz_raster");
    expect(xyz!.tile_type).toBe("raster");
  });

  it("skips connection synthesis when both URLs are missing", () => {
    const config = makeConfig({
      layers: {
        broken: makeLayer({ source_url: null, cng_url: null }),
      },
      chapters: [
        {
          id: "ch-skip",
          type: "scrollytelling",
          title: "Skip",
          body: "",
          map: null,
          layers: ["broken"],
        },
      ],
    });

    const { connections, story } = cngRcToStory(config);
    expect(connections.has("portable-broken")).toBe(false);
    const chapter = story.chapters[0];
    if (chapter.type !== "scrollytelling")
      throw new Error("expected scrollytelling");
    expect(chapter.layer_config.connection_id).toBeUndefined();
  });

  it("uses cng_url when source_url is missing for synthesized connection", () => {
    const config = makeConfig({
      layers: {
        only_cng: makeLayer({
          source_url: null,
          cng_url: "https://cng.example/file.tif",
        }),
      },
    });
    const { connections } = cngRcToStory(config);
    expect(connections.get("portable-only_cng")?.url).toBe(
      "https://cng.example/file.tif"
    );
  });

  it("falls back to prose for asset-bearing chapter types until asset wiring lands", () => {
    const config = makeConfig({
      chapters: [
        {
          id: "ch-img",
          type: "image",
          title: "An image",
          body: "Image body",
          map: null,
          layers: [],
        },
        {
          id: "ch-vid",
          type: "video",
          title: "A video",
          body: "Video body",
          map: null,
          layers: [],
        },
        {
          id: "ch-chart",
          type: "chart",
          title: "A chart",
          body: "Chart body",
          map: null,
          layers: [],
        },
      ],
    });
    const { story } = cngRcToStory(config);
    expect(story.chapters).toHaveLength(3);
    expect(story.chapters.every((c) => c.type === "prose")).toBe(true);
    expect(story.chapters[0].title).toBe("An image");
    expect(story.chapters[0].narrative).toBe("Image body");
    expect(story.chapters[1].title).toBe("A video");
    expect(story.chapters[2].narrative).toBe("Chart body");
  });

  it("produces a default layer_config when a map chapter has no layers", () => {
    const config = makeConfig({
      chapters: [
        {
          id: "ch-empty-layers",
          type: "map",
          title: "Empty layers",
          body: null,
          map: null,
          layers: [],
        },
      ],
    });
    const { story } = cngRcToStory(config);
    const chapter = story.chapters[0];
    if (chapter.type !== "map") throw new Error("expected map");
    expect(chapter.layer_config.dataset_id).toBe("");
    expect(chapter.layer_config.connection_id).toBeUndefined();
  });

  it("uses DEFAULT_MAP_STATE when chapter has no map", () => {
    const config = makeConfig({
      chapters: [
        {
          id: "ch-nomap",
          type: "map",
          title: "No map",
          body: null,
          map: null,
          layers: [],
        },
      ],
    });
    const { story } = cngRcToStory(config);
    const chapter = story.chapters[0];
    if (chapter.type !== "map") throw new Error("expected map");
    expect(chapter.map_state.center).toEqual([0, 0]);
    expect(chapter.map_state.zoom).toBe(2);
  });

  it("converts a prose chapter with title and body", () => {
    const config = makeConfig({
      chapters: [
        {
          id: "p-1",
          type: "prose",
          title: "Intro",
          body: "Just text.",
          map: null,
          layers: [],
        },
      ],
    });
    const { story } = cngRcToStory(config);
    expect(story.chapters[0].type).toBe("prose");
    expect(story.chapters[0].title).toBe("Intro");
    expect(story.chapters[0].narrative).toBe("Just text.");
  });

  it("orders chapters by their array index", () => {
    const config = makeConfig({
      chapters: [
        {
          id: "a",
          type: "prose",
          title: null,
          body: null,
          map: null,
          layers: [],
        },
        {
          id: "b",
          type: "prose",
          title: null,
          body: null,
          map: null,
          layers: [],
        },
        {
          id: "c",
          type: "prose",
          title: null,
          body: null,
          map: null,
          layers: [],
        },
      ],
    });
    const { story } = cngRcToStory(config);
    expect(story.chapters.map((c) => c.order)).toEqual([0, 1, 2]);
  });
});
