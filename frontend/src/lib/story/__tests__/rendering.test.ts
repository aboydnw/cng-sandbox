import { describe, it, expect, vi } from "vitest";

// Mock the cogLayer module to avoid the broken @developmentseed/deck.gl-geotiff import
vi.mock("../../layers/cogLayer", () => ({
  buildCogLayerContinuous: vi.fn(() => []),
  buildCogLayerPaletted: vi.fn(() => []),
}));

// Mock buildConnectionTileUrl for connection tests
vi.mock("../../connections", () => ({
  buildConnectionTileUrl: (conn: import("../../../types").Connection) =>
    conn.url,
}));

const mockZarrLayer = vi.fn((_opts: unknown) => [{ id: "zarr-layer" }]);
vi.mock("../../layers/zarrLayer", () => ({
  buildZarrLayer: (opts: unknown) => mockZarrLayer(opts),
}));

import { buildLayersForChapter, groupChaptersIntoBlocks } from "../rendering";
import {
  createChapter,
  createMapChapter,
  createScrollytellingChapter,
  createFlyoverChapter,
  DEFAULT_LAYER_CONFIG,
} from "../types";
import type { OverlayConfig } from "../types";
import type { Dataset, Connection } from "../../../types";

const BASE_DATASET: Dataset = {
  id: "ds-1",
  filename: "test.tif",
  dataset_type: "raster",
  format_pair: "geotiff/cog",
  tile_url: "/raster/tiles/{z}/{x}/{y}",
  bounds: null,
  band_count: 1,
  band_names: null,
  color_interpretation: null,
  dtype: null,
  original_file_size: null,
  converted_file_size: null,
  geoparquet_file_size: null,
  feature_count: null,
  geometry_types: null,
  min_zoom: null,
  max_zoom: null,
  stac_collection_id: null,
  pg_table: null,
  parquet_url: null,
  cog_url: null,
  copc_url: null,
  point_count: null,
  validation_results: [],
  credits: [],
  created_at: "2024-01-01T00:00:00Z",
  is_temporal: false,
  timesteps: [],
  raster_min: null,
  raster_max: null,
  is_categorical: false,
  categories: null,
  crs: null,
  crs_name: null,
  pixel_width: null,
  pixel_height: null,
  resolution: null,
  compression: null,
  is_mosaic: false,
  is_zero_copy: false,
  is_shared: false,
  source_url: null,
  expires_at: null,
  preferred_colormap: null,
  preferred_colormap_reversed: null,
};

const TEMPORAL_DATASET: Dataset = {
  ...BASE_DATASET,
  is_temporal: true,
  timesteps: [
    { datetime: "2024-01-01T00:00:00Z", index: 0 },
    { datetime: "2024-02-01T00:00:00Z", index: 1 },
    { datetime: "2024-03-01T00:00:00Z", index: 2 },
  ],
};

describe("buildLayersForChapter — temporal timestep wiring", () => {
  it("appends datetime param for timestep index 2", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
        timestep: 2,
      },
    });
    const datasetMap = new Map<string, Dataset | null>([
      ["ds-1", TEMPORAL_DATASET],
    ]);

    const { layers } = buildLayersForChapter(chapter, datasetMap, undefined);

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("datetime=2024-03-01T00%3A00%3A00Z");
  });

  it("defaults to the first timestep when timestep is not set", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
      },
    });
    const datasetMap = new Map<string, Dataset | null>([
      ["ds-1", TEMPORAL_DATASET],
    ]);

    const { layers } = buildLayersForChapter(chapter, datasetMap, undefined);

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("datetime=2024-01-01T00%3A00%3A00Z");
  });

  it("does not append datetime for non-temporal datasets", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
        timestep: 1,
      },
    });
    const datasetMap = new Map<string, Dataset | null>([
      ["ds-1", BASE_DATASET],
    ]);

    const { layers } = buildLayersForChapter(chapter, datasetMap, undefined);

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).not.toContain("datetime=");
  });
});

