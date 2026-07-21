import { workspaceFetch } from "../../api";
import { captureChapterMap } from "../archival/captureMap";
import { beatTime, groupChaptersIntoBlocks } from "../rendering";
import type { StoryTripsContext } from "../rendering";
import type { TripTrack } from "../../layers/tripsLayer";
import type { CngRcConfig } from "../cngRcTypes";
import type { Chapter, Story } from "../types";
import type { Connection, Dataset } from "../../../types";

interface ScrollyPlacement {
  localIndex: number;
  blockLength: number;
}

function scrollyPlacements(story: Story): Map<string, ScrollyPlacement> {
  const placements = new Map<string, ScrollyPlacement>();
  for (const block of groupChaptersIntoBlocks(story.chapters)) {
    if (block.type !== "scrollytelling") continue;
    block.chapters.forEach((ch, localIndex) => {
      placements.set(ch.id, {
        localIndex,
        blockLength: block.chapters.length,
      });
    });
  }
  return placements;
}

function trajectoryDatasetId(
  chapter: Chapter,
  datasetMap: Map<string, Dataset | null>
): string | null {
  if (chapter.type !== "scrollytelling") return null;
  const dsId = chapter.layer_config?.dataset_id;
  if (!dsId) return null;
  const ds = datasetMap.get(dsId);
  return ds?.dataset_type === "trajectory" ? dsId : null;
}

function trackTimeBounds(tracks: TripTrack[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const t of tracks) {
    for (const ts of t.timestamps) {
      if (ts < min) min = ts;
      if (ts > max) max = ts;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0];
  return [min, max];
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

  const placements = scrollyPlacements(story);
  const tracksCache = new Map<string, TripTrack[]>();

  const fd = new FormData();
  let captured = 0;
  for (const ch of scrollyChapters) {
    throwIfAborted(signal);

    let tripsContext: StoryTripsContext | undefined;
    const trajDsId = trajectoryDatasetId(ch, datasetMap);
    if (trajDsId) {
      const ds = datasetMap.get(trajDsId);
      if (ds?.trips_url) {
        let tracks = tracksCache.get(trajDsId);
        if (!tracks) {
          tracks = await fetchJson<TripTrack[]>(ds.trips_url, signal);
          tracksCache.set(trajDsId, tracks);
        }
        const [tMin, tMax] = trackTimeBounds(tracks);
        const placement = placements.get(ch.id) ?? {
          localIndex: 0,
          blockLength: 1,
        };
        const time = beatTime(
          tMin,
          tMax,
          placement.localIndex,
          placement.blockLength
        );
        tripsContext = {
          tracksByDatasetId: new Map([[trajDsId, tracks]]),
          timeByDatasetId: new Map([[trajDsId, time]]),
        };
      }
    }

    const dataUrl = await captureChapterMap({
      chapter: ch,
      datasetMap,
      connectionMap,
      tripsContext,
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

  if (signal?.aborted) {
    await resp.body?.cancel();
    throwIfAborted(signal);
  }
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
