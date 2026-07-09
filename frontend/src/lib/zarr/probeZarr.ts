import * as zarr from "zarrita";
import { createZarrStore } from "./zarrFetch";
import { extractStats, type VariableStats } from "./zarrStats";

/** Sentinel error message used when a store lacks consolidated metadata. */
export const ZARR_NOT_CONSOLIDATED =
  "This Zarr store does not include consolidated metadata. " +
  "CNG sandbox needs `.zmetadata` (v2) or a `consolidated_metadata` block in " +
  "`zarr.json` (v3) to enumerate variables. Enter a variable path below to probe a single array directly.";

export type ZarrCompatibility =
  { kind: "ok" } | { kind: "incompatible"; reason: string };

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
  /** Name of a recognized non-spatial, non-time dim, if any. */
  extraDim: string | null;
  /** Decoded labels for the extra dim (e.g. ["B02","B03","B04"]). Falls back to ["0","1",...]. */
  extraLabels: string[] | null;
  compatibility: ZarrCompatibility;
}

export interface ZarrProbeResult {
  variables: ZarrVariable[];
  /** Soft warning when a probable non-4326 CRS is detected on any variable. */
  crsWarning: string | null;
  /** Plain `group.attrs` from the root group; used to detect GeoZarr metadata. */
  rootAttrs: Record<string, unknown> | null;
}

const TIME_DIM_NAMES = new Set(["time", "t", "valid_time"]);
const EXTRA_DIM_NAMES = new Set([
  "band",
  "level",
  "channel",
  "depth",
  "z",
  "pressure",
  "height",
]);
const MAX_EXTRA_DIM_LENGTH = 256;

function inferTimeDim(dimNames: string[]): string | null {
  for (const name of dimNames) {
    if (TIME_DIM_NAMES.has(name.toLowerCase())) return name;
  }
  return null;
}

function inferExtraDim(dimNames: string[]): string | null {
  for (const n of dimNames) {
    if (EXTRA_DIM_NAMES.has(n.toLowerCase())) return n;
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

  const timeDim = inferTimeDim(dimNames);
  const extraDim = inferExtraDim(dimNames);

  if (shape.length === 3) {
    if (timeDim) return { kind: "ok" };
    if (extraDim) {
      const len = shape[dimNames.indexOf(extraDim)];
      if (len > MAX_EXTRA_DIM_LENGTH) {
        return {
          kind: "incompatible",
          reason: `Extra dim "${extraDim}" has ${len} entries (> ${MAX_EXTRA_DIM_LENGTH}). Continuous third axes aren't supported.`,
        };
      }
      return { kind: "ok" };
    }
    return {
      kind: "incompatible",
      reason: `Variable has 3 dimensions but the extra one is not recognized as a time or band/level dimension.`,
    };
  }

  if (shape.length === 4) {
    if (timeDim && extraDim) {
      const len = shape[dimNames.indexOf(extraDim)];
      if (len > MAX_EXTRA_DIM_LENGTH) {
        return {
          kind: "incompatible",
          reason: `Extra dim "${extraDim}" has ${len} entries (> ${MAX_EXTRA_DIM_LENGTH}).`,
        };
      }
      return { kind: "ok" };
    }
    return {
      kind: "incompatible",
      reason: `Variable has 4 dimensions (${dimNames.join(", ")}); need both a time dim and one band/level/channel-like dim.`,
    };
  }

  return {
    kind: "incompatible",
    reason: `Variable has ${shape.length} dimensions (${dimNames.join(", ")}); 2D + optional time + optional band is the limit.`,
  };
}

async function decodeExtraLabels(
  group: zarr.Group<zarr.Readable>,
  coordPath: string,
  fallbackLength: number
): Promise<string[]> {
  try {
    const arr = await zarr.open(group.resolve(coordPath), { kind: "array" });
    const slab = (await zarr.get(arr, [null])) as { data: ArrayLike<unknown> };
    const out: string[] = [];
    for (let i = 0; i < slab.data.length; i++) {
      const v = slab.data[i];
      out.push(typeof v === "string" ? v : String(v));
    }
    return out;
  } catch {
    return Array.from({ length: fallbackLength }, (_, i) => String(i));
  }
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
  const extraDim = inferExtraDim(dimNames);
  const stats = extractStats(arr.attrs as Record<string, unknown>);

  const parentPath = cleanPath.includes("/")
    ? cleanPath.slice(0, cleanPath.lastIndexOf("/"))
    : "";
  let root: zarr.Group<zarr.Readable> | null;
  try {
    root = await zarr.open(store, { kind: "group" });
  } catch {
    root = null;
  }

  let timesteps: ZarrTimestep[] | null = null;
  if (timeDim && compatibility.kind === "ok" && root) {
    const coordPath = parentPath ? `${parentPath}/${timeDim}` : timeDim;
    try {
      timesteps = await decodeTimeValues(root, coordPath);
    } catch {
      timesteps = null;
    }
  }

  let extraLabels: string[] | null = null;
  if (extraDim && compatibility.kind === "ok" && root) {
    const extraLen = arr.shape[dimNames.indexOf(extraDim)];
    const coordPath = parentPath ? `${parentPath}/${extraDim}` : extraDim;
    extraLabels = await decodeExtraLabels(root, coordPath, extraLen);
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
    extraDim,
    extraLabels,
    compatibility,
  };
  const crsWarning = detectCrsWarning(variable.attrs);
  const rootAttrs = root ? (root.attrs as Record<string, unknown>) : null;
  return { variables: [variable], crsWarning, rootAttrs };
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
      const extraDim = inferExtraDim(dimNames);
      const stats = extractStats(arr.attrs as Record<string, unknown>);
      const parentPath = name.includes("/")
        ? name.slice(0, name.lastIndexOf("/"))
        : "";
      let timesteps: ZarrTimestep[] | null = null;
      if (timeDim && compatibility.kind === "ok") {
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
      let extraLabels: string[] | null = null;
      if (extraDim && compatibility.kind === "ok") {
        const extraLen = arr.shape[dimNames.indexOf(extraDim)];
        const coordPath = parentPath ? `${parentPath}/${extraDim}` : extraDim;
        extraLabels = await decodeExtraLabels(root, coordPath, extraLen);
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
        extraDim,
        extraLabels,
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

  return {
    variables,
    crsWarning,
    rootAttrs: root.attrs as Record<string, unknown>,
  };
}
