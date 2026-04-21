import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MutableRefObject } from "react";
import { resolveRasterLayers } from "../resolveRasterLayers";
import type { MapItem } from "../../../types";
import type { TileCacheEntry } from "../cogLayer";

vi.mock("../cogLayer", () => ({
  buildCogLayerContinuous: vi.fn(() => [{ id: "cog-continuous" }]),
  buildCogLayerPaletted: vi.fn(() => [{ id: "cog-paletted" }]),
}));
vi.mock("../rasterTileLayer", () => ({
  buildRasterTileLayers: vi.fn(() => [{ id: "server-tiles" }]),
}));

import { buildCogLayerContinuous, buildCogLayerPaletted } from "../cogLayer";
import { buildRasterTileLayers } from "../rasterTileLayer";

function makeRef(): MutableRefObject<Map<string, TileCacheEntry>> {
  return { current: new Map() };
}

function continuousItem(overrides: Partial<MapItem> = {}): MapItem {
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
    dataset: { converted_file_size: 100 * 1024 * 1024 } as never,
    connection: null,
    ...overrides,
  };
}

describe("resolveRasterLayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches to continuous COG builder when eligible", () => {
    const ref = makeRef();
    const result = resolveRasterLayers({
      item: continuousItem(),
      opacity: 0.8,
      rescaleMin: 0,
      rescaleMax: 1,
      tileCacheRef: ref,
    });

    expect(result.renderMode).toBe("client");
    expect(result.reason).toMatch(/under/i);
    expect(result.sizeBytes).toBe(100 * 1024 * 1024);
    expect(buildCogLayerContinuous).toHaveBeenCalledTimes(1);
    expect(buildCogLayerContinuous).toHaveBeenCalledWith(
      expect.objectContaining({
        rasterMin: 0,
        rasterMax: 1,
        opacity: 0.8,
      })
    );
    expect(buildRasterTileLayers).not.toHaveBeenCalled();
    expect(result.layers).toEqual([{ id: "cog-continuous" }]);
  });

  it("dispatches to paletted COG builder for categorical items", () => {
    const ref = makeRef();
    const categories = [
      { value: 1, color: "#ff0000", label: "A" },
      { value: 2, color: "#00ff00", label: "B" },
    ];
    const result = resolveRasterLayers({
      item: continuousItem({
        dtype: "uint8",
        isCategorical: true,
        categories,
      }),
      opacity: 0.8,
      rescaleMin: null,
      rescaleMax: null,
      tileCacheRef: ref,
      effectiveCategories: categories,
    });

    expect(result.renderMode).toBe("client");
    expect(buildCogLayerPaletted).toHaveBeenCalledTimes(1);
    expect(result.layers).toEqual([{ id: "cog-paletted" }]);
  });

  it("falls back to server tiles when over the client-render cap", () => {
    const ref = makeRef();
    const result = resolveRasterLayers({
      item: continuousItem({
        dataset: { converted_file_size: 900 * 1024 * 1024 } as never,
      }),
      opacity: 0.8,
      serverTileUrl: "/raster/server/tile/x/y/z",
      rescaleMin: 0,
      rescaleMax: 1,
      tileCacheRef: ref,
    });

    expect(result.renderMode).toBe("server");
    expect(result.reason).toMatch(/exceeds/i);
    expect(buildRasterTileLayers).toHaveBeenCalledTimes(1);
    expect(buildCogLayerContinuous).not.toHaveBeenCalled();
    expect(result.layers).toEqual([{ id: "server-tiles" }]);
  });

  it("falls back to server tiles for temporal items", () => {
    const ref = makeRef();
    const result = resolveRasterLayers({
      item: continuousItem({ isTemporal: true }),
      opacity: 0.8,
      serverTileUrl: "/raster/server/tile/x/y/z",
      rescaleMin: 0,
      rescaleMax: 1,
      tileCacheRef: ref,
    });

    expect(result.renderMode).toBe("server");
    expect(result.reason).toMatch(/temporal/i);
    expect(buildRasterTileLayers).toHaveBeenCalled();
  });

  it("returns empty layers when item is null", () => {
    const ref = makeRef();
    const result = resolveRasterLayers({
      item: null,
      opacity: 0.8,
      rescaleMin: null,
      rescaleMax: null,
      tileCacheRef: ref,
    });

    expect(result.layers).toEqual([]);
    expect(result.renderMode).toBe("server");
  });

  it("parses item.rescale when rescaleMin/Max are null for connection COGs", () => {
    const ref = makeRef();
    resolveRasterLayers({
      item: continuousItem({
        source: "connection",
        dataset: null,
        connection: { file_size: 100 * 1024 * 1024 } as never,
        rescale: "0,100",
        rasterMin: null,
        rasterMax: null,
      }),
      opacity: 0.8,
      rescaleMin: null,
      rescaleMax: null,
      tileCacheRef: ref,
    });

    expect(buildCogLayerContinuous).toHaveBeenCalledTimes(1);
    expect(buildCogLayerContinuous).toHaveBeenCalledWith(
      expect.objectContaining({
        rasterMin: 0,
        rasterMax: 100,
      })
    );
  });
});
