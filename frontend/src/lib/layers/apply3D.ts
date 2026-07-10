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
  getTerrain(): { source?: string; exaggeration?: number } | null | undefined;
  setTerrain(v: unknown): void;
  setSky(v?: unknown): void;
  getProjection(): { type?: unknown } | null | undefined;
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
    // setTerrain constructs a new Terrain + RenderToTexture each call, so
    // skip it when the current terrain already matches (keeps slider drags
    // and styledata/sourcedata re-applies cheap).
    const exaggeration = opts.terrain?.exaggeration ?? 1;
    const current = map.getTerrain();
    if (
      !current ||
      current.source !== DEM_SOURCE_ID ||
      current.exaggeration !== exaggeration
    ) {
      map.setTerrain({ source: DEM_SOURCE_ID, exaggeration });
    }
  } else {
    if (map.getTerrain()) map.setTerrain(null);
    if (map.getSource(DEM_SOURCE_ID)) map.removeSource(DEM_SOURCE_ID);
  }

  if (terrainOn || opts.globe) {
    map.setSky({
      "sky-color": "#8ab5e6",
      "horizon-color": "#e8f0f8",
      "fog-color": "#ffffff",
      "sky-horizon-blend": 0.6,
      // Zoom-interpolated atmosphere for the globe: full atmosphere when
      // zoomed out (planet view), fading as the reader zooms into a region.
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        5,
        0.5,
        8,
        0,
      ],
    });
  } else {
    // Clear any sky/fog carried over from a previous terrain/globe chapter.
    map.setSky(undefined);
  }

  const projection = opts.globe ? "globe" : "mercator";
  if (map.getProjection()?.type !== projection) {
    map.setProjection({ type: projection });
  }

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
  } else {
    if (map.getLayer(BUILDINGS_LAYER_ID)) {
      map.removeLayer(BUILDINGS_LAYER_ID);
    }
    if (map.getSource(BUILDINGS_SOURCE_ID)) {
      map.removeSource(BUILDINGS_SOURCE_ID);
    }
  }
}

interface MapEvents extends MapLike {
  on(evt: string, cb: () => void): void;
  off(evt: string, cb: () => void): void;
  isStyleLoaded(): boolean;
}

/**
 * Re-apply 3D style props whenever the style reloads (basemap switch).
 *
 * react-map-gl's diffed `setStyle` often fires `styledata` before the style
 * finishes loading, and no later `styledata` is guaranteed — so terrain, sky
 * and globe would silently drop. Mirror the pattern react-maplibre uses for
 * its own terrain re-application: listen on `style.load` AND `sourcedata`
 * (sources arriving late are what terrain needs) as well as `styledata`.
 * apply3D is idempotent (Fix 5), so the extra invocations are cheap.
 */
export function bindStyleReapply(
  map: MapEvents,
  getOpts: () => Apply3DOptions
): () => void {
  const handler = () => {
    if (!map.isStyleLoaded()) return;
    apply3D(map, getOpts());
  };
  map.on("style.load", handler);
  map.on("styledata", handler);
  map.on("sourcedata", handler);
  return () => {
    map.off("style.load", handler);
    map.off("styledata", handler);
    map.off("sourcedata", handler);
  };
}
