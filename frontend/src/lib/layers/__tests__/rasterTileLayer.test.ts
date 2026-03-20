import { describe, it, expect } from "vitest";
import { buildRasterTileLayers } from "../rasterTileLayer";

describe("buildRasterTileLayers", () => {
  it("returns a single layer for non-temporal dataset", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 0.8,
      isTemporalActive: false,
    });
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toBe("raster-tile-0");
  });

  it("returns N layers for temporal dataset with opacity toggle", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 0.8,
      isTemporalActive: true,
      timesteps: [
        { datetime: "2020-01-01", index: 0 },
        { datetime: "2020-02-01", index: 1 },
        { datetime: "2020-03-01", index: 2 },
      ],
      activeTimestepIndex: 1,
    });
    expect(layers).toHaveLength(3);
    // Active layer gets full opacity, others get 0
    expect(layers[1].props.opacity).toBe(0.8);
    expect(layers[0].props.opacity).toBe(0);
    expect(layers[2].props.opacity).toBe(0);
  });

  it("appends datetime param for temporal layers", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 1,
      isTemporalActive: true,
      timesteps: [{ datetime: "2020-01-01", index: 0 }],
      activeTimestepIndex: 0,
    });
    expect(layers[0].props.data).toContain("datetime=2020-01-01");
  });
});
