import type { Chapter } from "../../lib/story";
import { ProseChapter } from "../ProseChapter";
import { ImageChapterRenderer } from "../ImageChapterRenderer";
import { VideoChapterRenderer } from "../VideoChapterRenderer";
import { ChartChapterRenderer } from "../ChartChapterRenderer";

interface ChapterPreviewProps {
  chapter: Chapter;
  onChange?: (next: Chapter) => void;
}

export function ChapterPreview({ chapter, onChange }: ChapterPreviewProps) {
  if (chapter.type === "prose") {
    return <ProseChapter chapter={chapter} chapterIndex={chapter.order} />;
  }
  if (chapter.type === "image") {
    return (
      <ImageChapterRenderer chapter={chapter} chapterIndex={chapter.order} />
    );
  }
  if (chapter.type === "video") {
    return (
      <VideoChapterRenderer chapter={chapter} chapterIndex={chapter.order} />
    );
  }
  if (chapter.type === "chart") {
    return (
      <ChartChapterRenderer
        chapter={chapter}
        chapterIndex={chapter.order}
        onRangeChange={
          onChange
            ? (range) =>
                onChange({
                  ...chapter,
                  chart: {
                    ...chapter.chart,
                    viz: { ...chapter.chart.viz, ...range },
                  },
                })
            : undefined
        }
      />
    );
  }
  return null;
}
