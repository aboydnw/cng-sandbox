// COG layers in portable mode currently fall back to the server-tile path
// (relative /cog/tiles/...). The viewer subdomain has no /cog/ proxy, so
// COG-backed embeds will not render until cng-rc.json carries layer bounds
// (so client-side rendering can engage) OR the exporter emits absolute COG
// tile URLs. v1 supports vector-geoparquet, pmtiles, and xyz; COG is a
// follow-up.
import type { Connection, ConnectionType } from "../../types";
import type { CngRcChapter, CngRcConfig, CngRcLayer } from "./cngRcTypes";
import {
  DEFAULT_LAYER_CONFIG,
  DEFAULT_MAP_STATE,
  createMapChapter,
  createProseChapter,
  createScrollytellingChapter,
} from "./types";
import type { Chapter, LayerConfig, MapState, Story } from "./types";

export interface PortableStoryBundle {
  story: Story;
  connections: Map<string, Connection>;
}

export function pickLayerUrl(layer: CngRcLayer): string | null {
  return layer.source_url ?? layer.cng_url ?? null;
}

const TILE_TYPE_BY_LAYER_TYPE: Record<
  CngRcLayer["type"],
  Connection["tile_type"]
> = {
  "raster-cog": "raster",
  pmtiles: null,
  xyz: "raster",
  "vector-geoparquet": "vector",
};

const CONNECTION_TYPE_BY_LAYER_TYPE: Record<
  CngRcLayer["type"],
  ConnectionType
> = {
  "raster-cog": "cog",
  pmtiles: "pmtiles",
  xyz: "xyz_raster",
  "vector-geoparquet": "geoparquet",
};

function synthesizeConnection(
  layerKey: string,
  layer: CngRcLayer,
  url: string
): Connection {
  return {
    id: `portable-${layerKey}`,
    name: layer.label ?? layerKey,
    url,
    connection_type: CONNECTION_TYPE_BY_LAYER_TYPE[layer.type],
    tile_type: TILE_TYPE_BY_LAYER_TYPE[layer.type],
    bounds: null,
    min_zoom: null,
    max_zoom: null,
    band_count: null,
    rescale: null,
    workspace_id: null,
    is_categorical: false,
    categories: null,
    tile_url: url,
    render_path: "client",
    conversion_status: "ready",
    conversion_error: null,
    feature_count: null,
    file_size: null,
    is_shared: false,
    preferred_colormap: layer.render.colormap,
    preferred_colormap_reversed: null,
    created_at: "",
  };
}

function buildMapState(map: CngRcChapter["map"]): MapState {
  if (!map) return { ...DEFAULT_MAP_STATE };
  return {
    center: map.center,
    zoom: map.zoom,
    bearing: map.bearing ?? 0,
    pitch: map.pitch ?? 0,
    basemap: DEFAULT_MAP_STATE.basemap,
  };
}

function parseTimestep(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildLayerConfig(
  layerKey: string | undefined,
  layer: CngRcLayer | undefined,
  hasConnection: boolean
): LayerConfig {
  if (!layerKey || !layer) {
    return { ...DEFAULT_LAYER_CONFIG, dataset_id: "" };
  }
  const config: LayerConfig = {
    dataset_id: "",
    colormap: layer.render.colormap ?? DEFAULT_LAYER_CONFIG.colormap,
    opacity: layer.render.opacity,
    basemap: DEFAULT_LAYER_CONFIG.basemap,
  };
  if (hasConnection) {
    config.connection_id = `portable-${layerKey}`;
  }
  if (layer.render.band != null) {
    config.band = layer.render.band;
  }
  const ts = parseTimestep(layer.render.timestep);
  if (ts !== undefined) {
    config.timestep = ts;
  }
  if (layer.render.rescale) {
    config.rescale_min = layer.render.rescale[0];
    config.rescale_max = layer.render.rescale[1];
  }
  return config;
}

function convertChapter(
  ch: CngRcChapter,
  index: number,
  layers: Record<string, CngRcLayer>,
  synthesizedKeys: Set<string>
): Chapter {
  const baseOverrides = {
    id: ch.id,
    title: ch.title ?? "",
    narrative: ch.body ?? "",
    order: index,
  };

  const firstLayerKey = ch.layers[0];
  const firstLayer = firstLayerKey ? layers[firstLayerKey] : undefined;
  const hasConnection = firstLayerKey
    ? synthesizedKeys.has(firstLayerKey)
    : false;
  const layerConfig = buildLayerConfig(
    firstLayerKey,
    firstLayer,
    hasConnection
  );
  const mapState = buildMapState(ch.map);

  // image/video/chart chapters fall back to prose: portable asset hosting is deferred.
  switch (ch.type) {
    case "scrollytelling":
      return createScrollytellingChapter({
        ...baseOverrides,
        map_state: mapState,
        layer_config: layerConfig,
      });
    case "map":
      return createMapChapter({
        ...baseOverrides,
        map_state: mapState,
        layer_config: layerConfig,
      });
    case "prose":
    case "image":
    case "video":
    case "chart":
    default:
      return createProseChapter(baseOverrides);
  }
}

export function cngRcToStory(config: CngRcConfig): PortableStoryBundle {
  const connections = new Map<string, Connection>();
  const synthesizedKeys = new Set<string>();

  for (const [key, layer] of Object.entries(config.layers)) {
    const url = pickLayerUrl(layer);
    if (!url) continue;
    connections.set(`portable-${key}`, synthesizeConnection(key, layer, url));
    synthesizedKeys.add(key);
  }

  const chapters = config.chapters.map((ch, index) =>
    convertChapter(ch, index, config.layers, synthesizedKeys)
  );

  const story: Story = {
    id: config.origin.story_id,
    title: config.metadata.title,
    description: config.metadata.description ?? undefined,
    dataset_id: null,
    dataset_ids: [],
    chapters,
    published: true,
    created_at: config.metadata.created,
    updated_at: config.metadata.updated,
  };

  return { story, connections };
}
