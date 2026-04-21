import { describe, it, expect } from "vitest";
import { getStepContent, getStepCount, getPipelineType } from "../stepContent";
import {
  getConnectionStepContent,
  getConnectionStepCount,
} from "../connectionStepContent";
import type { Dataset, Connection } from "../../../types";

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
    expect(content.beforeAfter!.beforeValue).toBe("11.1 MB");
    expect(content.beforeAfter!.afterValue).toBe("11.1 MB");
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

  it("returns PMTiles-specific Catalog content (not PostGIS)", () => {
    const content = getStepContent(pmtilesDataset as Dataset, 2);
    expect(content.title).toContain("tile archive");
    expect(content.title).not.toContain("PostGIS");
  });

  it("returns cloud storage for PMTiles Store step (not database)", () => {
    const content = getStepContent(pmtilesDataset as Dataset, 3);
    expect(content.subtitle).toBe("cloud hosted");
    expect(content.title).toContain("cloud");
    expect(content.title).not.toContain("PostGIS");
  });

  describe("raster Display step", () => {
    const categoricalDataset: Partial<Dataset> = {
      ...rasterDataset,
      is_categorical: true,
      dtype: "uint32",
      categories: [
        { value: 1, label: "A", color: "#ff0000" },
        { value: 2, label: "B", color: "#00ff00" },
        { value: 3, label: "C", color: "#0000ff" },
      ],
    };

    it("server mode keeps viridis for continuous single-band raster", () => {
      const content = getStepContent(rasterDataset as Dataset, 4, "server");
      const colormap = content.metadata.find((m) => m.label === "Colormap");
      expect(colormap?.value).toBe("viridis (dynamic)");
    });

    it("labels colormap as categorical when dataset is categorical", () => {
      const server = getStepContent(categoricalDataset as Dataset, 4, "server");
      const serverColormap = server.metadata.find(
        (m) => m.label === "Colormap"
      );
      expect(serverColormap?.value).toContain("Categorical");
      expect(serverColormap?.value).toContain("3 classes");

      const client = getStepContent(categoricalDataset as Dataset, 4, "client");
      const clientColormap = client.metadata.find(
        (m) => m.label === "Colormap"
      );
      expect(clientColormap?.value).toContain("Categorical");
      expect(clientColormap?.value).not.toBe("viridis (dynamic)");
    });

    it("client mode omits server-tile fields and explains browser rendering", () => {
      const content = getStepContent(rasterDataset as Dataset, 4, "client");
      expect(content.subtitle).toBe("browser render");
      expect(content.title.toLowerCase()).toContain("client-side");
      expect(content.metadata.some((m) => m.label === "Tile Format")).toBe(
        false
      );
      expect(content.metadata.some((m) => m.label === "Tile Size")).toBe(false);
      expect(
        content.metadata.some(
          (m) => m.label === "Renderer" && m.value.includes("CogLayer")
        )
      ).toBe(true);
      expect(
        content.tools.some((t) => /titiler-pgstac/i.test(t.name))
      ).toBe(false);
    });

    it("includes MapLibre in tools for both render modes", () => {
      const server = getStepContent(rasterDataset as Dataset, 4, "server");
      expect(server.tools.some((t) => /MapLibre/i.test(t.name))).toBe(true);
      const client = getStepContent(rasterDataset as Dataset, 4, "client");
      expect(client.tools.some((t) => /MapLibre/i.test(t.name))).toBe(true);
    });
  });
});

const geoparquetConnection: Connection = {
  id: "c5",
  name: "Parcels",
  url: "https://example.com/parcels.parquet",
  connection_type: "geoparquet",
  bounds: null,
  min_zoom: null,
  max_zoom: null,
  tile_type: null,
  band_count: null,
  rescale: null,
  workspace_id: null,
  is_categorical: false,
  categories: null,
  tile_url: null,
  render_path: null,
  conversion_status: null,
  conversion_error: null,
  feature_count: null,
  file_size: null,
  is_shared: false,
  created_at: "2026-04-15T00:00:00Z",
};

