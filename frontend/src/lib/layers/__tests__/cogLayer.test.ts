import { describe, it, expect, vi } from "vitest";

vi.mock("@developmentseed/deck.gl-geotiff", () => ({
  COGLayer: vi.fn(),
}));

vi.mock("@developmentseed/deck.gl-raster/gpu-modules", () => ({
  CreateTexture: {},
}));

import { resolveCogUrl } from "../cogLayer";

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

  it("prepends window origin for relative paths", () => {
    expect(resolveCogUrl("/storage/foo.tif")).toBe(
      `${window.location.origin}/storage/foo.tif`
    );
  });
});
