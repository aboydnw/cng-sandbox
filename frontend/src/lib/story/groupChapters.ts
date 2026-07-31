import type {
  Chapter,
  ChartChapter,
  FlyoverChapter,
  ImageChapter,
  MapChapter,
  ProseChapter,
  ScrollytellingChapter,
  VideoChapter,
} from "./types";

export type ContentBlock =
  | {
      type: "scrollytelling";
      chapters: ScrollytellingChapter[];
      startIndex: number;
    }
  | { type: "prose"; chapter: ProseChapter; index: number }
  | { type: "map"; chapter: MapChapter; index: number }
  | { type: "image"; chapter: ImageChapter; index: number }
  | { type: "video"; chapter: VideoChapter; index: number }
  | { type: "chart"; chapter: ChartChapter; index: number }
  | { type: "flyover"; chapter: FlyoverChapter; index: number };

export type MapContentBlock = Extract<
  ContentBlock,
  { type: "map" | "scrollytelling" | "flyover" }
>;

/**
 * Groups adjacent scrollytelling chapters while keeping lightweight chapters
 * independent. This module deliberately has no map-rendering imports so the
 * story document can be evaluated before the map runtime is requested.
 */
export function groupChaptersIntoBlocks(chapters: Chapter[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let scrollyGroup: ScrollytellingChapter[] = [];
  let scrollyStartIndex = 0;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (chapter.type === "scrollytelling") {
      if (scrollyGroup.length === 0) scrollyStartIndex = i;
      scrollyGroup.push(chapter);
      continue;
    }

    if (scrollyGroup.length > 0) {
      blocks.push({
        type: "scrollytelling",
        chapters: scrollyGroup,
        startIndex: scrollyStartIndex,
      });
      scrollyGroup = [];
    }

    switch (chapter.type) {
      case "map":
      case "prose":
      case "image":
      case "video":
      case "chart":
      case "flyover":
        blocks.push({ type: chapter.type, chapter, index: i } as ContentBlock);
        break;
      default: {
        const exhaustive: never = chapter;
        void exhaustive;
      }
    }
  }

  if (scrollyGroup.length > 0) {
    blocks.push({
      type: "scrollytelling",
      chapters: scrollyGroup,
      startIndex: scrollyStartIndex,
    });
  }

  return blocks;
}
