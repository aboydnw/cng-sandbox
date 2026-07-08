import { describe, it, expect, vi } from "vitest";
import { bindStyleReapply } from "../apply3D";

describe("bindStyleReapply", () => {
  it("re-invokes apply3D when the map fires styledata after a basemap switch", () => {
    const handlers: Record<string, (() => void)[]> = {};
    const map = {
      on: (evt: string, cb: () => void) => {
        (handlers[evt] ??= []).push(cb);
      },
      off: vi.fn(),
      isStyleLoaded: () => true,
      setTerrain: vi.fn(),
      setSky: vi.fn(),
      setProjection: vi.fn(),
      getSource: () => undefined,
      addSource: vi.fn(),
      removeSource: vi.fn(),
      getLayer: () => undefined,
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
    };
    const getOpts = () => ({ globe: true, allowTerrain: true });
    bindStyleReapply(map as never, getOpts);
    // Simulate basemap switch → style reload → styledata event.
    handlers["styledata"]?.forEach((cb) => cb());
    expect(map.setProjection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "globe" })
    );
  });
});
