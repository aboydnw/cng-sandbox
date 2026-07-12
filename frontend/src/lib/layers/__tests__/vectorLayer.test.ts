import { describe, it, expect, vi } from "vitest";

vi.mock("../../../components/MapShell", () => ({
  BRAND_COLOR_RGBA: [200, 100, 50, 255],
}));

import { buildVectorLayer } from "../vectorLayer";

describe("buildVectorLayer", () => {
  it("creates an MVTLayer with correct tile URL for non-PMTiles", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/collections/public.sandbox_abc123/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
    });
    expect(layer.id).toBe("vector-mvt");
    expect(layer.props.data).toContain("/vector/collections/");
  });

  it("creates an MVTLayer with pmtiles URL", () => {
    const layer = buildVectorLayer({
      tileUrl: "/pmtiles/sandbox_abc123.pmtiles",
      isPMTiles: true,
      opacity: 0.6,
    });
    expect(layer.id).toBe("vector-mvt");
  });

  it("is pickable for feature interaction", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/collections/public.sandbox_abc123/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
    });
    expect(layer.props.pickable).toBe(true);
  });

  it("disables loaders.gl workers so CSP doesn't block the MVT worker", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/collections/public.sandbox_abc123/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
    });
    expect(layer.props.loadOptions).toEqual({ worker: false });
  });

  it("disables loaders.gl workers for PMTiles layers as well", () => {
    const layer = buildVectorLayer({
      tileUrl: "/pmtiles/sandbox_abc123.pmtiles",
      isPMTiles: true,
      opacity: 0.6,
    });
    expect(layer.props.loadOptions).toEqual({ worker: false });
  });

  it("uses custom getFillColor when provided", () => {
    const customFill = (_f: unknown) =>
      [255, 0, 0, 200] as [number, number, number, number];
    const layer = buildVectorLayer({
      tileUrl: "/vector/collections/public.sandbox_abc123/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
      getFillColor: customFill,
    });
    expect(layer.props.getFillColor).toBe(customFill);
  });

  it("falls back to default fill color when getFillColor is not provided", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/collections/public.sandbox_abc123/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
    });
    expect(Array.isArray(layer.props.getFillColor)).toBe(true);
  });
});

describe("buildVectorLayer styling overrides", () => {
  it("uses provided line color and width", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
      getLineColor: [1, 2, 3, 200],
      lineWidthMinPixels: 3,
    });
    expect(layer.props.getLineColor).toEqual([1, 2, 3, 200]);
    expect(layer.props.lineWidthMinPixels).toBe(3);
  });

  it("falls back to brand line color and default width", () => {
    const layer = buildVectorLayer({
      tileUrl: "/vector/tiles/{z}/{x}/{y}",
      isPMTiles: false,
      opacity: 1,
    });
    expect(layer.props.getLineColor).toEqual([200, 100, 50, 255]);
    expect(layer.props.lineWidthMinPixels).toBe(1);
  });
});
