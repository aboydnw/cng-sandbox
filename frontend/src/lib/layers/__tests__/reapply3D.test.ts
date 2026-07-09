import { describe, it, expect, vi } from "vitest";
import { bindStyleReapply } from "../apply3D";

function mockMap(isStyleLoaded: () => boolean) {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    handlers,
    on: (evt: string, cb: () => void) => {
      (handlers[evt] ??= []).push(cb);
    },
    off: vi.fn((evt: string, cb: () => void) => {
      handlers[evt] = (handlers[evt] ?? []).filter((h) => h !== cb);
    }),
    fire: (evt: string) => handlers[evt]?.forEach((cb) => cb()),
    isStyleLoaded,
    getTerrain: () => null,
    setTerrain: vi.fn(),
    setSky: vi.fn(),
    getProjection: () => undefined,
    setProjection: vi.fn(),
    getSource: () => undefined,
    addSource: vi.fn(),
    removeSource: vi.fn(),
    getLayer: () => undefined,
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  };
}

describe("bindStyleReapply", () => {
  it("re-invokes apply3D when the map fires styledata after a basemap switch", () => {
    const map = mockMap(() => true);
    bindStyleReapply(map as never, () => ({ globe: true, allowTerrain: true }));
    map.fire("styledata");
    expect(map.setProjection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "globe" })
    );
  });

  it("re-applies on the diff path: styledata fires unloaded, then sourcedata fires loaded", () => {
    let loaded = false;
    const map = mockMap(() => loaded);
    bindStyleReapply(map as never, () => ({ globe: true, allowTerrain: true }));

    // Diffed setStyle emits styledata before the style has loaded — the old
    // styledata-only binding would bail here and never re-apply.
    map.fire("styledata");
    expect(map.setProjection).not.toHaveBeenCalled();

    // Sources arrive and the style finishes loading; sourcedata carries the
    // re-application.
    loaded = true;
    map.fire("sourcedata");
    expect(map.setProjection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "globe" })
    );
  });

  it("re-applies on style.load", () => {
    const map = mockMap(() => true);
    bindStyleReapply(map as never, () => ({ globe: true, allowTerrain: true }));
    map.fire("style.load");
    expect(map.setProjection).toHaveBeenCalled();
  });

  it("unbinds all three listeners on cleanup", () => {
    const map = mockMap(() => true);
    const unbind = bindStyleReapply(map as never, () => ({
      globe: true,
      allowTerrain: true,
    }));
    unbind();
    expect(map.off).toHaveBeenCalledWith("style.load", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("styledata", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("sourcedata", expect.any(Function));
    map.fire("styledata");
    expect(map.setProjection).not.toHaveBeenCalled();
  });
});
