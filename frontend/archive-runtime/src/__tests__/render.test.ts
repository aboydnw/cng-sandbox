import { describe, it, expect, beforeEach } from "vitest";
import { renderChapter } from "../render";
import type { ChapterEntry } from "../types";

describe("renderChapter dispatcher", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(root);
  });

  it("renders a prose chapter section into the root", async () => {
    const ch: ChapterEntry = {
      id: "p1",
      type: "prose",
      title: "Intro",
      narrative: "Hello *world*.",
    };
    await renderChapter(ch, root, ".");
    const section = root.querySelector("section.chapter.prose");
    expect(section).not.toBeNull();
    expect(section!.querySelector("h2")?.textContent).toBe("Intro");
    expect(section!.innerHTML).toContain("<em>world</em>");
  });

  it("throws on an unknown chapter type", async () => {
    const ch = { id: "x", type: "bogus", title: "", narrative: "" } as unknown as ChapterEntry;
    await expect(renderChapter(ch, root, ".")).rejects.toThrow(/unknown chapter type/);
  });
});
