import { describe, it, expect, vi } from "vitest";
import proj4 from "proj4";

vi.mock("@developmentseed/deck.gl-geotiff", () => ({
  COGLayer: vi.fn(),
}));

vi.mock("@developmentseed/deck.gl-raster/gpu-modules", () => ({
  CreateTexture: {},
  Colormap: {},
}));

import { resolveCogUrl, localEpsgResolver } from "../cogLayer";

describe("localEpsgResolver (EPSG defs)", () => {
  // Regression: the local EPSG defs were missing proj4's required origin
  // params (long0, lat0, lat_ts, x0, y0, k0). proj4 tolerated the missing
  // source-side fields for longlat but silently produced NaN x values when
  // the def was used on either end of a merc converter. That NaN fed into
  // deck.gl-raster's tile traversal and crashed the bounding-volume
  // calculation, which then looped forever in the animation frame.
  it("produces finite forward/inverse coordinates between 4326 and 3857", async () => {
    const def4326 = await localEpsgResolver(4326);
    const def3857 = await localEpsgResolver(3857);

    const samples: Array<[number, number]> = [
      [11, 47],
      [-156, 76],
      [-156, -76],
      [0, 0],
      [179, 84],
    ];

    const forward = proj4(def4326 as never, def3857 as never);
    for (const [lon, lat] of samples) {
      const [x, y] = forward.forward([lon, lat]);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }

    const inverse = proj4(def3857 as never, def4326 as never);
    for (const [lon, lat] of samples) {
      const [fx, fy] = forward.forward([lon, lat]);
      const [ilon, ilat] = inverse.forward([fx, fy]);
      expect(ilon).toBeCloseTo(lon, 6);
      expect(ilat).toBeCloseTo(lat, 6);
    }
  });
});

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
