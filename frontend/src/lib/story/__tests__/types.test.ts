import { describe, it, expect } from "vitest";
import {
  createScrollytellingChapter,
  createMapChapter,
  createProseChapter,
  DEFAULT_MAP_STATE,
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

describe("MapState 3D fields (backward compatible)", () => {
  it("DEFAULT_MAP_STATE has no 3D fields set", () => {
    expect("terrain" in DEFAULT_MAP_STATE).toBe(false);
    expect("globe" in DEFAULT_MAP_STATE).toBe(false);
    expect("buildings" in DEFAULT_MAP_STATE).toBe(false);
  });

  it("createScrollytellingChapter passes through 3D map_state fields", () => {
    const ch = createScrollytellingChapter({
      map_state: {
        center: [0, 0],
        zoom: 2,
        bearing: 0,
        pitch: 60,
        basemap: "streets",
        terrain: { enabled: true, exaggeration: 1.5 },
        globe: true,
        buildings: true,
      },
    });
    expect(ch.map_state.terrain).toEqual({ enabled: true, exaggeration: 1.5 });
    expect(ch.map_state.globe).toBe(true);
    expect(ch.map_state.buildings).toBe(true);
  });
});
