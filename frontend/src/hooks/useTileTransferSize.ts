import { useState, useEffect, useRef } from "react";

/**
 * Accumulates tile bytes fetched since mount by observing PerformanceResourceTiming
 * entries whose URL starts with the given prefix.
 *
 * Returns:
 *   null  — no matching tile requests have been made yet
 *   0     — tile requests exist but all report transferSize=0 (Timing-Allow-Origin not set)
 *   > 0   — bytes fetched so far
 */
export function useTileTransferSize(tileUrlPrefix: string): number | null {
  const [bytes, setBytes] = useState<number | null>(null);
  const accumulatorRef = useRef({ total: 0, count: 0 });

  useEffect(() => {
    const prefix = window.location.origin + tileUrlPrefix;
    const acc = { total: 0, count: 0 };
    const seen = new Set<string>();
    accumulatorRef.current = acc;

    const addEntry = (e: PerformanceResourceTiming): boolean => {
      if (!e.name.startsWith(prefix) || seen.has(e.name)) return false;
      seen.add(e.name);
      acc.total += e.transferSize;
      acc.count++;
      return true;
    };

    // Scan any entries already in the buffer
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
  }, [tileUrlPrefix]);

  return bytes;
}
