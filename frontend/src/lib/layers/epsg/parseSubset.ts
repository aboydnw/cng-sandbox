import { parseWkt } from "@developmentseed/proj";
import type { ProjectionDefinition } from "@developmentseed/proj";

const SEP = "|";

export function parseSubsetCsv(
  text: string
): Map<number, ProjectionDefinition> {
  const map = new Map<number, ProjectionDefinition>();
  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const sepIdx = line.indexOf(SEP);
    if (sepIdx <= 0) {
      throw new Error(
        `Malformed subset line (no separator): ${line.slice(0, 40)}`
      );
    }
    const code = Number(line.slice(0, sepIdx));
    if (!Number.isInteger(code)) {
      throw new Error(
        `Malformed subset line (non-integer code): ${line.slice(0, 40)}`
      );
    }
    const wkt = line.slice(sepIdx + 1);
    map.set(code, normalizeProjection(parseWkt(wkt)));
  }
  return map;
}

// wkt-parser doesn't recognize WKT2 ANGLEUNIT and returns `units: "unknown"`
// for geographic CRSes. Downstream consumers (e.g. metersPerUnit in
// @developmentseed/proj) require "degree" — without this fix, every
// EPSG:4326 COG that hits the client render path crashes.
function normalizeProjection(def: ProjectionDefinition): ProjectionDefinition {
  if (def.projName === "longlat" && def.units !== "degree") {
    return { ...def, units: "degree" };
  }
  return def;
}
