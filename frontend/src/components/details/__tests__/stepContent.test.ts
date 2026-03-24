import { describe, it, expect } from "vitest";
import { getStepContent, getStepCount, getPipelineType } from "../stepContent";
import type { Dataset } from "../../../types";

const rasterDataset: Partial<Dataset> = {
  id: "abc123",
  filename: "test.tif",
  dataset_type: "raster",
  format_pair: "geotiff-to-cog",
  tile_url: "/raster/collections/sandbox-abc123/tiles",
  bounds: [-180, -90, 180, 90],
  band_count: 1,
  band_names: ["precipitation"],
  color_interpretation: ["gray"],
  dtype: "float32",
  original_file_size: 11600000,
  converted_file_size: 11600000,
  raster_min: 0,
  raster_max: 281.9,
  min_zoom: 0,
  max_zoom: 6,
  stac_collection_id: "sandbox-abc123",
  crs: "EPSG:4326",
  crs_name: "WGS 84",
  pixel_width: 2160,
  pixel_height: 1080,
  resolution: 0.167,
  credits: [],
};

const vectorDataset: Partial<Dataset> = {
  id: "def456",
  filename: "gadm41_AFG_shp.zip",
  dataset_type: "vector",
  format_pair: "shapefile-to-geoparquet",
  tile_url: "/vector/collections/public.sandbox_def456/tiles",
  bounds: [60.5, 29.4, 74.9, 38.5],
  feature_count: 34,
  geometry_types: ["Polygon"],
  original_file_size: 633200,
  converted_file_size: 189400,
  geoparquet_file_size: 189400,
  pg_table: "sandbox_def456",
  min_zoom: 0,
  max_zoom: 14,
  crs: "EPSG:4326",
  crs_name: "WGS 84",
  credits: [],
};

const pmtilesDataset: Partial<Dataset> = {
  ...vectorDataset,
  id: "ghi789",
  tile_url: "/pmtiles/sandbox_ghi789.pmtiles",
};

describe("getPipelineType", () => {
  it("returns raster for raster datasets", () => {
    expect(getPipelineType(rasterDataset as Dataset)).toBe("raster");
  });

  it("returns vector-postgis for vector datasets with non-pmtiles tile_url", () => {
    expect(getPipelineType(vectorDataset as Dataset)).toBe("vector-postgis");
  });

  it("returns vector-pmtiles for vector datasets with pmtiles tile_url", () => {
    expect(getPipelineType(pmtilesDataset as Dataset)).toBe("vector-pmtiles");
  });
});

describe("getStepCount", () => {
  it("returns 4 for all pipeline types", () => {
    expect(getStepCount(rasterDataset as Dataset)).toBe(4);
    expect(getStepCount(vectorDataset as Dataset)).toBe(4);
    expect(getStepCount(pmtilesDataset as Dataset)).toBe(4);
  });
});

describe("getStepContent", () => {
  it("returns Convert step for raster step 1", () => {
    const content = getStepContent(rasterDataset as Dataset, 1);
    expect(content.label).toBe("Convert");
    expect(content.subtitle).toBe("cloud-native");
    expect(content.title).toContain("Cloud Optimized GeoTIFF");
    expect(content.metadata.length).toBeGreaterThanOrEqual(5);
    expect(content.tools.length).toBeGreaterThanOrEqual(2);
  });

  it("returns Catalog step for raster step 2", () => {
    const content = getStepContent(rasterDataset as Dataset, 2);
    expect(content.label).toBe("Catalog");
    expect(content.subtitle).toBe("searchable");
    expect(content.title).toContain("STAC");
  });

  it("returns Store step for raster step 3", () => {
    const content = getStepContent(rasterDataset as Dataset, 3);
    expect(content.label).toBe("Store");
    expect(content.subtitle).toBe("cloud hosted");
  });

  it("returns Display step for raster step 4", () => {
    const content = getStepContent(rasterDataset as Dataset, 4);
    expect(content.label).toBe("Display");
    expect(content.subtitle).toBe("map tiles");
    expect(content.title).toContain("dynamic");
  });

  it("returns vector-specific Catalog content", () => {
    const content = getStepContent(vectorDataset as Dataset, 2);
    expect(content.subtitle).toBe("queryable");
    expect(content.title).toContain("queryable");
  });

  it("returns database subtitle for vector Store step", () => {
    const content = getStepContent(vectorDataset as Dataset, 3);
    expect(content.subtitle).toBe("database");
  });

  it("populates metadata tiles from dataset fields", () => {
    const content = getStepContent(rasterDataset as Dataset, 1);
    const projTile = content.metadata.find((m) => m.label === "Projection");
    expect(projTile).toBeDefined();
    expect(projTile!.value).toBe("EPSG:4326");
    expect(projTile!.subValue).toBe("WGS 84");
  });

  it("includes before/after for Convert step", () => {
    const content = getStepContent(rasterDataset as Dataset, 1);
    expect(content.beforeAfter).toBeDefined();
    expect(content.beforeAfter!.beforeValue).toBe("11.6 MB");
    expect(content.beforeAfter!.afterValue).toBe("11.6 MB");
  });

  it("includes before/after for vector Convert step", () => {
    const content = getStepContent(vectorDataset as Dataset, 1);
    expect(content.beforeAfter).toBeDefined();
    expect(content.beforeAfter!.beforeLabel).toContain("Shapefile");
  });

  it("uses different tool section title for Store step", () => {
    const rasterStore = getStepContent(rasterDataset as Dataset, 3);
    expect(rasterStore.toolSectionTitle).not.toBe("Open source tools used");

    const vectorStore = getStepContent(vectorDataset as Dataset, 3);
    expect(vectorStore.toolSectionTitle).toContain("database");
  });

  it("handles PMTiles vector pipeline", () => {
    const convert = getStepContent(pmtilesDataset as Dataset, 1);
    expect(convert.title).toContain("PMTiles");

    const display = getStepContent(pmtilesDataset as Dataset, 4);
    expect(display.tools.some((t) => t.name === "PMTiles")).toBe(true);
  });
});
