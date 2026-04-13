import { describe, it, expect } from "vitest";
import { buildRasterTileLayers } from "../rasterTileLayer";
import type { Timestep } from "../../../types";

const TIMESTEPS: Timestep[] = [
  { datetime: "2024-01-01T00:00:00Z", index: 0 },
  { datetime: "2024-02-01T00:00:00Z", index: 1 },
  { datetime: "2024-03-01T00:00:00Z", index: 2 },
];

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

  it("uses custom id for non-temporal layer", () => {
    const layers = buildRasterTileLayers({
      id: "raster-layer-viridis-1",
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 0.8,
      isTemporalActive: false,
    });
    expect(layers[0].id).toBe("raster-layer-viridis-1");
  });

  it("returns empty array when temporal with no timesteps", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 1,
      isTemporalActive: true,
    });
    expect(layers).toHaveLength(0);
  });

  it("returns only layers in renderIndices", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 0.8,
      isTemporalActive: true,
      isAnimateMode: true,
      timesteps: [
        { datetime: "2020-01-01", index: 0 },
        { datetime: "2020-02-01", index: 1 },
        { datetime: "2020-03-01", index: 2 },
      ],
      activeTimestepIndex: 1,
      renderIndices: new Set([0, 1]),
    });
    expect(layers).toHaveLength(2);
    expect(layers[0].id).toBe("raster-ts-0");
    expect(layers[1].id).toBe("raster-ts-1");
    expect(layers[1].props.opacity).toBe(0.8);
    expect(layers[0].props.opacity).toBe(0);
  });

  it("returns all layers when renderIndices is undefined", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "/raster/tiles/{z}/{x}/{y}.png?colormap_name=viridis",
      opacity: 0.8,
      isTemporalActive: true,
      isAnimateMode: true,
      timesteps: [
        { datetime: "2020-01-01", index: 0 },
        { datetime: "2020-02-01", index: 1 },
        { datetime: "2020-03-01", index: 2 },
      ],
      activeTimestepIndex: 1,
    });
    expect(layers).toHaveLength(3);
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

  it("returns single layer with datetime param in browse mode", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "http://tiles/{z}/{x}/{y}.png",
      opacity: 0.8,
      isTemporalActive: true,
      isAnimateMode: false,
      timesteps: TIMESTEPS,
      activeTimestepIndex: 1,
    });
    expect(layers).toHaveLength(1);
    expect(layers[0].props.data).toContain("datetime=2024-02-01T00%3A00%3A00Z");
  });

  it("percent-encodes datetime values with a `+` offset", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "http://tiles/{z}/{x}/{y}.png",
      opacity: 1,
      isTemporalActive: true,
      isAnimateMode: false,
      timesteps: [{ datetime: "2024-02-03T00:00:00+00:00", index: 0 }],
      activeTimestepIndex: 0,
    });
    expect(layers[0].props.data).toContain(
      "datetime=2024-02-03T00%3A00%3A00%2B00%3A00"
    );
    expect(layers[0].props.data).not.toContain("+00:00");
  });

  it("returns multiple layers in animate mode", () => {
    const layers = buildRasterTileLayers({
      tileUrl: "http://tiles/{z}/{x}/{y}.png",
      opacity: 0.8,
      isTemporalActive: true,
      isAnimateMode: true,
      timesteps: TIMESTEPS,
      activeTimestepIndex: 1,
      renderIndices: new Set([0, 1, 2]),
      getLoadCallback: () => () => {},
    });
    expect(layers.length).toBe(3);
    expect(layers[0].props.opacity).toBe(0);
    expect(layers[1].props.opacity).toBe(0.8);
    expect(layers[2].props.opacity).toBe(0);
  });
});
