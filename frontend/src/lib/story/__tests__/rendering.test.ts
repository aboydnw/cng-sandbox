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

import { buildLayersForChapter } from "../rendering";
import { createChapter } from "../types";
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
