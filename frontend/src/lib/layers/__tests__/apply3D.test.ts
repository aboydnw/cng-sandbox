import { describe, it, expect, vi } from "vitest";
import { apply3D } from "../apply3D";

function mockMap() {
  const sources = new Set<string>();
  const layers = new Set<string>();
  return {
    calls: [] as string[],
    setTerrain: vi.fn((_v: unknown) => {}),
    setSky: vi.fn(),
    setProjection: vi.fn(),
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    addSource: vi.fn((id: string) => sources.add(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    getLayer: (id: string) => (layers.has(id) ? {} : undefined),
    addLayer: vi.fn((l: { id: string }) => layers.add(l.id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    isStyleLoaded: () => true,
  };
}

describe("apply3D", () => {
  it("enables terrain: adds the DEM source, sets terrain + sky", () => {
    const map = mockMap();
    apply3D(map as never, {
      terrain: { enabled: true, exaggeration: 1.5 },
      allowTerrain: true,
    });
    expect(map.addSource).toHaveBeenCalledWith(
      "cng-terrain-dem",
      expect.objectContaining({ type: "raster-dem", encoding: "terrarium" })
    );
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({ source: "cng-terrain-dem", exaggeration: 1.5 })
    );
    expect(map.setSky).toHaveBeenCalled();
  });

  it("ignores terrain when data layers are present (allowTerrain=false)", () => {
    const map = mockMap();
    apply3D(map as never, {
      terrain: { enabled: true, exaggeration: 2 },
      allowTerrain: false,
    });
    expect(map.setTerrain).toHaveBeenCalledWith(null);
  });

  it("disables terrain when flag is off", () => {
    const map = mockMap();
    apply3D(map as never, {
      terrain: { enabled: false, exaggeration: 1 },
      allowTerrain: true,
    });
    expect(map.setTerrain).toHaveBeenCalledWith(null);
  });

  it("globe on sets globe projection; globe off sets mercator", () => {
    const on = mockMap();
    apply3D(on as never, { globe: true, allowTerrain: true });
    expect(on.setProjection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "globe" })
    );
    const off = mockMap();
    apply3D(off as never, { globe: false, allowTerrain: true });
    expect(off.setProjection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mercator" })
    );
  });

  it("buildings on adds a fill-extrusion layer; off removes it", () => {
    const on = mockMap();
    apply3D(on as never, { buildings: true, allowTerrain: true });
    expect(on.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cng-buildings-3d",
        type: "fill-extrusion",
      })
    );
    const off = mockMap();
    off.getLayer = () => ({}) as never;
    apply3D(off as never, { buildings: false, allowTerrain: true });
    expect(off.removeLayer).toHaveBeenCalledWith("cng-buildings-3d");
  });

  it("enables sky with a zoom-interpolated atmosphere-blend when globe is on", () => {
    const map = mockMap();
    apply3D(map as never, { globe: true, allowTerrain: true });
    expect(map.setSky).toHaveBeenCalledWith(
      expect.objectContaining({ "atmosphere-blend": expect.any(Array) })
    );
  });

  it("resets the sky when neither terrain nor globe is enabled", () => {
    const map = mockMap();
    apply3D(map as never, { globe: false, allowTerrain: true });
    expect(map.setSky).toHaveBeenCalledWith(undefined);
  });
});
