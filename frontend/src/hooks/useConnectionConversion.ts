import { useEffect, useState } from "react";

export interface ConversionStatus {
  status: "pending" | "running" | "ready" | "failed" | "not_found" | "unknown";
  tileUrl: string | null;
  error: string | null;
  featureCount: number | null;
}

const INITIAL: ConversionStatus = {
  status: "pending",
  tileUrl: null,
  error: null,
  featureCount: null,
};

const MAX_RETRIES = 3;

export function useConnectionConversion(
  connectionId: string | null,
  enabled: boolean
): ConversionStatus {
  const [state, setState] = useState<ConversionStatus>(INITIAL);

  useEffect(() => {
    if (!enabled || !connectionId) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let cancelled = false;

    const connect = () => {
      const es = new EventSource(`/api/connections/${connectionId}/stream`);
      source = es;
      es.addEventListener("status", (e: MessageEvent) => {
        let data;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        retryCount = 0;
        setState({
          status: data.status,
          tileUrl: data.tile_url ?? null,
          error: data.error ?? null,
          featureCount: data.feature_count ?? null,
        });
        if (
          data.status === "ready" ||
          data.status === "failed" ||
          data.status === "not_found"
        ) {
          es.close();
        }
      });
      es.onerror = () => {
        es.close();
        if (cancelled) return;
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          retryTimer = setTimeout(connect, 1000 * retryCount);
        } else {
          setState({
            status: "failed",
            tileUrl: null,
            error: "Connection lost. Please refresh the page.",
            featureCount: null,
          });
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [connectionId, enabled]);

  return state;
}
