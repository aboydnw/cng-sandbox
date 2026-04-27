import { parseWkt } from "@developmentseed/proj";
import type { ProjectionDefinition } from "@developmentseed/proj";

const EPSG_UTM_NORTH_BASE = 32600;
const EPSG_UTM_SOUTH_BASE = 32700;
const CONVERSION_UTM_NORTH_BASE = 16000;
const CONVERSION_UTM_SOUTH_BASE = 16100;
const FALSE_NORTHING_SOUTH = 10_000_000;

function epsgCode(zone: number, hemisphere: "N" | "S"): number {
  return (
    (hemisphere === "N" ? EPSG_UTM_NORTH_BASE : EPSG_UTM_SOUTH_BASE) + zone
  );
}

function utmZoneWkt(zone: number, hemisphere: "N" | "S"): string {
  const lon0 = -177 + 6 * (zone - 1);
  const falseNorthing = hemisphere === "N" ? 0 : FALSE_NORTHING_SOUTH;
  const convId =
    (hemisphere === "N"
      ? CONVERSION_UTM_NORTH_BASE
      : CONVERSION_UTM_SOUTH_BASE) + zone;
  return `PROJCRS["WGS 84 / UTM zone ${zone}${hemisphere}",BASEGEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1,ID["EPSG",9001]],ID["EPSG",7030]],ID["EPSG",6326]],ID["EPSG",4326]],CONVERSION["UTM zone ${zone}${hemisphere}",METHOD["Transverse Mercator",ID["EPSG",9807]],PARAMETER["Latitude of natural origin",0,ANGLEUNIT["degree",0.0174532925199433,ID["EPSG",9102]],ID["EPSG",8801]],PARAMETER["Longitude of natural origin",${lon0},ANGLEUNIT["degree",0.0174532925199433,ID["EPSG",9102]],ID["EPSG",8802]],PARAMETER["Scale factor at natural origin",0.9996,SCALEUNIT["unity",1,ID["EPSG",9201]],ID["EPSG",8805]],PARAMETER["False easting",500000,LENGTHUNIT["metre",1,ID["EPSG",9001]],ID["EPSG",8806]],PARAMETER["False northing",${falseNorthing},LENGTHUNIT["metre",1,ID["EPSG",9001]],ID["EPSG",8807]],ID["EPSG",${convId}]],CS[Cartesian,2,ID["EPSG",4400]],AXIS["Easting (E)",east],AXIS["Northing (N)",north],LENGTHUNIT["metre",1,ID["EPSG",9001]],ID["EPSG",${epsgCode(zone, hemisphere)}]]`;
}

/** Returns a Map from EPSG code (32601–32660, 32701–32760) to ProjectionDefinition
 *  for all 120 WGS 84 UTM zones. */
export function generateUtmZones(): Map<number, ProjectionDefinition> {
  const map = new Map<number, ProjectionDefinition>();
  for (let zone = 1; zone <= 60; zone++) {
    for (const hemisphere of ["N", "S"] as const) {
      map.set(
        epsgCode(zone, hemisphere),
        parseWkt(utmZoneWkt(zone, hemisphere))
      );
    }
  }
  return map;
}
