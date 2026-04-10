import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ConversionJobState,
  StageInfo,
  StageProgress,
  JobStatus,
  ScanResult,
} from "../types";
import { config } from "../config";
import { workspaceFetch } from "../lib/api";

export function stripPydanticPrefix(msg: string): string {
  return msg.replace(/^Value error, /i, "");
}

export function extractErrorMessage(
  body: Record<string, unknown>,
  fallback: string
): string {
  const raw =
    typeof body.detail === "string"
      ? body.detail
      : typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : null;
  if (raw) return stripPydanticPrefix(raw);
  if (Array.isArray(body.detail)) {
    return body.detail
      .map((e: unknown) =>
        e instanceof Object && "msg" in e
          ? stripPydanticPrefix(String((e as Record<string, unknown>).msg))
          : JSON.stringify(e)
      )
      .join("; ");
  }
  return fallback;
}

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

function buildUploadFailedStages(error: string): StageInfo[] {
  return [
    { name: "Uploading", status: "error" as const, detail: error },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

function buildCheckingFormatStages(): StageInfo[] {
  return [
    { name: "Checking format", status: "active" as const },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

function buildCheckFormatFailedStages(error: string): StageInfo[] {
  return [
    { name: "Checking format", status: "error" as const, detail: error },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

function buildUploadingStagesAfterCheck(): StageInfo[] {
  return [
    { name: "Checking format", status: "done" as const },
    { name: "Uploading", status: "active" as const },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

function buildUploadFailedStagesAfterCheck(error: string): StageInfo[] {
  return [
    { name: "Checking format", status: "done" as const },
    { name: "Uploading", status: "error" as const, detail: error },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

function updateStages(
  status: JobStatus,
  error?: string,
  progressCurrent?: number,
  progressTotal?: number,
  stageProgress?: StageProgress
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
      return {
        name,
        status: "active" as const,
        detail,
        progress: stageProgress,
      };
    }
    return { name, status: "pending" as const };
  });
  return [
    { name: "Checking format", status: "done" as const },
    { name: "Uploading", status: "done" as const },
    ...pipelineStages,
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
    duplicate: null,
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
          data.stage_progress ?? undefined
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
        const v = data.variables[0];
        if (v.time_dim && v.time_dim.size > 1) {
          setState((prev) => ({
            ...prev,
            scanResult: data,
            isUploading: false,
          }));
          return;
        }
        confirmVariable(data.scan_id, v.name, v.group);
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
    async (
      scanId: string,
      variable: string,
      group: string,
      temporal?: { start_index: number; end_index: number }
    ) => {
      setState((prev) => ({ ...prev, scanResult: null }));

      const body: Record<string, unknown> = { variable, group };
      if (temporal) body.temporal = temporal;

      const resp = await fetchWithRetry(
        `${config.apiBase}/api/scan/${scanId}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
      esRef.current?.close();
      esRef.current = null;
      datasetIdRef.current = null;
      sseRetryCountRef.current = 0;
      setState((prev) => ({
        ...prev,
        isUploading: true,
        status: "pending",
        error: null,
        stages: buildCheckingFormatStages(),
        duplicate: null,
        jobId: null,
        scanResult: null,
        datasetId: null,
      }));

      // Pre-upload format check — send first 1MB to server for validation
      try {
        const chunk = file.slice(0, 1_048_576);
        const checkData = new FormData();
        checkData.append("chunk", chunk, "chunk");
        checkData.append("filename", file.name);
        const checkResp = await workspaceFetch(
          `${config.apiBase}/api/check-format`,
          { method: "POST", body: checkData }
        );
        if (checkResp.ok) {
          const checkResult = await checkResp.json();
          if (!checkResult.valid) {
            setState((prev) => ({
              ...prev,
              isUploading: false,
              status: "failed",
              error: checkResult.error,
              stages: buildCheckFormatFailedStages(checkResult.error),
            }));
            return;
          }
          // Format check passed — show it as done
          setState((prev) => ({
            ...prev,
            stages: buildUploadingStagesAfterCheck(),
          }));
        } else {
          // Endpoint failed — skip format check stage, proceed with upload
          setState((prev) => ({
            ...prev,
            stages: buildUploadingStages(),
          }));
        }
      } catch {
        // Network error — skip format check stage, proceed with upload
        setState((prev) => ({
          ...prev,
          stages: buildUploadingStages(),
        }));
      }

      // Preflight duplicate check — fast query before uploading bytes
      try {
        const checkResp = await workspaceFetch(
          `${config.apiBase}/api/check-duplicate?filename=${encodeURIComponent(file.name)}`
        );
        if (checkResp.status === 409) {
          const body = await checkResp.json().catch(() => ({}));
          if (body.dataset_id && body.filename) {
            setState((prev) => ({
              ...prev,
              isUploading: false,
              status: "pending",
              stages: buildInitialStages(),
              duplicate: {
                datasetId: body.dataset_id,
                filename: body.filename,
              },
            }));
            return;
          }
        }
      } catch {
        // Preflight failed — proceed with upload; server-side 409 is the backstop
      }

      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetchWithRetry(`${config.apiBase}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (resp.status === 409) {
        const body = await resp.json().catch(() => ({}));
        if (body.dataset_id && body.filename) {
          setState((prev) => ({
            ...prev,
            isUploading: false,
            status: "pending",
            stages: buildInitialStages(),
            duplicate: {
              datasetId: body.dataset_id,
              filename: body.filename,
            },
          }));
          return;
        }
        // Malformed 409 — treat as generic failure
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: "Duplicate check failed",
          stages: buildUploadFailedStagesAfterCheck("Duplicate check failed"),
        }));
        return;
      }

      if (!resp.ok) {
        const detail = await resp
          .json()
          .catch(() => ({ detail: "Upload failed" }));
        const msg = extractErrorMessage(detail, "Upload failed");
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: msg,
          stages: buildUploadFailedStagesAfterCheck(msg),
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

  const startUrlFetch = useCallback(
    async (url: string) => {
      esRef.current?.close();
      esRef.current = null;
      datasetIdRef.current = null;
      sseRetryCountRef.current = 0;
      setState((prev) => ({
        ...prev,
        isUploading: true,
        status: "pending",
        error: null,
        stages: buildUploadingStages(),
        duplicate: null,
        jobId: null,
        scanResult: null,
        datasetId: null,
      }));

      // Preflight duplicate check
      try {
        const preflightFilename =
          new URL(url).pathname.split("/").pop() || "download";
        const checkResp = await workspaceFetch(
          `${config.apiBase}/api/check-duplicate?filename=${encodeURIComponent(preflightFilename)}`
        );
        if (checkResp.status === 409) {
          const body = await checkResp.json().catch(() => ({}));
          if (body.dataset_id && body.filename) {
            setState((prev) => ({
              ...prev,
              isUploading: false,
              status: "pending",
              stages: buildInitialStages(),
              duplicate: {
                datasetId: body.dataset_id,
                filename: body.filename,
              },
            }));
            return;
          }
        }
      } catch {
        // Preflight failed — proceed with upload; server-side 409 is the backstop
      }

      const resp = await fetchWithRetry(`${config.apiBase}/api/convert-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (resp.status === 409) {
        const body = await resp.json().catch(() => ({}));
        if (body.dataset_id && body.filename) {
          setState((prev) => ({
            ...prev,
            isUploading: false,
            status: "pending",
            stages: buildInitialStages(),
            duplicate: {
              datasetId: body.dataset_id,
              filename: body.filename,
            },
          }));
          return;
        }
        // Malformed 409 — treat as generic failure
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: "Duplicate check failed",
          stages: buildUploadFailedStages("Duplicate check failed"),
        }));
        return;
      }

      if (!resp.ok) {
        const body = await resp
          .json()
          .catch(() => ({ detail: "Fetch failed" }));
        const msg = extractErrorMessage(body, "Fetch failed");
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: msg,
          stages: buildUploadFailedStages(msg),
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
      esRef.current?.close();
      esRef.current = null;
      datasetIdRef.current = null;
      sseRetryCountRef.current = 0;
      setState((prev) => ({
        ...prev,
        isUploading: true,
        status: "pending",
        error: null,
        stages: buildUploadingStages(),
        duplicate: null,
        jobId: null,
        scanResult: null,
        datasetId: null,
      }));

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const resp = await fetchWithRetry(
        `${config.apiBase}/api/upload-temporal`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!resp.ok) {
        const detail = await resp
          .json()
          .catch(() => ({ detail: "Upload failed" }));
        const msg = extractErrorMessage(detail, "Upload failed");
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: msg,
          stages: buildUploadFailedStages(msg),
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

  const resetJob = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    datasetIdRef.current = null;
    sseRetryCountRef.current = 0;
    setState({
      jobId: null,
      status: "pending",
      datasetId: null,
      error: null,
      stages: buildInitialStages(),
      progressCurrent: null,
      progressTotal: null,
      isUploading: false,
      scanResult: null,
      duplicate: null,
    });
  }, []);

  return {
    state,
    startUpload,
    startUrlFetch,
    startTemporalUpload,
    confirmVariable,
    resetJob,
  };
}