describe("buildLayersForChapter — rescale and colormap_reversed overrides", () => {
  it("uses dataset defaults when rescale overrides absent", () => {
    const ds: Dataset = { ...BASE_DATASET, raster_min: 0, raster_max: 100 };
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
      },
    });
    const datasetMap = new Map<string, Dataset | null>([["ds-1", ds]]);

    const { layers } = buildLayersForChapter(chapter, datasetMap, undefined);

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("colormap_name=viridis");
    expect(tileUrl).toContain("rescale=0,100");
  });

  it("applies rescale_min/rescale_max overrides when present", () => {
    const ds: Dataset = { ...BASE_DATASET, raster_min: 0, raster_max: 100 };
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
        rescale_min: 10,
        rescale_max: 50,
      },
    });
    const datasetMap = new Map<string, Dataset | null>([["ds-1", ds]]);

    const { layers } = buildLayersForChapter(chapter, datasetMap, undefined);

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("rescale=10,50");
    expect(tileUrl).not.toContain("rescale=0,100");
  });

  it("appends _r to colormap when colormap_reversed is true", () => {
    const ds: Dataset = { ...BASE_DATASET };
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
        colormap_reversed: true,
      },
    });
    const datasetMap = new Map<string, Dataset | null>([["ds-1", ds]]);

    const { layers } = buildLayersForChapter(chapter, datasetMap, undefined);

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("colormap_name=viridis_r");
    expect(tileUrl).not.toContain("colormap_name=viridis&");
  });
});

const BASE_CONNECTION: Connection = {
  id: "conn-1",
  name: "Test COG",
  url: "/cog/tiles/{z}/{x}/{y}",
  connection_type: "cog",
  bounds: null,
  min_zoom: null,
  max_zoom: null,
  tile_type: "raster",
  band_count: 1,
  rescale: "0,200",
  workspace_id: null,
  created_at: "2024-01-01T00:00:00Z",
  is_categorical: false,
  categories: null,
  tile_url: null,
  render_path: null,
  conversion_status: null,
  conversion_error: null,
  feature_count: null,
  file_size: null,
  is_shared: false,
  preferred_colormap: null,
  preferred_colormap_reversed: null,
  config: null,
  geozarr_attrs: null,
};

describe("buildLayersForChapter — connection COG rescale and colormap_reversed", () => {
  it("uses connection rescale when layer overrides absent", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "conn-1",
        colormap: "plasma",
        opacity: 0.8,
        basemap: "streets",
      },
    });
    const datasetMap = new Map<string, Dataset | null>();
    const connectionMap = new Map([["conn-1", BASE_CONNECTION]]);

    const { layers } = buildLayersForChapter(
      chapter,
      datasetMap,
      connectionMap
    );

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("colormap_name=plasma");
    expect(tileUrl).toContain("rescale=0,200");
  });

  it("applies rescale_min/rescale_max overrides for COG connection", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "conn-1",
        colormap: "plasma",
        opacity: 0.8,
        basemap: "streets",
        rescale_min: 5,
        rescale_max: 80,
      },
    });
    const datasetMap = new Map<string, Dataset | null>();
    const connectionMap = new Map([["conn-1", BASE_CONNECTION]]);

    const { layers } = buildLayersForChapter(
      chapter,
      datasetMap,
      connectionMap
    );

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("rescale=5,80");
    expect(tileUrl).not.toContain("rescale=0,200");
  });

  it("appends _r to colormap when colormap_reversed is true for COG connection", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "conn-1",
        colormap: "plasma",
        opacity: 0.8,
        basemap: "streets",
        colormap_reversed: true,
      },
    });
    const datasetMap = new Map<string, Dataset | null>();
    const connectionMap = new Map([["conn-1", BASE_CONNECTION]]);

    const { layers } = buildLayersForChapter(
      chapter,
      datasetMap,
      connectionMap
    );

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).toContain("colormap_name=plasma_r");
  });
});

const ZARR_CONNECTION: Connection = {
  ...BASE_CONNECTION,
  id: "zarr-1",
  name: "Test Zarr",
  url: "https://example.com/store.zarr",
  connection_type: "zarr",
  tile_type: null,
  band_count: null,
  rescale: null,
  config: {
    variable: "precipitation",
    timeDim: "time",
    timesteps: [{ index: 0 }, { index: 1 }, { index: 2 }],
    extraDim: null,
    extraIndex: null,
    rescaleMin: 0,
    rescaleMax: 100,
  },
};

