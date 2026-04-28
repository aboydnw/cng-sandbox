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

describe("buildCogLayerContinuous projection plumbing", () => {
  it("passes onGeoTIFFLoad to COGLayer and tile data carries the projector after it fires", async () => {
    const layers = buildCogLayerContinuous({
      cogUrl: "/cog/example.tif",
      opacity: 1,
      rasterMin: 0,
      rasterMax: 1,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (layers[0] as any).props;
    expect(typeof props.onGeoTIFFLoad).toBe("function");

    const fakeTile = {
      array: {
        layout: "interleaved",
        bands: [],
        data: new Float32Array([0, 1, 0, 1]),
        width: 2,
        height: 2,
      },
    };
    const image = { fetchTile: vi.fn().mockResolvedValue(fakeTile) };
    const device = { createTexture: vi.fn().mockReturnValue({ mock: "tex" }) };

    // Before onGeoTIFFLoad fires, the projector is null — the inspector falls
    // back to lng/lat-linear in this brief window.
    let result = await props.getTileData(image, {
      device,
      x: 0,
      y: 0,
      signal: new AbortController().signal,
    });
    expect(result.projectFrom4326).toBeNull();

    // Simulate the load callback with a known EPSG built into proj4.
    props.onGeoTIFFLoad({}, { projection: "EPSG:3857" });

    result = await props.getTileData(image, {
      device,
      x: 0,
      y: 0,
      signal: new AbortController().signal,
    });
    expect(typeof result.projectFrom4326).toBe("function");
    // EPSG:4326 → EPSG:3857 at (0, 0) is (0, 0) and at the equator/lng=180 is
    // ~(20037508, 0). Coarse range check is enough to confirm proj4 wired up.
    const [x0, y0] = result.projectFrom4326(0, 0);
    expect(Math.abs(x0)).toBeLessThan(1e-6);
    expect(Math.abs(y0)).toBeLessThan(1e-6);
    const [x180] = result.projectFrom4326(180, 0);
    expect(x180).toBeGreaterThan(2e7);
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
