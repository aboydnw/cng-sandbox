import { useState, useEffect } from "react";
import * as zarr from "zarrita";
import { createZarrStore } from "../lib/zarr/zarrFetch";
import type { MapItem } from "../types";

export interface UseZarrNodeResult {
  node: zarr.Group<zarr.Readable> | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Opens the zarr store for a zarr connection `MapItem` and returns the
 * resolved root `zarr.Group` plus loading/error state. For non-zarr items
 * (or null), returns an empty result without doing any work.
 *
 * Re-opens when the connection URL changes. Stale results from an
 * in-flight open whose URL has been superseded are dropped.
 */
export function useZarrNode(item: MapItem | null): UseZarrNodeResult {
  const url =
    item?.source === "connection" && item.connection?.connection_type === "zarr"
      ? (item.connection.url ?? null)
      : null;

  const [state, setState] = useState<UseZarrNodeResult>({
    node: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ node: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ node: null, isLoading: true, error: null });

    (async () => {
      try {
        const rawStore = createZarrStore(url);
        const store = await zarr.withMaybeConsolidatedMetadata(rawStore);
        const node = (await zarr.open(store, {
          kind: "group",
        })) as zarr.Group<zarr.Readable>;
        if (cancelled) return;
        setState({ node, isLoading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          node: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to open Zarr",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
