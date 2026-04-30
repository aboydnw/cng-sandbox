import * as zarr from "zarrita";
import { createZarrStore } from "./zarrFetch";
import { extractStats, type VariableStats } from "./zarrStats";

/** Sentinel error message used when a store lacks consolidated metadata. */
export const ZARR_NOT_CONSOLIDATED =
  "This Zarr store does not include consolidated metadata. " +
  "CNG sandbox needs `.zmetadata` (v2) or a `consolidated_metadata` block in " +
  "`zarr.json` (v3) to enumerate variables. Manual variable entry is on the roadmap.";

export type ZarrCompatibility =
  | { kind: "ok" }
  | { kind: "incompatible"; reason: string };

export interface ZarrVariable {
  name: string;
  shape: number[];
  dimNames: string[];
  dtype: string;
  attrs: Record<string, unknown>;
  stats: VariableStats | null;
  /** Name of the time-like dim in `dimNames`, if any. */
  timeDim: string | null;
  /** Decoded time-coord values (ISO strings) when probable. `null` otherwise. */
  timeValues: string[] | null;
  compatibility: ZarrCompatibility;
}

export interface ZarrProbeResult {
  variables: ZarrVariable[];
  /** Soft warning when a probable non-4326 CRS is detected on any variable. */
  crsWarning: string | null;
}

const TIME_DIM_NAMES = new Set(["time", "t", "valid_time"]);

function inferTimeDim(dimNames: string[]): string | null {
  for (const name of dimNames) {
    if (TIME_DIM_NAMES.has(name.toLowerCase())) return name;
  }
  return null;
}

function classifyVariable(
  shape: number[],
  dimNames: string[]
): ZarrCompatibility {
  if (shape.length < 2) {
    return {
      kind: "incompatible",
      reason: `Variable has only ${shape.length} dimension(s); need at least 2 spatial dims.`,
    };
  }
  if (shape.length === 2) return { kind: "ok" };
  if (shape.length === 3) {
    if (inferTimeDim(dimNames) !== null) return { kind: "ok" };
    return {
      kind: "incompatible",
      reason: `Variable has 3 dimensions but the extra one (${
        dimNames.find(
          (n) =>
            !["x", "y", "lat", "lon", "latitude", "longitude"].includes(
              n.toLowerCase()
            )
        ) ?? dimNames[0]
      }) is not recognized as a time dimension. Multidimensional Zarr support is on the roadmap.`,
    };
  }
  return {
    kind: "incompatible",
    reason: `Variable has ${shape.length} dimensions (${dimNames.join(", ")}); only 2D + optional time are supported at MVP. Extra dimensions beyond time/lat/lon are not yet handled.`,
  };
}

function detectCrsWarning(attrs: Record<string, unknown>): string | null {
  const wkt = attrs.crs_wkt ?? attrs.spatial_ref ?? attrs._CRS;
  if (typeof wkt !== "string") return null;
  if (/EPSG\D*4326|WGS\s*84/i.test(wkt)) return null;
  return `Variable CRS appears non-EPSG:4326 (${wkt.slice(0, 80)}…). Rendering may be misaligned.`;
}

async function decodeTimeValues(
  group: zarr.Group<zarr.Readable>,
  coordPath: string
): Promise<string[] | null> {
  try {
    const arr = await zarr.open(group.resolve(coordPath), { kind: "array" });
    const slab = (await zarr.get(arr, [null])) as { data: ArrayLike<number> };
    const units = arr.attrs.units;
    if (typeof units !== "string") return null;
    const match = units.match(/(second|minute|hour|day)s?\s+since\s+(.+)/i);
    if (!match) return null;
    const unit = match[1].toLowerCase();
    const rawEpoch = match[2].trim().replace(" ", "T");
    const normalizedEpoch = /[zZ]|[+-]\d{2}:?\d{2}$/.test(rawEpoch)
      ? rawEpoch
      : `${rawEpoch}Z`;
    const epoch = new Date(normalizedEpoch).getTime();
    if (Number.isNaN(epoch)) return null;
    const factor =
      unit === "second"
        ? 1000
        : unit === "minute"
          ? 60_000
          : unit === "hour"
            ? 3_600_000
            : 86_400_000;
    const values: string[] = [];
    for (let i = 0; i < slab.data.length; i++) {
      values.push(
        new Date(epoch + Number(slab.data[i]) * factor).toISOString()
      );
    }
    return values;
  } catch {
    return null;
  }
}

interface ContentEntry {
  path: string;
  kind: "array" | "group";
}

interface ListableStore {
  contents(): ContentEntry[];
}

function isListable(store: unknown): store is ListableStore {
  return (
    typeof store === "object" &&
    store !== null &&
    typeof (store as { contents?: unknown }).contents === "function"
  );
}

/**
 * Opens the zarr store at `url` and returns a snapshot of every array under
 * the root group, with stats parsed and dimensionality classified. Throws
 * with `ZARR_NOT_CONSOLIDATED` if the store has no consolidated metadata —
 * the modal must catch and surface that message.
 */
export async function probeZarr(url: string): Promise<ZarrProbeResult> {
  const rawStore = createZarrStore(url);
  const maybeListable = await zarr.withMaybeConsolidatedMetadata(rawStore);
  if (!isListable(maybeListable)) {
    throw new Error(ZARR_NOT_CONSOLIDATED);
  }

  const store = maybeListable as typeof rawStore & ListableStore;
  const root = await zarr.open(store, { kind: "group" });

  const arrayEntries = store
    .contents()
    .filter((entry) => entry.kind === "array");

  const variables: ZarrVariable[] = [];
  let crsWarning: string | null = null;
  const timeValuesCache = new Map<string, string[] | null>();

  for (const entry of arrayEntries) {
    const name = entry.path.replace(/^\//, "");
    if (!name) continue;
    try {
      const arr = await zarr.open(root.resolve(name), { kind: "array" });
      const dimNames = (arr.dimensionNames ?? []).map((n) => n ?? "");
      const compatibility = classifyVariable(arr.shape, dimNames);
      const timeDim = inferTimeDim(dimNames);
      const stats = extractStats(arr.attrs as Record<string, unknown>);
      let timeValues: string[] | null = null;
      if (timeDim && compatibility.kind === "ok") {
        const parentPath = name.includes("/")
          ? name.slice(0, name.lastIndexOf("/"))
          : "";
        const scopedCoordPath = parentPath
          ? `${parentPath}/${timeDim}`
          : timeDim;
        if (timeValuesCache.has(scopedCoordPath)) {
          timeValues = timeValuesCache.get(scopedCoordPath) ?? null;
        } else {
          timeValues = await decodeTimeValues(root, scopedCoordPath);
          if (!timeValues && parentPath) {
            if (timeValuesCache.has(timeDim)) {
              timeValues = timeValuesCache.get(timeDim) ?? null;
            } else {
              timeValues = await decodeTimeValues(root, timeDim);
              timeValuesCache.set(timeDim, timeValues);
            }
          }
          timeValuesCache.set(scopedCoordPath, timeValues);
        }
      }
      const variable: ZarrVariable = {
        name,
        shape: arr.shape,
        dimNames,
        dtype: arr.dtype,
        attrs: arr.attrs as Record<string, unknown>,
        stats,
        timeDim,
        timeValues,
        compatibility,
      };
      variables.push(variable);
      if (!crsWarning) {
        crsWarning = detectCrsWarning(variable.attrs);
      }
    } catch {
      // Variables that fail to open are skipped — they're typically coordinate
      // arrays the renderer doesn't surface as user-pickable variables.
    }
  }

  return { variables, crsWarning };
}
