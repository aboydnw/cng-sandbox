import { describe, expect, it } from "vitest";
import { buildDatasetServerTileUrl } from "../src/lib/story/rendering";
import type { Dataset } from "../src/types";
import type { LayerConfig } from "../src/lib/story/types";

function makeDataset(overrides: Partial<Dataset>): Dataset {
  return {
    tile_url:
      "/raster/collections/sandbox-x/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=data",
    band_count: 1,
    raster_min: 0,
    raster_max: 100,
    is_temporal: false,
    timesteps: [],
    ...(overrides as Dataset),
  } as Dataset;
}

const lc: LayerConfig = {
  dataset_id: "x",
  colormap: "viridis",
  opacity: 1,
  basemap: "streets",
};

describe("buildDatasetServerTileUrl", () => {
  it("applies colormap for single-band data", () => {
    const url = buildDatasetServerTileUrl(
      makeDataset({ band_count: 1 }),
      lc,
      null,
      null
    );
    expect(url).toContain("colormap_name=viridis");
    expect(url).toContain("rescale=0,100");
  });

  it("omits colormap and rescale for 3-band RGB data", () => {
    const url = buildDatasetServerTileUrl(
      makeDataset({ band_count: 3 }),
      lc,
      null,
      null
    );
    expect(url).not.toContain("colormap_name");
    expect(url).not.toContain("rescale");
  });
});
