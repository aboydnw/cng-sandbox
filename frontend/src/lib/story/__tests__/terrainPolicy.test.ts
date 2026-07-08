import { describe, it, expect } from "vitest";
import { chapterAllowsTerrain } from "../terrainPolicy";

describe("chapterAllowsTerrain", () => {
  it("allows terrain for a scene-setting chapter with no data", () => {
    expect(
      chapterAllowsTerrain({
        dataset_id: "",
        colormap: "viridis",
        opacity: 1,
        basemap: "streets",
      })
    ).toBe(true);
    expect(chapterAllowsTerrain(null)).toBe(true);
    expect(chapterAllowsTerrain(undefined)).toBe(true);
  });

  it("blocks terrain when a dataset is bound", () => {
    expect(
      chapterAllowsTerrain({
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 1,
        basemap: "streets",
      })
    ).toBe(false);
  });

  it("blocks terrain when a connection is bound", () => {
    expect(
      chapterAllowsTerrain({
        dataset_id: "",
        connection_id: "conn-1",
        colormap: "viridis",
        opacity: 1,
        basemap: "streets",
      })
    ).toBe(false);
  });
});
