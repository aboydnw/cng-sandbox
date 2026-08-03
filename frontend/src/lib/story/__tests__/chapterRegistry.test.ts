import { describe, expect, it } from "vitest";
import { CHAPTER_TYPE_REGISTRY } from "../chapterRegistry";

describe("chapter type registry", () => {
  it("defines every chapter type exactly once", () => {
    expect(CHAPTER_TYPE_REGISTRY.map((item) => item.type).sort()).toEqual(
      [
        "chart",
        "flyover",
        "image",
        "map",
        "prose",
        "scrollytelling",
        "video",
      ].sort()
    );
  });

  it("keeps specialized types secondary", () => {
    const secondary = CHAPTER_TYPE_REGISTRY.filter(
      (item) => item.prominence === "secondary"
    ).map((item) => item.type);
    expect(secondary).toEqual(["video", "chart", "flyover"]);
  });
});
