import { describe, it, expect } from "vitest";
import { inferDataType } from "./dataType";
import type { Story } from "./types";

function makeStory(chapters: { type: string }[]): Story {
  return {
    id: "s",
    title: "t",
    description: null,
    dataset_id: null,
    dataset_ids: [],
    chapters: chapters.map((c, i) => ({
      id: `c${i}`,
      order: i,
      title: "x",
      narrative: "",
      ...c,
    })),
    published: false,
    is_example: true,
  } as unknown as Story;
}

describe("inferDataType", () => {
  it("returns 'Story' when there are no chapters", () => {
    expect(inferDataType(makeStory([]))).toBe("Story");
  });

  it("returns the single chapter type when only one is used", () => {
    expect(inferDataType(makeStory([{ type: "map" }, { type: "map" }]))).toBe(
      "Map"
    );
  });

  it("returns 'Mixed' when multiple chapter types are present", () => {
    expect(inferDataType(makeStory([{ type: "map" }, { type: "prose" }]))).toBe(
      "Mixed"
    );
  });

  it("ignores unrecognized chapter types", () => {
    expect(
      inferDataType(makeStory([{ type: "scrollytelling" }, { type: "prose" }]))
    ).toBe("Prose");
  });
});