describe("buildLayersForChapter — zarr connection", () => {
  it("returns empty layers when zarrNodeMap is not provided", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "zarr-1",
        colormap: "viridis",
        opacity: 1,
        basemap: "positron",
      },
    });
    const { layers } = buildLayersForChapter(
      chapter,
      new Map(),
      new Map([["zarr-1", ZARR_CONNECTION]])
    );
    expect(layers).toHaveLength(0);
  });

  it("returns empty layers when node is not in zarrNodeMap", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "zarr-1",
        colormap: "viridis",
        opacity: 1,
        basemap: "positron",
      },
    });
    const fakeNode = {
      store: {},
    } as unknown as import("../../../hooks/useZarrNode").ZarrNode;
    const { layers } = buildLayersForChapter(
      chapter,
      new Map(),
      new Map([["zarr-1", ZARR_CONNECTION]]),
      new Map([["other-id", fakeNode]])
    );
    expect(layers).toHaveLength(0);
  });

  it("returns empty layers when connection has no variable in config", () => {
    const noVarConn: Connection = {
      ...ZARR_CONNECTION,
      config: { timeDim: "time" },
    };
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "zarr-1",
        colormap: "viridis",
        opacity: 1,
        basemap: "positron",
      },
    });
    const fakeNode = {
      store: {},
    } as unknown as import("../../../hooks/useZarrNode").ZarrNode;
    const { layers } = buildLayersForChapter(
      chapter,
      new Map(),
      new Map([["zarr-1", noVarConn]]),
      new Map([["zarr-1", fakeNode]])
    );
    expect(layers).toHaveLength(0);
  });

  it("calls buildZarrLayer with correct params when node is provided", () => {
    mockZarrLayer.mockClear();
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "zarr-1",
        colormap: "plasma",
        opacity: 0.7,
        basemap: "positron",
        timestep: 1,
      },
    });
    const fakeNode = {
      store: {},
    } as unknown as import("../../../hooks/useZarrNode").ZarrNode;
    const { layers } = buildLayersForChapter(
      chapter,
      new Map(),
      new Map([["zarr-1", ZARR_CONNECTION]]),
      new Map([["zarr-1", fakeNode]])
    );
    expect(layers.length).toBeGreaterThan(0);
    expect(mockZarrLayer).toHaveBeenCalledOnce();
    const callArgs = mockZarrLayer.mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >;
    expect(callArgs.variable).toBe("precipitation");
    expect(callArgs.colormapName).toBe("plasma");
    expect(callArgs.opacity).toBe(0.7);
    expect((callArgs.selection as Record<string, number>).time).toBe(1);
  });
});

describe("buildLayersForChapter with raster dataset", () => {
  it("renders a client-eligible raster chapter on the client", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "positron",
      },
    });
    const ds: Dataset = {
      ...BASE_DATASET,
      id: "ds-1",
      cog_url: "https://r2.example/ds.tif",
      bounds: [-10, -10, 10, 10],
      converted_file_size: 100 * 1024 * 1024,
      dtype: "float32",
    };
    const { layers, renderMetadata } = buildLayersForChapter(
      chapter,
      new Map([["ds-1", ds]]),
      undefined
    );
    expect(layers).toBeDefined();
    expect(renderMetadata).toBeDefined();
    expect(renderMetadata?.renderMode).toBe("client");
  });

  it("returns no renderMetadata for a vector dataset chapter", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-vec",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "positron",
      },
    });
    const ds: Dataset = {
      ...BASE_DATASET,
      id: "ds-vec",
      dataset_type: "vector",
      tile_url: "/vector/tiles/{z}/{x}/{y}",
    };
    const { layers, renderMetadata } = buildLayersForChapter(
      chapter,
      new Map([["ds-vec", ds]]),
      undefined
    );
    expect(layers.length).toBeGreaterThan(0);
    expect(renderMetadata).toBeUndefined();
  });
});

describe("buildLayersForChapter — copc point clouds", () => {
  const COPC_CONNECTION: Connection = {
    ...BASE_CONNECTION,
    id: "conn-copc",
    name: "Autzen",
    url: "https://example.com/a.copc.laz",
    connection_type: "copc",
    tile_type: null,
  };

  it("yields no deck.gl layers for a copc connection chapter", () => {
    const chapter = createChapter({
      layer_config: {
        dataset_id: "",
        connection_id: "conn-copc",
        colormap: "viridis",
        opacity: 1,
        basemap: "streets",
      },
    });
    const { layers, renderMetadata } = buildLayersForChapter(
      chapter,
      new Map<string, Dataset | null>(),
      new Map([["conn-copc", COPC_CONNECTION]])
    );
    expect(layers).toEqual([]);
    expect(renderMetadata?.reason).toBe("point cloud");
  });

  it("yields no deck.gl layers for a pointcloud dataset chapter", () => {
    const ds: Dataset = {
      ...BASE_DATASET,
      id: "ds-pc",
      dataset_type: "pointcloud",
      copc_url: "/storage/datasets/ds-pc/converted/data.copc.laz",
    };
    const chapter = createChapter({
      layer_config: {
        dataset_id: "ds-pc",
        colormap: "viridis",
        opacity: 1,
        basemap: "streets",
      },
    });
    const { layers, renderMetadata } = buildLayersForChapter(
      chapter,
      new Map<string, Dataset | null>([["ds-pc", ds]]),
      undefined
    );
    expect(layers).toEqual([]);
    expect(renderMetadata?.reason).toBe("point cloud");
  });
});

