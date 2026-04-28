import type { Chapter } from "../../lib/story";
import { ProseChapter } from "../ProseChapter";
import { ImageChapterRenderer } from "../ImageChapterRenderer";
import { ChartChapterRenderer } from "../ChartChapterRenderer";

interface ChapterPreviewProps {
  chapter: Chapter;
}

export function ChapterPreview({ chapter }: ChapterPreviewProps) {
  if (chapter.type === "prose") {
    return <ProseChapter chapter={chapter} chapterIndex={chapter.order} />;
  }
  if (chapter.type === "image") {
    return (
      <ImageChapterRenderer chapter={chapter} chapterIndex={chapter.order} />
    );
  }
  if (chapter.type === "chart") {
    return <ChartChapterRenderer chapter={chapter} chapterIndex={chapter.order} />;
  }
  return null;
}
