import { describe, it, expect } from "vitest";
import { buildGeoJsonLayer } from "../geojsonLayer";

describe("buildGeoJsonLayer", () => {
  it("returns empty array when geojson is null", () => {
    const layers = buildGeoJsonLayer({ geojson: null });
    expect(layers).toHaveLength(0);
  });

  it("returns empty array when feature collection is empty", () => {
    const layers = buildGeoJsonLayer({
      geojson: { type: "FeatureCollection", features: [] },
    });
    expect(layers).toHaveLength(0);
  });

  it("returns a GeoJsonLayer when features exist", () => {
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { name: "test" },
        },
      ],
    };
    const layers = buildGeoJsonLayer({ geojson });
    expect(layers).toHaveLength(1);
    expect(layers[0].id).toBe("geojson-layer");
  });
});
