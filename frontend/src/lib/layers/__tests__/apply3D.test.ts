import { describe, it, expect, vi } from "vitest";
import { apply3D } from "../apply3D";

function mockMap() {
  const sources = new Set<string>();
  const layers = new Set<string>();
  let terrain: { source: string; exaggeration: number } | null = null;
  let projection: { type: string } | undefined;
  return {
    setTerrain: vi.fn((v: { source: string; exaggeration: number } | null) => {
      terrain = v;
    }),
    getTerrain: () => terrain,
    setSky: vi.fn(),
    setProjection: vi.fn((v: { type: string }) => {
      projection = v;
    }),
    getProjection: () => projection,
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

  it("skips setTerrain when re-applied with an identical config", () => {
    const map = mockMap();
    const opts = {
      terrain: { enabled: true, exaggeration: 1.5 },
      allowTerrain: true,
    };
    apply3D(map as never, opts);
    apply3D(map as never, opts);
    expect(map.setTerrain).toHaveBeenCalledTimes(1);
  });

  it("re-sets terrain when the exaggeration changes", () => {
    const map = mockMap();
    apply3D(map as never, {
      terrain: { enabled: true, exaggeration: 1 },
      allowTerrain: true,
    });
    apply3D(map as never, {
      terrain: { enabled: true, exaggeration: 2 },
      allowTerrain: true,
    });
    expect(map.setTerrain).toHaveBeenCalledTimes(2);
    expect(map.setTerrain).toHaveBeenLastCalledWith(
      expect.objectContaining({ exaggeration: 2 })
    );
  });

  it("disables terrain when data layers are present (allowTerrain=false)", () => {
    const map = mockMap();
    apply3D(map as never, {
      terrain: { enabled: true, exaggeration: 2 },
      allowTerrain: true,
    });
    apply3D(map as never, {
      terrain: { enabled: true, exaggeration: 2 },
      allowTerrain: false,
    });
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
    expect(map.getTerrain()).toBeNull();
  });

  it("removes the DEM source when terrain toggles off", () => {
    const map = mockMap();
    apply3D(map as never, {
      terrain: { enabled: true, exaggeration: 1.5 },
      allowTerrain: true,
    });
    apply3D(map as never, {
      terrain: { enabled: false, exaggeration: 1.5 },
      allowTerrain: true,
    });
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
    expect(map.removeSource).toHaveBeenCalledWith("cng-terrain-dem");
  });

  it("does not touch terrain or the DEM source when already off", () => {
    const map = mockMap();
    apply3D(map as never, {
      terrain: { enabled: false, exaggeration: 1 },
      allowTerrain: true,
    });
    expect(map.setTerrain).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
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

  it("skips setProjection when the projection is unchanged", () => {
    const map = mockMap();
    apply3D(map as never, { globe: true, allowTerrain: true });
    apply3D(map as never, { globe: true, allowTerrain: true });
    expect(map.setProjection).toHaveBeenCalledTimes(1);
  });

  it("buildings on adds a fill-extrusion layer; off removes layer and source", () => {
    const map = mockMap();
    apply3D(map as never, { buildings: true, allowTerrain: true });
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cng-buildings-3d",
        type: "fill-extrusion",
      })
    );
    apply3D(map as never, { buildings: false, allowTerrain: true });
    expect(map.removeLayer).toHaveBeenCalledWith("cng-buildings-3d");
    expect(map.removeSource).toHaveBeenCalledWith("cng-buildings-src");
  });

  it("does not remove buildings when they were never added", () => {
    const map = mockMap();
    apply3D(map as never, { buildings: false, allowTerrain: true });
    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
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
