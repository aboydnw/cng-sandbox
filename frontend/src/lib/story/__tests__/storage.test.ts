import { describe, it, expect, beforeEach } from "vitest";
import { getStory, saveStory, listStories, deleteStory } from "../storage";
import { createStory } from "../types";

beforeEach(() => {
  localStorage.clear();
});

describe("saveStory / getStory", () => {
  it("round-trips a story through localStorage", () => {
    const story = createStory("dataset-1", { title: "Test Story" });
    saveStory(story);
    const loaded = getStory(story.id);
    expect(loaded).toEqual(story);
  });

  it("returns null for unknown id", () => {
    expect(getStory("nonexistent")).toBeNull();
  });

  it("overwrites an existing story on re-save", () => {
    const story = createStory("dataset-1", { title: "Original" });
    saveStory(story);
    story.title = "Updated";
    saveStory(story);
    expect(getStory(story.id)?.title).toBe("Updated");
  });
});

describe("listStories", () => {
  it("returns empty array when no stories exist", () => {
    expect(listStories()).toEqual([]);
  });

  it("returns index entries for saved stories", () => {
    const s1 = createStory("d1", { title: "First" });
    const s2 = createStory("d2", { title: "Second" });
    saveStory(s1);
    saveStory(s2);
    const list = listStories();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.title).sort()).toEqual(["First", "Second"]);
  });
});

describe("deleteStory", () => {
  it("removes story and its index entry", () => {
    const story = createStory("d1", { title: "Doomed" });
    saveStory(story);
    deleteStory(story.id);
    expect(getStory(story.id)).toBeNull();
    expect(listStories()).toHaveLength(0);
  });

  it("is a no-op for unknown id", () => {
    deleteStory("nonexistent");
    expect(listStories()).toHaveLength(0);
  });
});
