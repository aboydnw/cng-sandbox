import { parseWkt } from "@developmentseed/proj";
import type { ProjectionDefinition } from "@developmentseed/proj";

const SEP = "|";

export function parseSubsetCsv(text: string): Map<number, ProjectionDefinition> {
  const map = new Map<number, ProjectionDefinition>();
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const sepIdx = line.indexOf(SEP);
    if (sepIdx <= 0) {
      throw new Error(`Malformed subset line (no separator): ${line.slice(0, 40)}`);
    }
    const code = Number(line.slice(0, sepIdx));
    if (!Number.isInteger(code)) {
      throw new Error(`Malformed subset line (non-integer code): ${line.slice(0, 40)}`);
    }
    const wkt = line.slice(sepIdx + 1);
    map.set(code, parseWkt(wkt));
  }
  return map;
}
