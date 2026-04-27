import type { Chapter, Story } from "./types";

const MAP_BOUND_TYPES = new Set(["scrollytelling", "map"]);

function migrateChapter(
  raw: Record<string, unknown>,
  storyDatasetId: string | undefined
): Chapter {
  const type = (raw.type as string) ?? "scrollytelling";
  const base = {
    id: raw.id as string,
    order: (raw.order as number) ?? 0,
    title: (raw.title as string) ?? "Untitled chapter",
    narrative: (raw.narrative as string) ?? "",
  };

  if (type === "prose") {
    return { ...base, type: "prose" };
  }

  const lc = {
    ...(raw.layer_config as Record<string, unknown> | undefined),
  } as Record<string, unknown>;
  if (!lc.dataset_id) {
    lc.dataset_id = storyDatasetId;
  }

  const map_state = (raw.map_state as Record<string, unknown>) ?? {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    basemap: "streets",
  };

  if (type === "map") {
    return {
      ...base,
      type: "map",
      map_state: map_state as Chapter["map_state" & keyof Chapter] as never,
      layer_config: lc as never,
    } as Chapter;
  }

  // scrollytelling (default)
  return {
    ...base,
    type: "scrollytelling",
    map_state: map_state as never,
    layer_config: lc as never,
    transition: (raw.transition as "fly-to" | "instant") ?? "fly-to",
    overlay_position:
      raw.overlay_position === "left" || raw.overlay_position === "right"
        ? (raw.overlay_position as "left" | "right")
        : "left",
  } as Chapter;
}

export function migrateStory(story: Record<string, unknown>): Story {
  const storyDatasetId = story.dataset_id as string | undefined;
  const chapters = (
    (story.chapters as Record<string, unknown>[] | undefined) ?? []
  ).map((ch) => migrateChapter(ch, storyDatasetId));

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

void MAP_BOUND_TYPES;
