import { useState, useEffect } from "react";
import * as zarr from "zarrita";
import { createZarrStore } from "../lib/zarr/zarrFetch";
import type { Connection } from "../types";
import type { ZarrNode } from "./useZarrNode";

/**
 * Opens the zarr store for a zarr `Connection` and returns the resolved node.
 * Returns null when the connection is not zarr type, has no URL, or is loading/errored.
 * Re-opens when the connection URL or variable changes.
 */
export function useStoryZarrNode(conn: Connection | null): ZarrNode | null {
  const isZarr = conn?.connection_type === "zarr";
  const url = isZarr ? (conn!.url ?? null) : null;
  const variable = isZarr
    ? ((conn!.config as { variable?: string | null } | null)?.variable ?? null)
    : null;

  const [node, setNode] = useState<ZarrNode | null>(null);

  useEffect(() => {
    if (!url) {
      setNode(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const rawStore = createZarrStore(url);
        const store = await zarr.withMaybeConsolidatedMetadata(rawStore);
        const root = (await zarr.open(store, {
          kind: "group",
        })) as zarr.Group<zarr.Readable>;

        let result: ZarrNode = root;
        if (variable) {
          try {
            result = (await zarr.open(root.resolve(variable), {
              kind: "array",
            })) as zarr.Array<zarr.DataType, zarr.Readable>;
          } catch {
            result = root;
          }
        }

        if (!cancelled) setNode(result);
      } catch {
        if (!cancelled) setNode(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, variable]);

  return node;
}
