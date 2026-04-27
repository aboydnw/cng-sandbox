import type { Chapter } from "../../lib/story";
import { ProseChapter } from "../ProseChapter";

interface ChapterPreviewProps {
  chapter: Chapter;
}

/**
 * Dispatches on chapter.type to render a live preview matching what the reader
 * will see. Map-bound chapter types (scrollytelling, map) return null because
 * the editor mounts an editable UnifiedMap for those instead.
 *
 * As new chapter types ship (image, video, chart), add a branch here that
 * imports and renders the corresponding reader component.
 */
export function ChapterPreview({ chapter }: ChapterPreviewProps) {
  if (chapter.type === "prose") {
    return <ProseChapter chapter={chapter} chapterIndex={0} />;
  }
  return null;
}
