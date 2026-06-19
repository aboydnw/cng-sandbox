import { useState, useEffect } from "react";
import * as zarr from "zarrita";
import { createZarrStore } from "../lib/zarr/zarrFetch";
import type { Connection } from "../types";
import type { ZarrNode } from "./useZarrNode";

export interface UseStoryZarrNodeResult {
  node: ZarrNode | null;
  error: string | null;
}

/**
 * Opens the zarr store for a zarr `Connection` and returns the resolved node
 * plus an error message when the store fails to open. Returns an empty result
 * when the connection is not zarr type, has no URL, or is loading.
 * Re-opens when the connection URL or variable changes.
 */
export function useStoryZarrNode(
  conn: Connection | null
): UseStoryZarrNodeResult {
  const isZarr = conn?.connection_type === "zarr";
  const url = isZarr ? (conn!.url ?? null) : null;
  const variable = isZarr
    ? ((conn!.config as { variable?: string | null } | null)?.variable ?? null)
    : null;

  const [state, setState] = useState<UseStoryZarrNodeResult>({
    node: null,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ node: null, error: null });
      return;
    }

    let cancelled = false;
    setState({ node: null, error: null });

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

        if (!cancelled) setState({ node: result, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            node: null,
            error: err instanceof Error ? err.message : "Failed to open Zarr",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, variable]);

  return state;
}
