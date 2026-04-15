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

export function useConnectionConversion(
  connectionId: string | null,
  enabled: boolean,
): ConversionStatus {
  const [state, setState] = useState<ConversionStatus>(INITIAL);

  useEffect(() => {
    if (!enabled || !connectionId) return;
    const source = new EventSource(`/api/connections/${connectionId}/stream`);
    source.addEventListener("status", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
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
        source.close();
      }
    });
    return () => source.close();
  }, [connectionId, enabled]);

  return state;
}
