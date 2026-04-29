import { describe, it, expect } from "vitest";
import { datasetToLibraryItem, connectionToLibraryItem } from "../normalize";
import type { Dataset, Connection } from "../../../types";

function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: "ds-1",
    filename: "rivers.geojson",
    title: null,
    dataset_type: "vector",
    format_pair: "geojson->geoparquet",
    tile_url: "",
    bounds: null,
    band_count: null,
    band_names: null,
    color_interpretation: null,
    dtype: null,
    original_file_size: 1024,
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
    created_at: "2026-04-01T00:00:00Z",
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
    preferred_colormap: null,
    preferred_colormap_reversed: null,
    source_url: null,
    expires_at: null,
    ...overrides,
  };
}

function makeConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: "conn-1",
    name: "Sentinel mosaic",
    url: "https://example.com/tiles/{z}/{x}/{y}.png",
    connection_type: "xyz_raster",
    bounds: null,
    min_zoom: null,
    max_zoom: null,
    tile_type: "raster",
    band_count: null,
    rescale: null,
    workspace_id: "ws-1",
    is_categorical: false,
    categories: null,
    tile_url: null,
    render_path: "client",
    conversion_status: "ready",
    conversion_error: null,
    feature_count: null,
    file_size: null,
    is_shared: false,
    preferred_colormap: null,
    preferred_colormap_reversed: null,
    created_at: "2026-04-02T00:00:00Z",
    ...overrides,
  } as Connection;
}

describe("datasetToLibraryItem", () => {
  it("uses displayName for the name", () => {
    const item = datasetToLibraryItem(
      makeDataset({ title: "My rivers", filename: "rivers.geojson" })
    );
    expect(item.name).toBe("My rivers");
  });

  it("falls back to filename when no title", () => {
    const item = datasetToLibraryItem(
      makeDataset({ title: null, filename: "rivers.geojson" })
    );
    expect(item.name).toBe("rivers.geojson");
  });

  it("maps dataset_type directly to type", () => {
    expect(
      datasetToLibraryItem(makeDataset({ dataset_type: "raster" })).type
    ).toBe("raster");
    expect(
      datasetToLibraryItem(makeDataset({ dataset_type: "vector" })).type
    ).toBe("vector");
  });

  it("sets source.label to 'Uploaded' and no href", () => {
    const item = datasetToLibraryItem(makeDataset());
    expect(item.source.label).toBe("Uploaded");
    expect(item.source.href).toBeUndefined();
  });

  it("sets kind=upload and detailHref to the dataset map page", () => {
    const item = datasetToLibraryItem(makeDataset({ id: "ds-42" }));
    expect(item.kind).toBe("upload");
    expect(item.detailHref).toBe("/map/ds-42");
  });

  it("carries the raw dataset for downstream delete dispatch", () => {
    const ds = makeDataset({ id: "ds-7" });
    const item = datasetToLibraryItem(ds);
    expect(item.raw).toEqual({ kind: "dataset", dataset: ds });
  });
});

describe("connectionToLibraryItem", () => {
  it("uses connection.name for the name", () => {
    const item = connectionToLibraryItem(makeConnection({ name: "My COG" }));
    expect(item.name).toBe("My COG");
  });

  it("maps cog and xyz_raster to raster", () => {
    expect(
      connectionToLibraryItem(makeConnection({ connection_type: "cog" })).type
    ).toBe("raster");
    expect(
      connectionToLibraryItem(makeConnection({ connection_type: "xyz_raster" }))
        .type
    ).toBe("raster");
  });

  it("maps xyz_vector and geoparquet to vector", () => {
    expect(
      connectionToLibraryItem(makeConnection({ connection_type: "xyz_vector" }))
        .type
    ).toBe("vector");
    expect(
      connectionToLibraryItem(makeConnection({ connection_type: "geoparquet" }))
        .type
    ).toBe("vector");
  });

  it("uses tile_type for pmtiles when set", () => {
    expect(
      connectionToLibraryItem(
        makeConnection({ connection_type: "pmtiles", tile_type: "raster" })
      ).type
    ).toBe("raster");
    expect(
      connectionToLibraryItem(
        makeConnection({ connection_type: "pmtiles", tile_type: "vector" })
      ).type
    ).toBe("vector");
  });

  it("defaults pmtiles without tile_type to vector", () => {
    expect(
      connectionToLibraryItem(
        makeConnection({ connection_type: "pmtiles", tile_type: null })
      ).type
    ).toBe("vector");
  });

  it("sets source.label to the URL and source.href to the URL", () => {
    const item = connectionToLibraryItem(
      makeConnection({ url: "https://example.com/data.tif" })
    );
    expect(item.source.label).toBe("https://example.com/data.tif");
    expect(item.source.href).toBe("https://example.com/data.tif");
  });

  it("sets kind=connection and detailHref to the connection map page", () => {
    const item = connectionToLibraryItem(makeConnection({ id: "conn-99" }));
    expect(item.kind).toBe("connection");
    expect(item.detailHref).toBe("/map/connection/conn-99");
  });

  it("uses created_at for addedAt", () => {
    const item = connectionToLibraryItem(
      makeConnection({ created_at: "2026-04-15T12:00:00Z" })
    );
    expect(item.addedAt).toBe("2026-04-15T12:00:00Z");
  });
});
