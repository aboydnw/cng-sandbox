import { describe, it, expect } from "vitest";
import { chapterTransitionDuration } from "../chapterTransition";

describe("chapterTransitionDuration", () => {
  it("returns 2500ms for a fly-to transition", () => {
    expect(chapterTransitionDuration("fly-to")).toBe(2500);
  });

  it("returns undefined (instant jumpTo) for an instant transition", () => {
    expect(chapterTransitionDuration("instant")).toBeUndefined();
  });
});
