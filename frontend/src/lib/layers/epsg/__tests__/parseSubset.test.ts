import { describe, it, expect } from "vitest";
import { parseSubsetCsv } from "../parseSubset";

describe("parseSubsetCsv", () => {
  it("parses a single line into a Map entry", () => {
    const csv = `4326|GEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]]],CS[ellipsoidal,2],AXIS["Geodetic latitude",north],AXIS["Geodetic longitude",east],ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",4326]]`;
    const map = parseSubsetCsv(csv);
    expect(map.size).toBe(1);
    expect(map.has(4326)).toBe(true);
    const def = map.get(4326)!;
    expect(def).toBeDefined();
    expect(def.projName).toBeDefined();
  });

  it("ignores blank lines", () => {
    const csv = `\n4326|GEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]]],CS[ellipsoidal,2],AXIS["Geodetic latitude",north],AXIS["Geodetic longitude",east],ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",4326]]\n\n`;
    const map = parseSubsetCsv(csv);
    expect(map.size).toBe(1);
  });

  it("throws on a malformed line", () => {
    const csv = `not-a-number|some-wkt`;
    expect(() => parseSubsetCsv(csv)).toThrow();
  });

  it("parses all 31 entries from the real subset", async () => {
    const subsetText = (await import("../subset.csv?raw")).default;
    const map = parseSubsetCsv(subsetText);
    expect(map.size).toBe(31);
    expect(map.has(4326)).toBe(true);
    expect(map.has(5070)).toBe(true);
    expect(map.has(2154)).toBe(true);
  });
});
