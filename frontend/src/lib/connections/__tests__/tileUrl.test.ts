import { describe, it, expect } from "vitest";
import { buildConnectionTileUrl } from "../tileUrl";
import type { Connection } from "../../../types";

function makeConnection(overrides: Partial<Connection>): Connection {
  return {
    id: "test-id",
    name: "Test",
    url: "https://example.com/data.tif",
    connection_type: "cog",
    bounds: null,
    min_zoom: null,
    max_zoom: null,
    tile_type: "raster",
    band_count: null,
    rescale: null,
    workspace_id: null,
    created_at: "2026-01-01T00:00:00Z",
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
    ...overrides,
  };
}

describe("buildConnectionTileUrl", () => {
  it("builds COG tile URL via titiler proxy", () => {
    const conn = makeConnection({
      url: "https://bucket.s3.amazonaws.com/scene.tif",
      connection_type: "cog",
    });
    const result = buildConnectionTileUrl(conn);
    expect(result).toBe(
      "/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=https%3A%2F%2Fbucket.s3.amazonaws.com%2Fscene.tif"
    );
  });

  it("returns the raw URL for XYZ raster", () => {
    const conn = makeConnection({
      url: "https://tiles.example.com/{z}/{x}/{y}.png",
      connection_type: "xyz_raster",
    });
    expect(buildConnectionTileUrl(conn)).toBe(
      "https://tiles.example.com/{z}/{x}/{y}.png"
    );
  });

  it("returns the raw URL for XYZ vector", () => {
    const conn = makeConnection({
      url: "https://tiles.example.com/{z}/{x}/{y}.mvt",
      connection_type: "xyz_vector",
    });
    expect(buildConnectionTileUrl(conn)).toBe(
      "https://tiles.example.com/{z}/{x}/{y}.mvt"
    );
  });

  it("returns the raw URL for PMTiles", () => {
    const conn = makeConnection({
      url: "https://example.com/data.pmtiles",
      connection_type: "pmtiles",
    });
    expect(buildConnectionTileUrl(conn)).toBe(
      "https://example.com/data.pmtiles"
    );
  });

  it("returns the raw URL for geoparquet connections", () => {
    const conn = makeConnection({
      url: "https://example.com/parcels.parquet",
      connection_type: "geoparquet",
    });
    expect(buildConnectionTileUrl(conn)).toBe(
      "https://example.com/parcels.parquet"
    );
  });

  it("prefers tile_url for server-converted geoparquet", () => {
    const conn = makeConnection({
      url: "https://example.com/big.parquet",
      connection_type: "geoparquet",
      tile_url: "/pmtiles/connections/c7/data.pmtiles",
      render_path: "server",
      conversion_status: "ready",
      conversion_error: null,
      feature_count: 900_000,
      file_size: 150_000_000,
    });
    expect(buildConnectionTileUrl(conn)).toBe(
      "/pmtiles/connections/c7/data.pmtiles"
    );
  });
});
