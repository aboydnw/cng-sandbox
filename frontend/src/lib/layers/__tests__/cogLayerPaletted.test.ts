import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@developmentseed/deck.gl-geotiff", () => ({
  COGLayer: vi.fn().mockImplementation((props) => ({ props })),
}));

vi.mock("@developmentseed/deck.gl-raster/gpu-modules", () => ({
  CreateTexture: {},
}));

import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import { buildCogLayerPaletted } from "../cogLayer";

describe("buildCogLayerPaletted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs a COGLayer with no custom getTileData/renderTile", () => {
    const layers = buildCogLayerPaletted({
      cogUrl: "/cog/test.tif",
      opacity: 0.75,
    });

    expect(layers).toHaveLength(1);
    expect(COGLayer).toHaveBeenCalledTimes(1);
    const props = (COGLayer as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as Record<string, unknown>;

    expect(props.getTileData).toBeUndefined();
    expect(props.renderTile).toBeUndefined();
    expect(props.opacity).toBe(0.75);
    expect(typeof props.geotiff).toBe("string");
    // Must be an absolute URL — MapLibre and deck.gl-geotiff both fail on
    // relative ones when the dev-server proxy is involved.
    expect(props.geotiff).toMatch(/^https?:\/\//);
    expect(props.geotiff as string).toContain("/cog/test.tif");
  });

  it("propagates opacity changes to a stable layer id", () => {
    const layers = buildCogLayerPaletted({
      cogUrl: "/cog/test.tif",
      opacity: 0.25,
    });
    const props = (layers[0] as { props: Record<string, unknown> }).props;
    expect(props.id).toBe("direct-cog-layer-paletted");
  });
});
