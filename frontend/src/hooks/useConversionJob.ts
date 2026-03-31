import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ConversionJobState,
  StageInfo,
  StageProgress,
  JobStatus,
  ScanResult,
} from "../types";
import { config } from "../config";
import { workspaceFetch, getWorkspaceId } from "../lib/api";

export async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await workspaceFetch(input, init);
      if (resp.status >= 500 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return resp;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Fetch failed after retries");
}

const STAGE_NAMES = [
  "Scanning",
  "Converting",
  "Validating",
  "Ingesting",
  "Ready",
];
const STATUS_ORDER: JobStatus[] = [
  "scanning",
  "converting",
  "validating",
  "ingesting",
  "ready",
];

function buildInitialStages(): StageInfo[] {
  return STAGE_NAMES.map((name) => ({ name, status: "pending" as const }));
}

function buildUploadingStages(): StageInfo[] {
  return [
    { name: "Uploading", status: "active" as const },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

function updateStages(
  status: JobStatus,
  error?: string,
  progressCurrent?: number,
  progressTotal?: number,
  stageProgress?: StageProgress,
): StageInfo[] {
  const idx = STATUS_ORDER.indexOf(status);
  const pipelineStages: StageInfo[] = STAGE_NAMES.map((name, i) => {
    if (status === "failed") {
      if (i < idx) return { name, status: "done" as const };
      if (i === idx || (idx === -1 && i === 0))
        return { name, status: "error" as const, detail: error };
      return { name, status: "pending" as const };
    }
    if (i < idx) return { name, status: "done" as const };
    if (i === idx) {
      const detail =
        progressCurrent && progressTotal
          ? `${progressCurrent} of ${progressTotal}`
          : undefined;
      return { name, status: "active" as const, detail, progress: stageProgress };
    }
    return { name, status: "pending" as const };
  });
  return [{ name: "Uploading", status: "done" as const }, ...pipelineStages];
}

function updateUploadProgress(loaded: number, total: number): StageInfo[] {
  return [
    {
      name: "Uploading",
      status: "active" as const,
      progress: {
        percent: Math.round((loaded / total) * 100),
        current: loaded,
        total,
        detail: null,
      },
    },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

export function useConversionJob() {
  const [state, setState] = useState<ConversionJobState>({
    jobId: null,
    status: "pending",
    datasetId: null,
    error: null,
    stages: buildInitialStages(),
    progressCurrent: null,
    progressTotal: null,
    isUploading: false,
    scanResult: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const datasetIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const sseRetryCountRef = useRef(0);

  const connectSSE = useCallback((jobId: string) => {
    const es = new EventSource(`${config.apiBase}/api/jobs/${jobId}/stream`);
    esRef.current = es;

    es.addEventListener("status", (event) => {
      let data: {
        status: JobStatus;
        error?: string;
        progress_current?: number;
        progress_total?: number;
        stage_progress?: {
          percent: number | null;
          current: number | null;
          total: number | null;
          detail: string | null;
        };
      };
      try {
        data = JSON.parse((event as MessageEvent).data);
      } catch {
        return;
      }
      sseRetryCountRef.current = 0;
      const status = data.status;
      const error = data.error || null;

      setState((prev) => ({
        ...prev,
        status,
        error,
        progressCurrent: data.progress_current ?? null,
        progressTotal: data.progress_total ?? null,
        datasetId: status === "ready" ? datasetIdRef.current : prev.datasetId,
        stages: updateStages(
          status,
          error ?? undefined,
          data.progress_current,
          data.progress_total,
          data.stage_progress ?? undefined,
        ),
      }));

      if (status === "ready" || status === "failed") {
        es.close();
      }
    });

    es.addEventListener("scan_result", (event) => {
      let data: ScanResult;
      try {
        data = JSON.parse((event as MessageEvent).data);
      } catch {
        return;
      }

      sseRetryCountRef.current = 0;

      if (data.variables.length === 1) {
        confirmVariable(
          data.scan_id,
          data.variables[0].name,
          data.variables[0].group
        );
        return;
      }

      setState((prev) => ({
        ...prev,
        scanResult: data,
        isUploading: false,
      }));
    });

    es.onerror = () => {
      es.close();
      if (sseRetryCountRef.current < 3) {
        sseRetryCountRef.current++;
        setTimeout(() => connectSSE(jobId), 1000 * sseRetryCountRef.current);
      } else {
        setState((prev) => ({
          ...prev,
          error: "Connection lost. Please refresh the page.",
          status: "failed",
          stages: updateStages(
            "failed",
            "Connection lost. Please refresh the page."
          ),
        }));
      }
    };
  }, []);

  const confirmVariable = useCallback(
    async (scanId: string, variable: string, group: string) => {
      setState((prev) => ({ ...prev, scanResult: null }));

      const resp = await fetchWithRetry(
        `${config.apiBase}/api/scan/${scanId}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variable, group }),
        }
      );

      if (!resp.ok) {
        const detail = await resp
          .json()
          .catch(() => ({ detail: "Variable selection failed" }));
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: detail.detail || "Variable selection failed",
          stages: updateStages("failed", detail.detail),
        }));
      }
    },
    []
  );

  const startUpload = useCallback(
    async (file: File) => {
      setState((prev) => ({
        ...prev,
        isUploading: true,
        status: "pending",
        error: null,
        stages: buildUploadingStages(),
      }));

      const formData = new FormData();
      formData.append("file", file);

      try {
        const { jobId, datasetId } = await new Promise<{
          jobId: string;
          datasetId: string;
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setState((prev) => ({
                ...prev,
                stages: updateUploadProgress(e.loaded, e.total),
              }));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText);
              resolve({ jobId: data.job_id, datasetId: data.dataset_id });
            } else {
              try {
                const data = JSON.parse(xhr.responseText);
                reject(new Error(data.detail || "Upload failed"));
              } catch {
                reject(new Error("Upload failed"));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("POST", `${config.apiBase}/api/upload`);
          const wsId = getWorkspaceId();
          if (wsId) xhr.setRequestHeader("X-Workspace-Id", wsId);
          xhr.send(formData);
        });

        datasetIdRef.current = datasetId;
        setState((prev) => ({
          ...prev,
          jobId,
          datasetId: null,
          status: "pending",
          error: null,
        }));
        connectSSE(jobId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: msg,
          stages: updateStages("failed", msg),
        }));
      }
    },
    [connectSSE]
  );

  const startUrlFetch = useCallback(
    async (url: string) => {
      setState((prev) => ({
        ...prev,
        isUploading: true,
        status: "pending",
        error: null,
        stages: buildUploadingStages(),
      }));

      const resp = await fetchWithRetry(`${config.apiBase}/api/convert-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!resp.ok) {
        const body = await resp
          .json()
          .catch(() => ({ detail: "Fetch failed" }));
        const msg =
          typeof body.detail === "string"
            ? body.detail
            : Array.isArray(body.detail)
              ? body.detail
                  .map((e: unknown) =>
                    e instanceof Object && "msg" in e
                      ? String((e as Record<string, unknown>).msg)
                      : JSON.stringify(e)
                  )
                  .join("; ")
              : "Fetch failed";
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: msg,
          stages: updateStages("failed", msg),
        }));
        return;
      }

      const { job_id, dataset_id } = await resp.json();
      datasetIdRef.current = dataset_id;
      setState((prev) => ({
        ...prev,
        jobId: job_id,
        datasetId: null,
        status: "pending",
        error: null,
      }));
      connectSSE(job_id);
    },
    [connectSSE]
  );

  const startTemporalUpload = useCallback(
    async (files: File[]) => {
      setState((prev) => ({
        ...prev,
        isUploading: true,
        status: "pending",
        error: null,
        stages: buildUploadingStages(),
      }));

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      try {
        const { jobId, datasetId } = await new Promise<{
          jobId: string;
          datasetId: string;
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setState((prev) => ({
                ...prev,
                stages: updateUploadProgress(e.loaded, e.total),
              }));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText);
              resolve({ jobId: data.job_id, datasetId: data.dataset_id });
            } else {
              try {
                const data = JSON.parse(xhr.responseText);
                reject(new Error(data.detail || "Upload failed"));
              } catch {
                reject(new Error("Upload failed"));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("POST", `${config.apiBase}/api/upload-temporal`);
          const wsId = getWorkspaceId();
          if (wsId) xhr.setRequestHeader("X-Workspace-Id", wsId);
          xhr.send(formData);
        });

        datasetIdRef.current = datasetId;
        setState((prev) => ({
          ...prev,
          jobId,
          datasetId: null,
          status: "pending",
          error: null,
        }));
        connectSSE(jobId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: msg,
          stages: updateStages("failed", msg),
        }));
      }
    },
    [connectSSE]
  );

  return {
    state,
    startUpload,
    startUrlFetch,
    startTemporalUpload,
    confirmVariable,
  };
}
