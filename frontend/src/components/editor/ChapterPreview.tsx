import { useRef } from "react";
import type { Chapter, ChartChapter } from "../../lib/story";
import { ProseChapter } from "../ProseChapter";
import { ImageChapterRenderer } from "../ImageChapterRenderer";
import { VideoChapterRenderer } from "../VideoChapterRenderer";
import { ChartChapterRenderer } from "../ChartChapterRenderer";

interface ChapterPreviewProps {
  chapter: Chapter;
  onChange?: (next: Chapter) => void;
}

export function ChapterPreview({ chapter, onChange }: ChapterPreviewProps) {
  const chapterRef = useRef(chapter);
  chapterRef.current = chapter;

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
            ? (range) => {
                const latest = chapterRef.current as ChartChapter;
                onChange({
                  ...latest,
                  chart: {
                    ...latest.chart,
                    viz: { ...latest.chart.viz, ...range },
                  },
                });
              }
            : undefined
        }
      />
    );
  }
  return null;
}
