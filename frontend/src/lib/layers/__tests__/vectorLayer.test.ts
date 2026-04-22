import { describe, it, expect } from "vitest";
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
});
