import type { Story } from "./types";

export function migrateStory(story: Record<string, unknown>): Story {
  const chapters = (
    (story.chapters as Record<string, unknown>[] | undefined) ?? []
  ).map((ch: Record<string, unknown>) => {
    const lc: Record<string, unknown> = {
      ...(ch.layer_config as Record<string, unknown> | undefined),
    };
    if (!lc.dataset_id) {
      lc.dataset_id = story.dataset_id;
    }
    return {
      ...ch,
      layer_config: lc,
      type: ch.type ?? "scrollytelling",
      overlay_position: ch.overlay_position ?? "left",
    };
  });

  const chapterDatasetIds = chapters
    .map(
      (ch: Record<string, unknown>) =>
        (ch.layer_config as Record<string, unknown>).dataset_id as
          | string
          | undefined
    )
    .filter((id): id is string => Boolean(id));
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

  return { ...story, chapters, dataset_ids } as unknown as Story;
}
