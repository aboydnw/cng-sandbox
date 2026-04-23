import { useMemo, useCallback } from "react";
import type { InitialRasterOverrides } from "./useMapControls";

interface PersistedOverrides {
  rescaleMin: number | null;
  rescaleMax: number | null;
  colormapReversed: boolean;
  colormapName: string;
}

type SetParams = (updater: (prev: URLSearchParams) => URLSearchParams) => void;

function lsKey(itemId: string): string {
  return `cng:raster-override:${itemId}`;
}

function readLocalStorage(itemId: string): Partial<PersistedOverrides> {
  try {
    const raw = localStorage.getItem(lsKey(itemId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseNumOrNull(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function useRasterOverrides(
  itemId: string | null,
  searchParams: URLSearchParams,
  setSearchParams: SetParams
) {
  const initialOverrides = useMemo<InitialRasterOverrides | undefined>(() => {
    if (!itemId) return undefined;
    const urlMin = parseNumOrNull(searchParams.get("rmin"));
    const urlMax = parseNumOrNull(searchParams.get("rmax"));
    const urlFlip = searchParams.get("flip") === "1";
    const hasUrl =
      searchParams.has("rmin") ||
      searchParams.has("rmax") ||
      searchParams.has("flip");

    if (hasUrl) {
      return {
        itemId,
        rescaleMin: urlMin,
        rescaleMax: urlMax,
        colormapReversed: urlFlip,
      };
    }
    const ls = readLocalStorage(itemId);
    return {
      itemId,
      rescaleMin: typeof ls.rescaleMin === "number" ? ls.rescaleMin : null,
      rescaleMax: typeof ls.rescaleMax === "number" ? ls.rescaleMax : null,
      colormapReversed: ls.colormapReversed === true,
      colormapName:
        typeof ls.colormapName === "string" ? ls.colormapName : undefined,
    };
  }, [itemId]);

  const persist = useCallback(
    (next: PersistedOverrides) => {
      if (!itemId) return;
      const allDefault =
        next.rescaleMin == null &&
        next.rescaleMax == null &&
        !next.colormapReversed &&
        next.colormapName === "viridis";

      try {
        if (allDefault) {
          localStorage.removeItem(lsKey(itemId));
        } else {
          localStorage.setItem(lsKey(itemId), JSON.stringify(next));
        }
      } catch {
        // ignore quota / private mode
      }

      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next.rescaleMin != null) p.set("rmin", String(next.rescaleMin));
        else p.delete("rmin");
        if (next.rescaleMax != null) p.set("rmax", String(next.rescaleMax));
        else p.delete("rmax");
        if (next.colormapReversed) p.set("flip", "1");
        else p.delete("flip");
        return p;
      });
    },
    [itemId, setSearchParams]
  );

  return { initialOverrides, persist };
}
