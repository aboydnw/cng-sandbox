import * as zarr from "zarrita";
import { createZarrStore } from "./zarrFetch";
import { extractStats, type VariableStats } from "./zarrStats";

/** Sentinel error message used when a store lacks consolidated metadata. */
export const ZARR_NOT_CONSOLIDATED =
  "This Zarr store does not include consolidated metadata. " +
  "CNG sandbox needs `.zmetadata` (v2) or a `consolidated_metadata` block in " +
  "`zarr.json` (v3) to enumerate variables. Enter a variable path below to probe a single array directly.";

export type ZarrCompatibility =
  | { kind: "ok" }
  | { kind: "incompatible"; reason: string };

/** Above this length, the time coord is decimated to ~5000 evenly-spaced samples. */
const MAX_TIME_STEPS_DECODED = 5000;

export interface ZarrTimestep {
  datetime: string;
  /** Actual zarr time-coord index (NOT the position in this array). */
  index: number;
}

export interface ZarrVariable {
  name: string;
  shape: number[];
  dimNames: string[];
  dtype: string;
  attrs: Record<string, unknown>;
  stats: VariableStats | null;
  /** Name of the time-like dim in `dimNames`, if any. */
  timeDim: string | null;
  /** Decoded time-coord values. Decimated when the coord is huge. `null` when decoding failed. */
  timesteps: ZarrTimestep[] | null;
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
): Promise<ZarrTimestep[] | null> {
  try {
    const arr = await zarr.open(group.resolve(coordPath), { kind: "array" });
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

    const total = arr.shape[0];
    const stride = Math.max(1, Math.ceil(total / MAX_TIME_STEPS_DECODED));
    const indices: number[] = [];
    for (let i = 0; i < total; i += stride) indices.push(i);
    if (indices[indices.length - 1] !== total - 1) indices.push(total - 1);

    const slab = (await zarr.get(arr, [null])) as { data: ArrayLike<number> };
    const out: ZarrTimestep[] = [];
    for (const idx of indices) {
      out.push({
        datetime: new Date(
          epoch + Number(slab.data[idx]) * factor
        ).toISOString(),
        index: idx,
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Opens a single named array within the zarr store at `url` and returns a
 * one-variable `ZarrProbeResult`. Unlike `probeZarr`, this does NOT require
 * consolidated metadata — it does a direct GET on the array's metadata file.
 * Use this when the user has supplied a variable path manually after the
 * consolidated probe failed.
 *
 * Throws if the path does not resolve to a zarr array.
 */
export async function probeZarrSingleArray(
  url: string,
  path: string
): Promise<ZarrProbeResult> {
  const store = createZarrStore(url);
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  if (!cleanPath) {
    throw new Error("Variable path is required.");
  }
  let arr: zarr.Array<zarr.DataType, zarr.Readable>;
  try {
    const location = new zarr.Location(store, `/${cleanPath}` as `/${string}`);
    arr = await zarr.open(location, { kind: "array" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not open array at "${cleanPath}": ${msg}. Check the path and that the zarr store is publicly readable.`,
      { cause: err }
    );
  }
  const dimNames = (arr.dimensionNames ?? []).map((n) => n ?? "");
  const compatibility = classifyVariable(arr.shape, dimNames);
  const timeDim = inferTimeDim(dimNames);
  const stats = extractStats(arr.attrs as Record<string, unknown>);

  let timesteps: ZarrTimestep[] | null = null;
  if (timeDim && compatibility.kind === "ok") {
    const parentPath = cleanPath.includes("/")
      ? cleanPath.slice(0, cleanPath.lastIndexOf("/"))
      : "";
    const coordPath = parentPath ? `${parentPath}/${timeDim}` : timeDim;
    try {
      const root = await zarr.open(store, { kind: "group" });
      timesteps = await decodeTimeValues(root, coordPath);
    } catch {
      timesteps = null;
    }
  }

  const variable: ZarrVariable = {
    name: cleanPath,
    shape: arr.shape,
    dimNames,
    dtype: arr.dtype,
    attrs: arr.attrs as Record<string, unknown>,
    stats,
    timeDim,
    timesteps,
    compatibility,
  };
  const crsWarning = detectCrsWarning(variable.attrs);
  return { variables: [variable], crsWarning };
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
  const timestepsCache = new Map<string, ZarrTimestep[] | null>();

  for (const entry of arrayEntries) {
    const name = entry.path.replace(/^\//, "");
    if (!name) continue;
    try {
      const arr = await zarr.open(root.resolve(name), { kind: "array" });
      const dimNames = (arr.dimensionNames ?? []).map((n) => n ?? "");
      const compatibility = classifyVariable(arr.shape, dimNames);
      const timeDim = inferTimeDim(dimNames);
      const stats = extractStats(arr.attrs as Record<string, unknown>);
      let timesteps: ZarrTimestep[] | null = null;
      if (timeDim && compatibility.kind === "ok") {
        const parentPath = name.includes("/")
          ? name.slice(0, name.lastIndexOf("/"))
          : "";
        const scopedCoordPath = parentPath
          ? `${parentPath}/${timeDim}`
          : timeDim;
        if (timestepsCache.has(scopedCoordPath)) {
          timesteps = timestepsCache.get(scopedCoordPath) ?? null;
        } else {
          timesteps = await decodeTimeValues(root, scopedCoordPath);
          if (!timesteps && parentPath) {
            if (timestepsCache.has(timeDim)) {
              timesteps = timestepsCache.get(timeDim) ?? null;
            } else {
              timesteps = await decodeTimeValues(root, timeDim);
              timestepsCache.set(timeDim, timesteps);
            }
          }
          timestepsCache.set(scopedCoordPath, timesteps);
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
        timesteps,
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
