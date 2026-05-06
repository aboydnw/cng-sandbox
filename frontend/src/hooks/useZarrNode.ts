import { useState, useEffect } from "react";
import * as zarr from "zarrita";
import { createZarrStore } from "../lib/zarr/zarrFetch";
import type { MapItem } from "../types";

export type ZarrNode =
  | zarr.Group<zarr.Readable>
  | zarr.Array<zarr.DataType, zarr.Readable>;

export interface UseZarrNodeResult {
  node: ZarrNode | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Opens the zarr store for a zarr connection `MapItem` and returns the
 * resolved node plus loading/error state. For non-zarr items (or null),
 * returns an empty result without doing any work.
 *
 * When the connection's `config.variable` resolves to a zarr Array (the
 * common single-resolution case, e.g. IMERG `precipitation`), the array is
 * opened directly and returned as the node. When it resolves to a Group
 * (multiscale pyramid), the root group is returned and deck.gl-zarr resolves
 * the variable group itself. This avoids `zarr.open(..., { kind: "group" })`
 * failing on an array path inside `ZarrLayer._parseZarr`.
 *
 * Re-opens when the connection URL or variable changes. Stale results from an
 * in-flight open whose URL has been superseded are dropped.
 */
export function useZarrNode(item: MapItem | null): UseZarrNodeResult {
  const isZarr =
    item?.source === "connection" &&
    item.connection?.connection_type === "zarr";
  const url = isZarr ? (item.connection!.url ?? null) : null;
  const variable = isZarr
    ? ((
        item.connection!.config as
          | { variable?: string | null }
          | null
          | undefined
      )?.variable ?? null)
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
        const root = (await zarr.open(store, {
          kind: "group",
        })) as zarr.Group<zarr.Readable>;

        let node: ZarrNode = root;
        if (variable) {
          try {
            node = (await zarr.open(root.resolve(variable), {
              kind: "array",
            })) as zarr.Array<zarr.DataType, zarr.Readable>;
          } catch {
            node = root;
          }
        }

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
  }, [url, variable]);

  return state;
}
