import { useState, useCallback, useRef } from "react";
import { workspaceFetch } from "../lib/api";
import { config } from "../config";

type RemoteConnectPhase =
  | "idle"
  | "discovering"
  | "preview"
  | "ingesting"
  | "error";

interface DiscoverResult {
  files: { url: string; filename: string }[];
  count: number;
  dominant_extension: string;
}

interface RemoteConnectState {
  phase: RemoteConnectPhase;
  url: string;
  discoverResult: DiscoverResult | null;
  jobId: string | null;
  datasetId: string | null;
  error: string | null;
}

const initialState: RemoteConnectState = {
  phase: "idle",
  url: "",
  discoverResult: null,
  jobId: null,
  datasetId: null,
  error: null,
};

export function useRemoteConnect() {
  const [state, setState] = useState<RemoteConnectState>(initialState);
  const esRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState(initialState);
  }, []);

  const discover = useCallback(async (url: string) => {
    setState((prev) => ({
      ...prev,
      phase: "discovering",
      url,
      error: null,
      discoverResult: null,
    }));

    try {
      const resp = await workspaceFetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: "Discovery failed" }));
        const msg =
          typeof body.detail === "string" ? body.detail : "Discovery failed";
        setState((prev) => ({ ...prev, phase: "error", error: msg }));
        return;
      }

      const result: DiscoverResult = await resp.json();
      setState((prev) => ({
        ...prev,
        phase: "preview",
        discoverResult: result,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: "Failed to reach the server",
      }));
    }
  }, []);

  const startIngestion = useCallback(
    async (mode: "mosaic" | "temporal") => {
      setState((prev) => ({ ...prev, phase: "ingesting", error: null }));

      try {
        const resp = await workspaceFetch("/api/connect-remote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: state.url,
            mode,
          }),
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({ detail: "Ingestion failed" }));
          const msg =
            typeof body.detail === "string" ? body.detail : "Ingestion failed";
          setState((prev) => ({ ...prev, phase: "error", error: msg }));
          return;
        }

        const { job_id } = await resp.json();
        setState((prev) => ({ ...prev, jobId: job_id }));

        const es = new EventSource(`${config.apiBase}/api/jobs/${job_id}/stream`);
        esRef.current = es;

        es.addEventListener("status", (event) => {
          let data: { status: string; error?: string; dataset_id?: string };
          try {
            data = JSON.parse((event as MessageEvent).data);
          } catch {
            return;
          }

          if (data.status === "ready") {
            es.close();
            setState((prev) => ({
              ...prev,
              phase: "idle",
              datasetId: data.dataset_id ?? prev.datasetId,
            }));
          } else if (data.status === "failed") {
            es.close();
            setState((prev) => ({
              ...prev,
              phase: "error",
              error: data.error ?? "Ingestion failed",
            }));
          }
        });

        es.onerror = () => {
          es.close();
          setState((prev) => ({
            ...prev,
            phase: "error",
            error: "Connection lost during ingestion",
          }));
        };
      } catch {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: "Failed to start ingestion",
        }));
      }
    },
    [state.url]
  );

  return { state, discover, startIngestion, reset };
}
