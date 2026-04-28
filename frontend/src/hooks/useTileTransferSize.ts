import { useState, useEffect, useMemo } from "react";

/**
 * Accumulates bytes fetched since mount by observing PerformanceResourceTiming
 * entries whose URL starts with any of the given prefixes.
 *
 * Each prefix is resolved against `window.location.origin`, so callers may pass
 * either a path (e.g. `/pmtiles/`) or an absolute URL (e.g. `https://r2.example/ds.tif`).
 * This lets the metric cover both server-side tile requests (proxied paths) and
 * client-side rendering (direct R2 fetches for COGs and GeoParquet).
 *
 * Range requests against the same URL produce multiple PerformanceResourceTiming
 * entries — they're all counted because dedup is by entry identity, not URL.
 *
 * Returns:
 *   null  — no matching requests have been made yet
 *   0     — matching requests exist but all report transferSize=0 (Timing-Allow-Origin not set)
 *   > 0   — bytes fetched so far
 */
export function useTileTransferSize(prefixes: string[]): number | null {
  const prefixKey = prefixes.join("|");
  const resolvedPrefixes = useMemo(
    () =>
      prefixes
        .filter((p) => p.length > 0)
        .map((p) => new URL(p, window.location.origin).toString()),
    [prefixKey]
  );

  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    if (resolvedPrefixes.length === 0) {
      setBytes(null);
      return;
    }

    const acc = { total: 0, count: 0 };
    const seen = new WeakSet<PerformanceResourceTiming>();

    const matches = (url: string) =>
      resolvedPrefixes.some((p) => url.startsWith(p));

    const addEntry = (e: PerformanceResourceTiming): boolean => {
      if (seen.has(e) || !matches(e.name)) return false;
      seen.add(e);
      acc.total += e.transferSize;
      acc.count++;
      return true;
    };

    const existing = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];
    for (const e of existing) addEntry(e);
    if (acc.count > 0) setBytes(acc.total);

    const observer = new PerformanceObserver((list) => {
      let changed = false;
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (addEntry(entry)) changed = true;
      }
      if (changed) {
        setBytes(acc.total);
      }
    });
    observer.observe({ type: "resource", buffered: false });

    return () => observer.disconnect();
  }, [resolvedPrefixes]);

  return bytes;
}
