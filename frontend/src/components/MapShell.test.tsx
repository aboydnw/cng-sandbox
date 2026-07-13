import { describe, expect, it } from "vitest";

import { BASEMAPS, BASEMAP_OPTIONS } from "./MapShell";

describe("BASEMAPS", () => {
  it("keeps the existing CARTO vector basemaps as style-URL strings", () => {
    expect(BASEMAPS.streets).toBe(
      "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    );
    expect(BASEMAPS.satellite).toBe(
      "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    );
    expect(BASEMAPS.dark).toBe(
      "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    );
  });

  it("exposes imagery as an Esri World Imagery raster style with attribution", () => {
    const style = BASEMAPS.imagery;
    expect(typeof style).toBe("object");
    if (typeof style === "string") throw new Error("expected a style object");

    expect(style.version).toBe(8);

    const source = style.sources["esri-imagery"];
    expect(source.type).toBe("raster");
    if (source.type !== "raster") throw new Error("expected a raster source");

    expect(source.tiles?.[0]).toContain("server.arcgisonline.com");
    expect(source.tiles?.[0]).toContain("World_Imagery");
    expect(source.attribution).toBeTruthy();

    expect(style.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "esri-imagery",
          type: "raster",
          source: "esri-imagery",
        }),
      ])
    );
  });
});

describe("BASEMAP_OPTIONS", () => {
  it("offers a Satellite option keyed to imagery alongside the original three", () => {
    const keys = BASEMAP_OPTIONS.map((o) => o.key);
    expect(keys).toEqual(
      expect.arrayContaining(["streets", "satellite", "dark", "imagery"])
    );

    const imagery = BASEMAP_OPTIONS.find((o) => o.key === "imagery");
    expect(imagery?.label).toBe("Satellite");
  });
});
