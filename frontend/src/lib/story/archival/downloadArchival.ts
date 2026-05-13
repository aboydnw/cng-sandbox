import { workspaceFetch } from "../../api";
import type { CngRcConfig } from "../cngRcTypes";
import type { Story } from "../types";
import type { Connection, Dataset } from "../../../types";
import { buildArchivalHtml } from "./buildArchivalHtml";

export async function downloadArchivalHtml(
  storyId: string,
  storyTitle: string,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const [config, story, datasets, connections] = await Promise.all([
    fetchJson<CngRcConfig>(
      `/api/stories/${encodeURIComponent(storyId)}/export/config`,
      signal
    ),
    fetchJson<Story>(`/api/stories/${encodeURIComponent(storyId)}`, signal),
    fetchJson<Dataset[]>("/api/datasets", signal),
    fetchJson<Connection[]>("/api/connections", signal),
  ]);
  throwIfAborted(signal);

  const datasetMap = new Map<string, Dataset | null>(
    datasets.map((d) => [d.id, d])
  );
  const connectionMap = new Map<string, Connection>(
    connections.map((c) => [c.id, c])
  );

  if (onProgress && !signal?.aborted) onProgress(0, config.chapters.length);

  const html = await buildArchivalHtml({
    config,
    story,
    datasetMap,
    connectionMap,
  });
  throwIfAborted(signal);
  if (onProgress && !signal?.aborted) {
    onProgress(config.chapters.length, config.chapters.length);
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(storyTitle) || "story"}.html`;
  if (signal?.aborted) {
    setTimeout(() => URL.revokeObjectURL(url), 0);
    throwIfAborted(signal);
  }
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await workspaceFetch(path, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Archival export aborted", "AbortError");
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
