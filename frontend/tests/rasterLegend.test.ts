import { describe, expect, it } from "vitest";
import { buildRasterLegend } from "../src/lib/story/rasterLegend";

describe("buildRasterLegend", () => {
  it("returns an rgb legend for 3-band data", () => {
    const legend = buildRasterLegend({
      bandCount: 3,
      title: "Lahaina",
      domain: [0, 1],
      colors: ["#000", "#fff"],
      isCategorical: false,
    });
    expect(legend).toEqual({ type: "rgb", id: "raster", title: "Lahaina" });
  });

  it("returns a continuous legend for single-band data", () => {
    const legend = buildRasterLegend({
      bandCount: 1,
      title: "Bathymetry",
      domain: [0, 100],
      colors: ["#000", "#fff"],
      isCategorical: false,
    });
    expect(legend?.type).toBe("continuous");
  });

  it("returns null for categorical data", () => {
    const legend = buildRasterLegend({
      bandCount: 1,
      title: "Land cover",
      domain: [0, 1],
      colors: ["#000"],
      isCategorical: true,
    });
    expect(legend).toBeNull();
  });
});
