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

  it("normalizes geographic-CRS units to 'degree' (wkt-parser returns 'unknown' for WKT2 GEOGCRS)", () => {
    // Real EPSG:4326 WKT2 from subset.csv. Without normalization, wkt-parser
    // emits units: "unknown", which propagates through cngEpsgResolver and
    // crashes generateTileMatrixSet → metersPerUnit on every geographic COG.
    const csv = `4326|GEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)",ID["EPSG",1166]],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1,ID["EPSG",9001]],ID["EPSG",7030]],ENSEMBLEACCURACY[2],ID["EPSG",6326]],CS[ellipsoidal,2,ID["EPSG",6422]],AXIS["Geodetic latitude (Lat)",north],AXIS["Geodetic longitude (Lon)",east],ANGLEUNIT["degree",0.0174532925199433,ID["EPSG",9102]],ID["EPSG",4326]]`;
    const def = parseSubsetCsv(csv).get(4326)!;
    expect(def.projName).toBe("longlat");
    expect(def.units).toBe("degree");
  });

  it("leaves projected-CRS units alone", () => {
    // EPSG:5070 (NAD83 / Conus Albers) — uses metres. Must not be rewritten.
    const csv = `5070|PROJCRS["NAD83 / Conus Albers",BASEGEOGCRS["NAD83",DATUM["North American Datum 1983",ELLIPSOID["GRS 1980",6378137,298.257222101,LENGTHUNIT["metre",1]]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],ID["EPSG",4269]],CONVERSION["Conus Albers",METHOD["Albers Equal Area",ID["EPSG",9822]],PARAMETER["Latitude of false origin",23,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8821]],PARAMETER["Longitude of false origin",-96,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8822]],PARAMETER["Latitude of 1st standard parallel",29.5,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8823]],PARAMETER["Latitude of 2nd standard parallel",45.5,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8824]],PARAMETER["Latitude of false origin",23,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8826]],PARAMETER["Longitude of false origin",-96,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8827]]],CS[Cartesian,2],AXIS["easting (X)",east,ORDER[1],LENGTHUNIT["metre",1]],AXIS["northing (Y)",north,ORDER[2],LENGTHUNIT["metre",1]],ID["EPSG",5070]]`;
    const def = parseSubsetCsv(csv).get(5070)!;
    expect(def.units).not.toBe("degree");
  });
});
