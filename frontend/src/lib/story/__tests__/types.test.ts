import { describe, it, expect } from "vitest";
import {
  createScrollytellingChapter,
  createMapChapter,
  createProseChapter,
  createFlyoverChapter,
  isFlyoverChapter,
  flyoverEntryMapState,
  flyoverFallbackMapChapter,
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

describe("flyover chapter", () => {
  const kfs = [
    {
      center: [86.9, 27.9] as [number, number],
      zoom: 11,
      bearing: 0,
      pitch: 60,
    },
    {
      center: [86.95, 28.0] as [number, number],
      zoom: 11,
      bearing: 90,
      pitch: 60,
    },
  ];

  it("createFlyoverChapter defaults to no keyframes, scroll_length 1, no layer_config", () => {
    const ch = createFlyoverChapter();
    expect(ch.type).toBe("flyover");
    expect(ch.keyframes).toEqual([]);
    expect(ch.scroll_length).toBe(1);
    expect("layer_config" in ch && ch.layer_config).toBeFalsy();
    expect(ch.map_state).toEqual(DEFAULT_MAP_STATE);
  });

  it("isFlyoverChapter narrows the union", () => {
    expect(isFlyoverChapter(createFlyoverChapter())).toBe(true);
  });

  it("flyoverEntryMapState splices keyframe 0 pose into map_state", () => {
    const ch = createFlyoverChapter({
      keyframes: kfs,
      map_state: {
        ...DEFAULT_MAP_STATE,
        terrain: { enabled: true, exaggeration: 1.5 },
      },
    });
    const ms = flyoverEntryMapState(ch);
    expect(ms.center).toEqual([86.9, 27.9]);
    expect(ms.zoom).toBe(11);
    expect(ms.pitch).toBe(60);
    expect(ms.terrain).toEqual({ enabled: true, exaggeration: 1.5 });
  });

  it("flyoverEntryMapState falls back to map_state with no keyframes", () => {
    const ch = createFlyoverChapter();
    expect(flyoverEntryMapState(ch)).toEqual(ch.map_state);
  });

  it("flyoverFallbackMapChapter builds a plain map chapter at keyframe 0", () => {
    const ch = createFlyoverChapter({ keyframes: [kfs[0]], title: "Solo" });
    const map = flyoverFallbackMapChapter(ch);
    expect(map.type).toBe("map");
    expect(map.id).toBe(ch.id);
    expect(map.map_state.zoom).toBe(11);
    expect(map.layer_config.dataset_id).toBe("");
  });
});
