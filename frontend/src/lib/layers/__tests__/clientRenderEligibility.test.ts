import { describe, it, expect } from "vitest";
import { evaluateClientRenderEligibility } from "../clientRenderEligibility";
import type { MapItem } from "../../../types";

function rasterDatasetItem(overrides: Partial<MapItem> = {}): MapItem {
  return {
    id: "ds-1",
    name: "ds",
    source: "dataset",
    dataType: "raster",
    tileUrl: "/raster/tile/x/y/z",
    bounds: [-10, -10, 10, 10],
    minZoom: null,
    maxZoom: null,
    bandCount: 1,
    bandNames: null,
    colorInterpretation: null,
    dtype: "float32",
    rasterMin: 0,
    rasterMax: 1,
    isCategorical: false,
    categories: null,
    cogUrl: "https://r2.example/ds.tif",
    crs: "EPSG:3857",
    rescale: "0,1",
    parquetUrl: null,
    isTemporal: false,
    timesteps: [],
    renderMode: null,
    preferredColormap: null,
    preferredColormapReversed: null,
    dataset: { converted_file_size: 100 * 1024 * 1024 } as never,
    connection: null,
    ...overrides,
  };
}

describe("evaluateClientRenderEligibility", () => {
  it("returns eligible for a continuous COG under the 500 MB cap", () => {
    const result = evaluateClientRenderEligibility(rasterDatasetItem());
    expect(result.canRender).toBe(true);
    expect(result.renderPath).toBe("continuous");
    expect(result.cap).toBe(500 * 1024 * 1024);
    expect(result.sizeBytes).toBe(100 * 1024 * 1024);
    expect(result.reason).toMatch(/under/i);
  });

  it("returns ineligible for a continuous COG over the 500 MB cap", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({
        dataset: { converted_file_size: 900 * 1024 * 1024 } as never,
      })
    );
    expect(result.canRender).toBe(false);
    expect(result.reason).toMatch(/cap|exceeds/i);
  });

  it("returns ineligible for a temporal dataset", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({ isTemporal: true })
    );
    expect(result.canRender).toBe(false);
    expect(result.reason).toMatch(/temporal/i);
  });

  it("returns ineligible when cogUrl is missing", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({ cogUrl: null })
    );
    expect(result.canRender).toBe(false);
    expect(result.reason).toMatch(/cog/i);
  });

  it("returns ineligible when bounds are outside ±85.05 latitude", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({ bounds: [-10, -86, 10, 10] })
    );
    expect(result.canRender).toBe(false);
    expect(result.reason).toMatch(/bounds|latitude/i);
  });

  it("returns ineligible for a connection with unknown file_size", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({
        source: "connection",
        dataset: null,
        connection: { file_size: null } as never,
      })
    );
    expect(result.canRender).toBe(false);
    expect(result.reason).toMatch(/size|unknown/i);
  });

  it("uses the 2 GB paletted cap for categorical integer rasters", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({
        dtype: "uint8",
        isCategorical: true,
        dataset: { converted_file_size: 1.5 * 1024 * 1024 * 1024 } as never,
      })
    );
    expect(result.canRender).toBe(true);
    expect(result.renderPath).toBe("paletted");
    expect(result.cap).toBe(2 * 1024 * 1024 * 1024);
  });

  it("returns null canRender for a null item", () => {
    const result = evaluateClientRenderEligibility(null);
    expect(result.canRender).toBe(false);
    expect(result.reason).toMatch(/no item|missing/i);
  });

  it("stays eligible for non-Mercator CRSes (deck.gl-geotiff reprojects internally)", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({ crs: "EPSG:4326" })
    );
    expect(result.canRender).toBe(true);
  });

  it("stays eligible when CRS is EPSG:3857", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({ crs: "EPSG:3857" })
    );
    expect(result.canRender).toBe(true);
  });

  it("stays eligible when CRS is unknown (null)", () => {
    const result = evaluateClientRenderEligibility(
      rasterDatasetItem({ crs: null })
    );
    expect(result.canRender).toBe(true);
  });
});
