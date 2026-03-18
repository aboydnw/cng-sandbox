import { useState, useCallback, useRef, useEffect } from "react";
import type { ConversionJobState, StageInfo, JobStatus } from "../types";
import { config } from "../config";

const STAGE_NAMES = ["Scanning", "Converting", "Validating", "Ingesting", "Ready"];
const STATUS_ORDER: JobStatus[] = ["scanning", "converting", "validating", "ingesting", "ready"];

function buildInitialStages(): StageInfo[] {
  return STAGE_NAMES.map((name) => ({ name, status: "pending" as const }));
}

function buildUploadingStages(): StageInfo[] {
  return [
    { name: "Uploading", status: "active" as const },
    ...STAGE_NAMES.map((name) => ({ name, status: "pending" as const })),
  ];
}

function updateStages(status: JobStatus, error?: string, progressCurrent?: number, progressTotal?: number): StageInfo[] {
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
      const detail = progressCurrent && progressTotal
        ? `${progressCurrent} of ${progressTotal}`
        : undefined;
      return { name, status: "active" as const, detail };
    }
    return { name, status: "pending" as const };
  });
  return [{ name: "Uploading", status: "done" as const }, ...pipelineStages];
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
  });

  const esRef = useRef<EventSource | null>(null);
  const datasetIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const connectSSE = useCallback((jobId: string) => {
    const es = new EventSource(`${config.apiBase}/api/jobs/${jobId}/stream`);
    esRef.current = es;

    es.addEventListener("status", (event) => {
      let data: { status: JobStatus; error?: string; progress_current?: number; progress_total?: number };
      try {
        data = JSON.parse((event as MessageEvent).data);
      } catch {
        return;
      }
      const status = data.status;
      const error = data.error || null;

      setState((prev) => ({
        ...prev,
        status,
        error,
        progressCurrent: data.progress_current ?? null,
        progressTotal: data.progress_total ?? null,
        datasetId: status === "ready" ? datasetIdRef.current : prev.datasetId,
        stages: updateStages(status, error ?? undefined, data.progress_current, data.progress_total),
      }));

      if (status === "ready" || status === "failed") {
        es.close();
      }
    });

    es.onerror = () => {
      // EventSource handles reconnection automatically
    };
  }, []);

  const startUpload = useCallback(
    async (file: File) => {
      setState((prev) => ({ ...prev, isUploading: true, status: "pending", error: null, stages: buildUploadingStages() }));

      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(`${config.apiBase}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({ detail: "Upload failed" }));
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: detail.detail || "Upload failed",
          stages: updateStages("failed", detail.detail),
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
    [connectSSE],
  );

  const startUrlFetch = useCallback(
    async (url: string) => {
      setState((prev) => ({ ...prev, isUploading: true, status: "pending", error: null, stages: buildUploadingStages() }));

      const resp = await fetch(`${config.apiBase}/api/convert-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({ detail: "Fetch failed" }));
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: detail.detail || "Fetch failed",
          stages: updateStages("failed", detail.detail),
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
    [connectSSE],
  );

  const startTemporalUpload = useCallback(
    async (files: File[]) => {
      setState((prev) => ({ ...prev, isUploading: true, status: "pending", error: null, stages: buildUploadingStages() }));

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const resp = await fetch(`${config.apiBase}/api/upload-temporal`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({ detail: "Upload failed" }));
        setState((prev) => ({
          ...prev,
          isUploading: false,
          status: "failed",
          error: detail.detail || "Upload failed",
          stages: updateStages("failed", detail.detail),
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
    [connectSSE],
  );

  return { state, startUpload, startUrlFetch, startTemporalUpload };
}
