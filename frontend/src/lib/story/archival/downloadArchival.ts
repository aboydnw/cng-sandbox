import type { CngRcConfig } from "../cngRcTypes";
import { buildArchivalHtml } from "./buildArchivalHtml";

export async function downloadArchivalHtml(
  storyId: string,
  storyTitle: string,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`/api/stories/${storyId}/export/config`, {
    signal,
  });
  if (!response.ok)
    throw new Error(`Failed to load config: ${response.status}`);
  const config = (await response.json()) as CngRcConfig;
  throwIfAborted(signal);

  if (onProgress && !signal?.aborted) onProgress(0, config.chapters.length);

  const html = await buildArchivalHtml(config);
  throwIfAborted(signal);
  if (onProgress && !signal?.aborted) {
    onProgress(config.chapters.length, config.chapters.length);
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(storyTitle) || "story"}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
