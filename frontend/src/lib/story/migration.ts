import {
  type Chapter,
  type Story,
  type MapState,
  type LayerConfig,
  DEFAULT_MAP_STATE,
  DEFAULT_LAYER_CONFIG,
  createProseChapter,
  createMapChapter,
  createScrollytellingChapter,
  createImageChapter,
  createVideoChapter,
} from "./types";
import type { VideoProvider } from "./video";

function migrateChapter(
  raw: Record<string, unknown>,
  storyDatasetId: string | undefined
): Chapter {
  if (raw.type === "image" || raw.type === "chart") {
    return raw as unknown as Chapter;
  }

  const type =
    raw.type === "prose" ||
    raw.type === "map" ||
    raw.type === "scrollytelling" ||
    raw.type === "image" ||
    raw.type === "video"
      ? raw.type
      : raw.map_state || raw.layer_config
        ? "scrollytelling"
        : "prose";
  const base = {
    id: raw.id as string,
    order: (raw.order as number) ?? 0,
    title: (raw.title as string) ?? "Untitled chapter",
    narrative: (raw.narrative as string) ?? "",
  };

  if (type === "prose") {
    return createProseChapter(base);
  }

  if (type === "image") {
    const imageData = raw.image as Record<string, unknown> | undefined;
    return createImageChapter({
      ...base,
      image: imageData
        ? {
            asset_id: (imageData.asset_id as string) ?? "",
            url: (imageData.url as string) ?? "",
            thumbnail_url: (imageData.thumbnail_url as string) ?? "",
            alt_text: (imageData.alt_text as string) ?? "",
            width: (imageData.width as number) ?? 0,
            height: (imageData.height as number) ?? 0,
          }
        : undefined,
    });
  }

  if (type === "video") {
    const videoData = raw.video as Record<string, unknown> | undefined;
    const provider: VideoProvider =
      videoData?.provider === "vimeo" ? "vimeo" : "youtube";
    return createVideoChapter({
      ...base,
      video: {
        provider,
        video_id: (videoData?.video_id as string) ?? "",
        original_url: (videoData?.original_url as string) ?? "",
      },
    });
  }

  const layer_config: LayerConfig = {
    ...DEFAULT_LAYER_CONFIG,
    ...(raw.layer_config as Partial<LayerConfig> | undefined),
    dataset_id:
      (raw.layer_config as Partial<LayerConfig> | undefined)?.dataset_id ??
      storyDatasetId ??
      "",
  };

  const map_state: MapState = {
    ...DEFAULT_MAP_STATE,
    ...(raw.map_state as Partial<MapState> | undefined),
  };

  if (type === "map") {
    return createMapChapter({ ...base, map_state, layer_config });
  }

  return createScrollytellingChapter({
    ...base,
    map_state,
    layer_config,
    transition: (raw.transition as "fly-to" | "instant") ?? "fly-to",
    overlay_position:
      raw.overlay_position === "left" || raw.overlay_position === "right"
        ? (raw.overlay_position as "left" | "right")
        : "left",
  });
}

export function migrateStory(story: Record<string, unknown>): Story {
  const storyDatasetId = story.dataset_id as string | undefined;
  const rawChapters = Array.isArray(story.chapters) ? story.chapters : [];
  const chapters = rawChapters
    .filter(
      (ch): ch is Record<string, unknown> =>
        ch != null && typeof ch === "object"
    )
    .map((ch) => migrateChapter(ch, storyDatasetId));

  const chapterDatasetIds = chapters.flatMap((ch) =>
    "layer_config" in ch && ch.layer_config?.dataset_id
      ? [ch.layer_config.dataset_id]
      : []
  );
  const uniqueIds = [...new Set<string>(chapterDatasetIds)];

  const dataset_ids =
    (story.dataset_ids as string[] | undefined) &&
    (story.dataset_ids as string[]).length > 0
      ? (story.dataset_ids as string[])
      : uniqueIds.length > 0
        ? uniqueIds
        : story.dataset_id
          ? [story.dataset_id as string]
          : [];

  return { ...(story as object), chapters, dataset_ids } as unknown as Story;
}
