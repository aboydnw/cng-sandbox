import type { Story } from "./types";

export function migrateStory(story: Record<string, unknown>): Story {
  const chapters = ((story.chapters as Record<string, unknown>[] | undefined) ?? []).map((ch: Record<string, unknown>) => {
    const lc = { ...(ch.layer_config ?? {}) };
    if (!lc.dataset_id) {
      lc.dataset_id = story.dataset_id;
    }
    return { ...ch, layer_config: lc, type: ch.type ?? "scrollytelling" };
  });

  const chapterDatasetIds = chapters
    .map((ch: Record<string, unknown>) => (ch.layer_config as Record<string, unknown>).dataset_id)
    .filter((id: string) => id);
  const uniqueIds = [...new Set<string>(chapterDatasetIds)];

  const dataset_ids =
    story.dataset_ids && story.dataset_ids.length > 0
      ? story.dataset_ids
      : uniqueIds.length > 0
        ? uniqueIds
        : story.dataset_id
          ? [story.dataset_id]
          : [];

  return { ...story, chapters, dataset_ids };
}
