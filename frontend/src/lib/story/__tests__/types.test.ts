import { describe, it, expect } from "vitest";
import {
  createScrollytellingChapter,
  createMapChapter,
  createProseChapter,
} from "../types";

describe("chapter factories", () => {
  it("createScrollytellingChapter returns a scrollytelling chapter with map_state and layer_config", () => {
    const ch = createScrollytellingChapter();
    expect(ch.type).toBe("scrollytelling");
    expect(ch.map_state).toBeDefined();
    expect(ch.layer_config).toBeDefined();
    expect(ch.transition).toBe("fly-to");
    expect(ch.overlay_position).toBe("left");
  });

  it("createMapChapter returns a map chapter with map_state and layer_config", () => {
    const ch = createMapChapter();
    expect(ch.type).toBe("map");
    expect(ch.map_state).toBeDefined();
    expect(ch.layer_config).toBeDefined();
  });

  it("createProseChapter returns a prose chapter without map_state or layer_config", () => {
    const ch = createProseChapter();
    expect(ch.type).toBe("prose");
    expect("map_state" in ch).toBe(false);
    expect("layer_config" in ch).toBe(false);
  });

  it("factories accept overrides", () => {
    const ch = createScrollytellingChapter({ title: "Chapter X", order: 3 });
    expect(ch.title).toBe("Chapter X");
    expect(ch.order).toBe(3);
  });
});
