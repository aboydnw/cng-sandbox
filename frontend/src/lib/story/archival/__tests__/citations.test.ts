import { describe, it, expect } from "vitest";
import { buildCitationBlock } from "../citations";
import type { CngRcConfig } from "../../cngRcTypes";

describe("buildCitationBlock", () => {
  it("emits one entry per layer with source_url + attribution", () => {
    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s", workspace_id: null, exported_at: "" },
      metadata: { title: "T", description: null, author: null, created: "", updated: "" },
      chapters: [],
      layers: {
        a: {
          type: "raster-cog",
          source_url: "https://source.coop/gebco/data.tif",
          cng_url: null,
          label: "GEBCO Bathymetry",
          attribution: "GEBCO 2024",
          render: { colormap: null, rescale: null, opacity: 1, band: null, timestep: null },
        },
        b: {
          type: "vector-geoparquet",
          source_url: null,
          cng_url: "https://r2.cng.devseed.com/buildings.parquet",
          label: "Local buildings",
          attribution: null,
          render: { colormap: null, rescale: null, opacity: 1, band: null, timestep: null },
        },
      },
      assets: {},
    };

    const html = buildCitationBlock(config);
    expect(html).toContain("GEBCO Bathymetry");
    expect(html).toContain("https://source.coop/gebco/data.tif");
    expect(html).toContain("GEBCO 2024");
    expect(html).toContain("Local buildings");
    expect(html).toContain("https://r2.cng.devseed.com/buildings.parquet");
  });

  it("returns an empty string when there are no layers", () => {
    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s", workspace_id: null, exported_at: "" },
      metadata: { title: "T", description: null, author: null, created: "", updated: "" },
      chapters: [],
      layers: {},
      assets: {},
    };
    expect(buildCitationBlock(config)).toBe("");
  });

  it("escapes HTML in label and attribution", () => {
    const config: CngRcConfig = {
      version: "1",
      origin: { story_id: "s", workspace_id: null, exported_at: "" },
      metadata: { title: "T", description: null, author: null, created: "", updated: "" },
      chapters: [],
      layers: {
        a: {
          type: "raster-cog",
          source_url: "https://example.com/data.tif",
          cng_url: null,
          label: "<script>alert(1)</script>",
          attribution: null,
          render: { colormap: null, rescale: null, opacity: 1, band: null, timestep: null },
        },
      },
      assets: {},
    };
    const html = buildCitationBlock(config);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
