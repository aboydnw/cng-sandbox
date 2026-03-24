import { describe, it, expect } from "vitest";
import { buildCogTileUrl } from "./useExternalTiles";

describe("buildCogTileUrl", () => {
  it("builds single-band URL with colormap", () => {
    const url = buildCogTileUrl({
      assetUrl: "https://example.com/B04.tif",
      colormap: "viridis",
      rescale: [0, 3000],
    });
    expect(url).toContain("/cog/tiles/WebMercatorQuad/{z}/{x}/{y}");
    expect(url).toContain("url=https%3A%2F%2Fexample.com%2FB04.tif");
    expect(url).toContain("colormap_name=viridis");
    expect(url).toContain("rescale=0%2C3000");
  });

  it("builds multi-band RGB URL without colormap", () => {
    const url = buildCogTileUrl({
      assetUrl: "https://example.com/B04.tif",
      bands: ["B04", "B03", "B02"],
    });
    expect(url).toContain("/cog/tiles/WebMercatorQuad/{z}/{x}/{y}");
    expect(url).not.toContain("colormap_name");
  });

  it("uses config cogTilerUrl prefix", () => {
    const url = buildCogTileUrl({
      assetUrl: "https://example.com/data.tif",
      colormap: "plasma",
    });
    expect(url).toMatch(/^\/cog\//);
  });
});
