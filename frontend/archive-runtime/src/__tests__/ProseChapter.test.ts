import { describe, it, expect } from "vitest";
import { renderProseChapter } from "../chapters/ProseChapter";

describe("ProseChapter", () => {
  it("renders empty narrative as an empty body", () => {
    const host = document.createElement("div");
    renderProseChapter(
      { id: "p", type: "prose", title: "T", narrative: "" },
      host
    );
    expect(host.querySelector(".chapter-body")?.innerHTML).toBe("");
  });

  it("renders markdown links as anchors", () => {
    const host = document.createElement("div");
    renderProseChapter(
      {
        id: "p",
        type: "prose",
        title: "T",
        narrative: "see [docs](https://example.com)",
      },
      host
    );
    const a = host.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
  });
});