describe("flyover blocks and layers", () => {
  it("groupChaptersIntoBlocks emits a flyover block that breaks a scrolly run", () => {
    const chapters = [
      createScrollytellingChapter({ order: 0 }),
      createFlyoverChapter({ order: 1 }),
      createScrollytellingChapter({ order: 2 }),
    ];
    const blocks = groupChaptersIntoBlocks(chapters);
    expect(blocks.map((b) => b.type)).toEqual([
      "scrollytelling",
      "flyover",
      "scrollytelling",
    ]);
    const fly = blocks[1];
    if (fly.type === "flyover") expect(fly.index).toBe(1);
  });

  it("buildLayersForChapter returns no layers for a flyover without layer_config", () => {
    const result = buildLayersForChapter(
      createFlyoverChapter(),
      new Map(),
      new Map()
    );
    expect(result.layers).toEqual([]);
  });

  it("buildLayersForChapter builds layers for a flyover with a vector dataset", () => {
    const ds: Dataset = {
      ...BASE_DATASET,
      id: "ds-vec-fly",
      dataset_type: "vector",
      tile_url: "/vector/tiles/{z}/{x}/{y}",
    };
    const ch = createFlyoverChapter({
      layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: ds.id },
    });
    const result = buildLayersForChapter(ch, new Map([[ds.id, ds]]), new Map());
    expect(result.layers.length).toBeGreaterThan(0);
  });
});

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function createMapChapterWithOverlays(opts: {
  layer_config: typeof DEFAULT_LAYER_CONFIG;
  overlays: OverlayConfig[];
}) {
  return createMapChapter({
    layer_config: opts.layer_config,
    overlays: opts.overlays,
  });
}

describe("buildLayersForChapter overlays", () => {
  const rasterPrimary: Dataset = {
    ...BASE_DATASET,
    id: "ds-r",
    dataset_type: "raster",
  };
  const vectorOverlay: Dataset = {
    ...BASE_DATASET,
    id: "ds-v",
    dataset_type: "vector",
    tile_url: "/vector/tiles/{z}/{x}/{y}",
    band_count: null,
  };

  const datasetMap = new Map<string, Dataset | null>([
    ["ds-r", rasterPrimary],
    ["ds-v", vectorOverlay],
  ]);

  it("appends one layer per visible overlay after the primary", () => {
    const chapter = createMapChapterWithOverlays({
      layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: "ds-r" },
      overlays: [
        {
          dataset_id: "ds-v",
          opacity: 1,
          stroke_color: "#ff0000",
          visible: true,
        },
      ],
    });
    const { layers } = buildLayersForChapter(chapter, datasetMap);
    expect(layers.length).toBeGreaterThanOrEqual(2);
    const overlayLayer = layers[layers.length - 1] as unknown as {
      props: { getLineColor: [number, number, number, number] };
    };
    expect(overlayLayer.props.getLineColor).toEqual([
      ...hexToRgb("#ff0000"),
      255,
    ]);
  });

  it("skips invisible overlays", () => {
    const chapter = createMapChapterWithOverlays({
      layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: "ds-r" },
      overlays: [{ dataset_id: "ds-v", opacity: 1, visible: false }],
    });
    const before = buildLayersForChapter(
      { ...chapter, overlays: [] } as typeof chapter,
      datasetMap
    ).layers.length;
    const { layers } = buildLayersForChapter(chapter, datasetMap);
    expect(layers.length).toBe(before);
  });

  it("skips overlays whose reference does not resolve", () => {
    const chapter = createMapChapterWithOverlays({
      layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: "ds-r" },
      overlays: [{ dataset_id: "missing", opacity: 1, visible: true }],
    });
    const { layers } = buildLayersForChapter(chapter, datasetMap);
    const before = buildLayersForChapter(
      { ...chapter, overlays: [] } as typeof chapter,
      datasetMap
    ).layers.length;
    expect(layers.length).toBe(before);
  });
});
