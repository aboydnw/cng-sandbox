import type { ChapterType } from "./types";

export const CHAPTER_TYPE_LABELS: Record<ChapterType, string> = {
  scrollytelling: "Guided tour",
  prose: "Text only",
  map: "Interactive map",
  video: "Video",
};

export const CHAPTER_TYPE_DESCRIPTIONS: Record<ChapterType, string> = {
  scrollytelling:
    "Reader scrolls through map views with your narration alongside",
  prose: "A text-only section with no map",
  map: "Reader freely explores an interactive map",
  video: "Embed a YouTube or Vimeo video",
};