describe("getConnectionStepContent (geoparquet)", () => {
  it("returns DuckDB-based source step for geoparquet connections", () => {
    const step = getConnectionStepContent(geoparquetConnection, 1);
    expect(step.title.toLowerCase()).toContain("duckdb");
    expect(step.tools.some((t) => /duckdb/i.test(t.name))).toBe(true);
  });

  it("returns deck.gl GeoJson display step for geoparquet", () => {
    const step = getConnectionStepContent(geoparquetConnection, 2);
    expect(step.tools.some((t) => /deck\.gl/i.test(t.name))).toBe(true);
  });

  it("shows tippecanoe source step for server-rendered geoparquet", () => {
    const conn: Connection = {
      id: "c8",
      name: "Big",
      url: "https://example.com/big.parquet",
      connection_type: "geoparquet",
      render_path: "server",
      conversion_status: "ready",
      conversion_error: null,
      tile_url: "/pmtiles/connections/c8/data.pmtiles",
      feature_count: 900_000,
      file_size: 150_000_000,
      bounds: null,
      min_zoom: null,
      max_zoom: null,
      tile_type: "vector",
      band_count: null,
      rescale: null,
      workspace_id: null,
      is_categorical: false,
      categories: null,
      is_shared: false,
      created_at: "2026-04-15T00:00:00Z",
    };
    const source = getConnectionStepContent(conn, 1);
    expect(source?.tools?.some((t) => /tippecanoe/i.test(t.name))).toBe(true);
    const display = getConnectionStepContent(conn, 2);
    expect(display?.title?.toLowerCase()).toContain("pmtiles");
  });
});

function buildGeoParquetConn(overrides: Partial<Connection> = {}): Connection {
  return {
    id: "test-id",
    name: "test.parquet",
    url: "https://example.com/test.parquet",
    connection_type: "geoparquet",
    bounds: null,
    min_zoom: null,
    max_zoom: null,
    tile_type: null,
    band_count: null,
    rescale: null,
    workspace_id: "ws1",
    is_categorical: false,
    categories: null,
    tile_url: null,
    render_path: "client",
    conversion_status: null,
    conversion_error: null,
    feature_count: null,
    file_size: null,
    is_shared: false,
    created_at: "2026-04-15T00:00:00Z",
    ...overrides,
  };
}

describe("connectionStepContent — geoparquet dispatch", () => {
  it("returns 3 steps for geoparquet connections", () => {
    const conn = buildGeoParquetConn();
    expect(getConnectionStepCount(conn)).toBe(3);
  });

  it("returns 2 steps for non-geoparquet connections", () => {
    const conn = buildGeoParquetConn({ connection_type: "cog" });
    expect(getConnectionStepCount(conn)).toBe(2);
  });

  it("shows a dispatch step as step 0 for geoparquet connections", () => {
    const conn = buildGeoParquetConn({
      render_path: "client",
      file_size: 5 * 1024 * 1024,
    });
    const step = getConnectionStepContent(conn, 0);
    expect(step.title.toLowerCase()).toContain("browser");
    expect(step.badge).toBe("IN-BROWSER");
  });

  it("dispatch step explains server path when render_path=server", () => {
    const conn = buildGeoParquetConn({
      render_path: "server",
      file_size: 480 * 1024 * 1024,
    });
    const step = getConnectionStepContent(conn, 0);
    expect(step.title.toLowerCase()).toContain("server");
    expect(step.badge).toBe("SERVER");
  });

  it("geoparquet source step shows Step 2 of 3", () => {
    const conn = buildGeoParquetConn();
    const step = getConnectionStepContent(conn, 1);
    expect(step.badge).toBe("Step 2 of 3");
  });

  it("geoparquet display step shows Step 3 of 3", () => {
    const conn = buildGeoParquetConn();
    const step = getConnectionStepContent(conn, 2);
    expect(step.badge).toBe("Step 3 of 3");
  });
});
