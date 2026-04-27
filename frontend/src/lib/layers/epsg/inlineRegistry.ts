import type { ProjectionDefinition } from "@developmentseed/proj";
import subsetCsvText from "./subset.csv?raw";
import { parseSubsetCsv } from "./parseSubset";
import { generateUtmZones } from "./utm";

function buildRegistry(): Map<number, ProjectionDefinition> {
  const map = parseSubsetCsv(subsetCsvText);
  for (const [code, def] of generateUtmZones()) {
    map.set(code, def);
  }
  return map;
}

export const INLINE_REGISTRY: ReadonlyMap<number, ProjectionDefinition> =
  buildRegistry();
