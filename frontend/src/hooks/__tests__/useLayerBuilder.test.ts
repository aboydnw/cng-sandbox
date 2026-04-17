import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the cogLayer module to avoid the broken @developmentseed/deck.gl-geotiff import
vi.mock("../../lib/layers/cogLayer", () => ({
  buildCogLayerContinuous: vi.fn(() => []),
  buildCogLayerPaletted: vi.fn(() => []),
}));

import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useLayerBuilder } from "../useLayerBuilder";
import type { MapItem, Dataset } from "../../types";
import type { TileCacheEntry } from "../../lib/layers";
import {
  buildCogLayerContinuous,
  buildCogLayerPaletted,
} from "../../lib/layers";

function makeItem(overrides: Partial<MapItem> = {}): MapItem {
  return {
    id: "t1",
    name: "t",
    source: "dataset",
    dataType: "raster",
    tileUrl: "/raster/tiles/{z}/{x}/{y}?assets=cog",
    bounds: null,
    minZoom: null,
    maxZoom: null,
    bandCount: 1,
    bandNames: ["b1"],
    colorInterpretation: ["gray"],
    dtype: null,
    rasterMin: 0,
    rasterMax: 100,
    isCategorical: false,
    categories: null,
    cogUrl: null,
    rescale: null,
    parquetUrl: null,
    isTemporal: false,
    timesteps: [],
    dataset: null,
    connection: null,
    ...overrides,
  };
}

function renderBuilder(
  opts: Partial<Parameters<typeof useLayerBuilder>[0]> = {}
) {
  return renderHook(() => {
    const cacheRef = useRef<Map<string, TileCacheEntry>>(new Map());
    return useLayerBuilder({
      item: opts.item ?? makeItem(),
      renderMode: "server",
      canClientRender: false,
      opacity: 0.8,
      colormapName: "viridis",
      effectiveBand: "rgb",
      isSingleBand: true,
      isMultiBand: false,
      isCategorical: false,
      activeTimestepIndex: 0,
      getLoadCallback: () => () => {},
      tileCacheRef: cacheRef,
      arrowTable: null,
      rescaleMin: null,
      rescaleMax: null,
      colormapReversed: false,
      ...opts,
    });
  });
}

describe("useLayerBuilder rescale + colormapReversed", () => {
  it("uses dataset min/max when no override", () => {
    const { result } = renderBuilder();
    expect(result.current.tileUrl).toContain("colormap_name=viridis");
    expect(result.current.tileUrl).toContain("rescale=0,100");
  });

  it("prefers override rescale min/max over dataset defaults", () => {
    const { result } = renderBuilder({ rescaleMin: 10, rescaleMax: 50 });
    expect(result.current.tileUrl).toContain("rescale=10,50");
    expect(result.current.tileUrl).not.toContain("rescale=0,100");
  });

  it("falls back to dataset max when only min is overridden", () => {
    const { result } = renderBuilder({ rescaleMin: 10, rescaleMax: null });
    expect(result.current.tileUrl).toContain("rescale=10,100");
  });

  it("appends _r to colormap when reversed", () => {
    const { result } = renderBuilder({ colormapReversed: true });
    expect(result.current.tileUrl).toContain("colormap_name=viridis_r");
  });

  it("applies both override rescale and reversed colormap together", () => {
    const { result } = renderBuilder({
      rescaleMin: -1,
      rescaleMax: 1,
      colormapReversed: true,
    });
    expect(result.current.tileUrl).toContain("colormap_name=viridis_r");
    expect(result.current.tileUrl).toContain("rescale=-1,1");
  });

  it("applies reversed colormap to multi-band single-band selection", () => {
    const item = makeItem({
      bandCount: 3,
      bandNames: ["b1", "b2", "b3"],
      colorInterpretation: ["gray", "gray", "gray"],
    });
    const { result } = renderBuilder({
      item,
      isSingleBand: false,
      isMultiBand: true,
      effectiveBand: 1,
      colormapReversed: true,
    });
    expect(result.current.tileUrl).toContain("colormap_name=viridis_r");
    expect(result.current.tileUrl).toContain("bidx=2");
  });
});

describe("client-side COG render dispatch", () => {
  beforeEach(() => {
    vi.mocked(buildCogLayerContinuous).mockClear();
    vi.mocked(buildCogLayerPaletted).mockClear();
  });

  function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
    return {
      id: "ds1",
      filename: "ds.tif",
      dataset_type: "raster",
      format_pair: "geotiff_cog",
      tile_url: "",
      bounds: null,
      band_count: 1,
      band_names: ["b1"],
      color_interpretation: ["gray"],
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
      created_at: "",
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
      ...overrides,
    };
  }

  it("uses the paletted builder for uint8 datasets", () => {
    const item = makeItem({
      dtype: "uint8",
      isCategorical: true,
      cogUrl: "/cog/nlcd.tif",
      dataset: makeDataset({ dtype: "uint8", is_categorical: true }),
    });
    renderBuilder({
      item,
      renderMode: "client",
      canClientRender: true,
      isCategorical: true,
    });

    expect(buildCogLayerPaletted).toHaveBeenCalledTimes(1);
    expect(buildCogLayerContinuous).not.toHaveBeenCalled();
  });

  it("uses the paletted builder for uint16 categorical datasets", () => {
    const item = makeItem({
      dtype: "uint16",
      isCategorical: true,
      cogUrl: "/cog/classified.tif",
      dataset: makeDataset({ dtype: "uint16", is_categorical: true }),
    });
    renderBuilder({
      item,
      renderMode: "client",
      canClientRender: true,
      isCategorical: true,
    });

    expect(buildCogLayerPaletted).toHaveBeenCalledTimes(1);
    expect(buildCogLayerContinuous).not.toHaveBeenCalled();
  });

  it("uses the continuous builder for float32 datasets", () => {
    const item = makeItem({
      dtype: "float32",
      isCategorical: false,
      cogUrl: "/cog/dem.tif",
      dataset: makeDataset({ dtype: "float32" }),
    });
    renderBuilder({
      item,
      renderMode: "client",
      canClientRender: true,
      isCategorical: false,
    });

    expect(buildCogLayerContinuous).toHaveBeenCalledTimes(1);
    expect(buildCogLayerPaletted).not.toHaveBeenCalled();
  });
});
