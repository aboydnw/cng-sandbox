import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { VideoChapterRenderer } from "../VideoChapterRenderer";
import type { VideoChapter } from "../../lib/story";

function wrap(node: React.ReactNode) {
  return <ChakraProvider value={defaultSystem}>{node}</ChakraProvider>;
}

function makeChapter(overrides: Partial<VideoChapter> = {}): VideoChapter {
  return {
    id: "1",
    order: 0,
    title: "T",
    narrative: "",
    type: "video",
    video: {
      provider: "youtube",
      video_id: "abc123",
      original_url: "https://youtu.be/abc123",
    },
    ...overrides,
  };
}

describe("VideoChapterRenderer", () => {
  it("renders the YouTube embed iframe", () => {
    const { container } = render(wrap(<VideoChapterRenderer chapter={makeChapter()} chapterIndex={0} />));
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123?rel=0"
    );
  });

  it("renders the Vimeo embed iframe", () => {
    const ch = makeChapter({
      video: {
        provider: "vimeo",
        video_id: "9999",
        original_url: "https://vimeo.com/9999",
      },
    });
    const { container } = render(wrap(<VideoChapterRenderer chapter={ch} chapterIndex={0} />));
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe(
      "https://player.vimeo.com/video/9999"
    );
  });
});
