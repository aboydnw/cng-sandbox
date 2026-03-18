import { useState, useEffect } from "react";

/**
 * Accumulates tile bytes fetched since mount by observing PerformanceResourceTiming
 * entries whose URL starts with the given prefix.
 *
 * Returns:
 *   null  — no matching tile requests have been made yet (normal on page load)
 *   0     — tile requests exist but all report transferSize=0 (Timing-Allow-Origin not set)
 *   > 0   — bytes fetched so far
 */
export function useTileTransferSize(tileUrlPrefix: string): number | null {
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    const prefix = window.location.origin + tileUrlPrefix;

    const getTotal = (): number | null => {
      const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
        .filter((e) => e.name.startsWith(prefix));
      if (entries.length === 0) return null;  // no tile requests yet
      return entries.reduce((sum, e) => sum + e.transferSize, 0);
    };

    setBytes(getTotal());

    const observer = new PerformanceObserver(() => {
      setBytes(getTotal());
    });
    observer.observe({ type: "resource", buffered: true });

    return () => observer.disconnect();
  }, [tileUrlPrefix]);

  return bytes;
}
