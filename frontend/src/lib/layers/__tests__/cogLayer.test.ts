import { describe, it, expect, vi } from "vitest";

vi.mock("@developmentseed/deck.gl-geotiff", () => ({
  COGLayer: vi.fn().mockImplementation(function MockCOGLayer(props) {
    return { props };
  }),
}));

vi.mock("@developmentseed/deck.gl-raster/gpu-modules", () => ({
  CreateTexture: {},
  Colormap: {},
}));

import { buildCogLayerContinuous, resolveCogUrl } from "../cogLayer";

describe("resolveCogUrl", () => {
  it("passes https URLs through unchanged", () => {
    expect(resolveCogUrl("https://example.com/foo.tif")).toBe(
      "https://example.com/foo.tif"
    );
  });

  it("passes http URLs through unchanged", () => {
    expect(resolveCogUrl("http://example.com/foo.tif")).toBe(
      "http://example.com/foo.tif"
    );
  });

  it("matches protocol case-insensitively", () => {
    expect(resolveCogUrl("HTTPS://example.com/foo.tif")).toBe(
      "HTTPS://example.com/foo.tif"
    );
  });

  it("resolves root-relative paths against window origin", () => {
    expect(resolveCogUrl("/storage/foo.tif")).toBe(
      `${window.location.origin}/storage/foo.tif`
    );
  });

  it("resolves path-relative inputs against window origin", () => {
    expect(resolveCogUrl("storage/foo.tif")).toBe(
      `${window.location.origin}/storage/foo.tif`
    );
  });
});

describe("buildCogLayerContinuous", () => {
  it("passes unpadded r8 texture data to deck.gl-raster 0.5", async () => {
    const layers = buildCogLayerContinuous({
      cogUrl: "/cog/example.tif",
      opacity: 1,
      rasterMin: 0,
      rasterMax: 6,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getTileData = (layers[0] as any).props.getTileData;

    const fakeTile = {
      array: {
        layout: "interleaved",
        bands: [],
        data: new Float32Array([0, 1, 2, 3, 4, 6]),
        width: 3,
        height: 2,
      },
    };
    const image = {
      fetchTile: vi.fn().mockResolvedValue(fakeTile),
    };
    const device = {
      createTexture: vi.fn().mockReturnValue({ mock: "tex" }),
    };

    await getTileData(image, {
      device,
      x: 3,
      y: 5,
      signal: new AbortController().signal,
    });

    expect(device.createTexture).toHaveBeenCalledWith(
      expect.objectContaining({
        data: new Uint8Array([0, 43, 85, 128, 170, 255]),
        format: "r8unorm",
        width: 3,
        height: 2,
      })
    );
  });
});
