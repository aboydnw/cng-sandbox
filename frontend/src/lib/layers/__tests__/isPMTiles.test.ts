import { describe, it, expect } from "vitest";
import { isPMTilesDataset } from "../isPMTiles";

describe("isPMTilesDataset", () => {
  it("returns true when format_pair is pmtiles (source.coop reference)", () => {
    expect(
      isPMTilesDataset({
        format_pair: "pmtiles",
        tile_url: "https://data.source.coop/vida/x.pmtiles",
      })
    ).toBe(true);
  });

  it("returns true for legacy uploaded PMTiles (tile_url prefix)", () => {
    expect(
      isPMTilesDataset({
        format_pair: "shapefile-to-geoparquet",
        tile_url: "/pmtiles/datasets/abc/converted/data.pmtiles",
      })
    ).toBe(true);
    expect(
      isPMTilesDataset({
        format_pair: "geojson-to-geoparquet",
        tile_url: "/pmtiles/datasets/def/converted/data.pmtiles",
      })
    ).toBe(true);
  });

  it("returns false for non-PMTiles vector datasets", () => {
    expect(
      isPMTilesDataset({
        format_pair: "shapefile-to-geoparquet",
        tile_url: "/vector/collections/public.sandbox_abc/tiles/{z}/{x}/{y}",
      })
    ).toBe(false);
  });

  it("returns false for raster datasets", () => {
    expect(isPMTilesDataset({ format_pair: "geotiff-to-cog" })).toBe(false);
  });

  it("returns false when both fields are missing", () => {
    expect(isPMTilesDataset({})).toBe(false);
  });
});
