import { workspaceFetch } from "../../api";
import { captureChapterMap } from "../archival/captureMap";
import type { CngRcConfig } from "../cngRcTypes";
import type { Story } from "../types";
import type { Connection, Dataset } from "../../../types";

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await workspaceFetch(path, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Interactive export aborted", "AbortError");
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",", 2);
  const match = meta.match(/data:([^;]+);base64/);
  const mime = match ? match[1] : "application/octet-stream";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function downloadInteractiveExport(
  storyId: string,
  storyTitle: string,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const [, story, datasets, connections] = await Promise.all([
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

  const scrollyChapters = story.chapters.filter(
    (c) => c.type === "scrollytelling"
  );
  const total = scrollyChapters.length + 1;
  if (onProgress) onProgress(0, total);

  const fd = new FormData();
  let captured = 0;
  for (const ch of scrollyChapters) {
    throwIfAborted(signal);
    const dataUrl = await captureChapterMap({
      chapter: ch,
      datasetMap,
      connectionMap,
    });
    const blob = dataUrlToBlob(dataUrl);
    fd.append(
      "scrolly_pngs",
      new File([blob], `${ch.id}.png`, { type: blob.type })
    );
    captured += 1;
    if (onProgress) onProgress(captured, total);
  }

  const resp = await workspaceFetch(
    `/api/stories/${encodeURIComponent(storyId)}/export/interactive`,
    { method: "POST", body: fd, signal }
  );
  if (!resp.ok) {
    let detail = "";
    try {
      const body = (await resp.json()) as { detail?: unknown };
      if (typeof body?.detail === "string") detail = `: ${body.detail}`;
    } catch {
      // body not JSON
    }
    throw new Error(`Interactive export failed (${resp.status})${detail}`);
  }
  if (onProgress) onProgress(total, total);

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(storyTitle) || "story"}.zip`;
  if (signal?.aborted) {
    setTimeout(() => URL.revokeObjectURL(url), 0);
    throwIfAborted(signal);
  }
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
