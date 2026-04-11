import { describe, it, expect, vi } from "vitest";

// Mock the cogLayer module to avoid the broken @developmentseed/deck.gl-geotiff import
vi.mock("../../layers/cogLayer", () => ({
  buildCogLayer: vi.fn(() => []),
}));

import { buildLayersForChapter } from "../rendering";
import { createChapter } from "../types";
import type { Dataset } from "../../../types";

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
  crs: null,
  crs_name: null,
  pixel_width: null,
  pixel_height: null,
  resolution: null,
  compression: null,
  is_mosaic: false,
  is_zero_copy: false,
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

    const layers = buildLayersForChapter(chapter, datasetMap);

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

    const layers = buildLayersForChapter(chapter, datasetMap);

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

    const layers = buildLayersForChapter(chapter, datasetMap);

    expect(layers.length).toBeGreaterThan(0);
    const tileUrl: string = (
      layers[0] as unknown as { props: { data: string } }
    ).props.data;
    expect(tileUrl).not.toContain("datetime=");
  });
});
