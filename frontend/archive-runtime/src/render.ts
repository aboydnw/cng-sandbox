import type { ChapterEntry } from "./types";
import { renderProseChapter } from "./chapters/ProseChapter";
import { renderImageChapter } from "./chapters/ImageChapter";
import { renderVideoChapter } from "./chapters/VideoChapter";
import { renderScrollyChapter } from "./chapters/ScrollyChapter";
import { renderChartChapter } from "./chapters/ChartChapter";

export async function renderChapter(
  chapter: ChapterEntry,
  host: HTMLElement,
  basePath: string
): Promise<void> {
  switch (chapter.type) {
    case "prose":
      renderProseChapter(chapter, host);
      return;
    case "image":
      renderImageChapter(chapter, host);
      return;
    case "video":
      renderVideoChapter(chapter, host);
      return;
    case "scrollytelling":
      renderScrollyChapter(chapter, host, basePath);
      return;
    case "chart":
      await renderChartChapter(chapter, host, basePath);
      return;
    case "map": {
      const { renderMapChapter } = await import("./chapters/MapChapter");
      await renderMapChapter(chapter, host, basePath);
      return;
    }
    default: {
      const _exhaustive: never = chapter;
      void _exhaustive;
      throw new Error(
        `unknown chapter type: ${(chapter as { type: string }).type}`
      );
    }
  }
}
