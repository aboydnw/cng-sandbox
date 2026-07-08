import {
  TERRAIN_DEM_URL,
  TERRAIN_DEM_ATTRIBUTION,
  BUILDINGS_SOURCE_URL,
} from "../../components/MapShell";
import type { TerrainState } from "../story/types";

const DEM_SOURCE_ID = "cng-terrain-dem";
const BUILDINGS_SOURCE_ID = "cng-buildings-src";
const BUILDINGS_LAYER_ID = "cng-buildings-3d";

export interface Apply3DOptions {
  terrain?: TerrainState;
  globe?: boolean;
  buildings?: boolean;
  /** False when the chapter has data layers — terrain is force-disabled. */
  allowTerrain: boolean;
}

// Minimal structural type; the real maplibre Map satisfies it.
interface MapLike {
  setTerrain(v: unknown): void;
  setSky(v?: unknown): void;
  setProjection(v: { type: string }): void;
  getSource(id: string): unknown;
  addSource(id: string, spec: unknown): void;
  removeSource(id: string): void;
  getLayer(id: string): unknown;
  addLayer(layer: unknown, before?: string): void;
  removeLayer(id: string): void;
}

export function apply3D(map: MapLike, opts: Apply3DOptions): void {
  const terrainOn = !!opts.terrain?.enabled && opts.allowTerrain;

  if (terrainOn) {
    if (!map.getSource(DEM_SOURCE_ID)) {
      map.addSource(DEM_SOURCE_ID, {
        type: "raster-dem",
        tiles: [TERRAIN_DEM_URL],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 13,
        attribution: TERRAIN_DEM_ATTRIBUTION,
      });
    }
    map.setTerrain({
      source: DEM_SOURCE_ID,
      exaggeration: opts.terrain?.exaggeration ?? 1,
    });
  } else {
    map.setTerrain(null);
  }

  if (terrainOn || opts.globe) {
    map.setSky({
      "sky-color": "#8ab5e6",
      "horizon-color": "#e8f0f8",
      "fog-color": "#ffffff",
      "sky-horizon-blend": 0.6,
      // Zoom-interpolated atmosphere for the globe: full atmosphere when
      // zoomed out (planet view), fading as the reader zooms into a region.
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.5, 8, 0],
    });
  }

  map.setProjection({ type: opts.globe ? "globe" : "mercator" });

  if (opts.buildings) {
    if (!map.getSource(BUILDINGS_SOURCE_ID)) {
      map.addSource(BUILDINGS_SOURCE_ID, {
        type: "vector",
        url: BUILDINGS_SOURCE_URL,
      });
    }
    if (!map.getLayer(BUILDINGS_LAYER_ID)) {
      map.addLayer({
        id: BUILDINGS_LAYER_ID,
        type: "fill-extrusion",
        source: BUILDINGS_SOURCE_ID,
        "source-layer": "building",
        paint: {
          "fill-extrusion-color": "#cbb9a6",
          "fill-extrusion-height": ["get", "render_height"],
          "fill-extrusion-base": ["get", "render_min_height"],
          "fill-extrusion-opacity": 0.85,
        },
      });
    }
  } else if (map.getLayer(BUILDINGS_LAYER_ID)) {
    map.removeLayer(BUILDINGS_LAYER_ID);
  }
}

interface MapEvents extends MapLike {
  on(evt: string, cb: () => void): void;
  off(evt: string, cb: () => void): void;
  isStyleLoaded(): boolean;
}

/** Re-apply 3D style props whenever the style reloads (basemap switch). */
export function bindStyleReapply(
  map: MapEvents,
  getOpts: () => Apply3DOptions
): () => void {
  const handler = () => {
    if (!map.isStyleLoaded()) return;
    apply3D(map, getOpts());
  };
  map.on("styledata", handler);
  return () => map.off("styledata", handler);
}
