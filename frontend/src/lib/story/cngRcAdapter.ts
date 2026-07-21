// COG layers in portable mode currently fall back to the server-tile path
// (relative /cog/tiles/...). The viewer subdomain has no /cog/ proxy, so
// COG-backed embeds will not render until cng-rc.json carries layer bounds
// (so client-side rendering can engage) OR the exporter emits absolute COG
// tile URLs. v1 supports vector-geoparquet, pmtiles, and xyz; COG is a
// follow-up.
import type { Connection, ConnectionType, Dataset } from "../../types";
import type { CngRcChapter, CngRcConfig, CngRcLayer } from "./cngRcTypes";
import {
  DEFAULT_LAYER_CONFIG,
  DEFAULT_MAP_STATE,
  createMapChapter,
  createProseChapter,
  createScrollytellingChapter,
} from "./types";
import type {
  Chapter,
  LayerConfig,
  MapState,
  OverlayConfig,
  Story,
} from "./types";

export interface PortableStoryBundle {
  story: Story;
  connections: Map<string, Connection>;
  datasets: Map<string, Dataset>;
}

export function pickLayerUrl(layer: CngRcLayer): string | null {
  const sourceUrl = layer.source_url?.trim();
  if (sourceUrl) return sourceUrl;

  const cngUrl = layer.cng_url?.trim();
  return cngUrl || null;
}

// Trajectory layers are reconstructed as Datasets (not Connections), so they
// are intentionally absent from these connection-oriented maps.
const TILE_TYPE_BY_LAYER_TYPE: Partial<
  Record<CngRcLayer["type"], Connection["tile_type"]>
> = {
  "raster-cog": "raster",
  pmtiles: null,
  xyz: "raster",
  "vector-geoparquet": "vector",
  copc: null,
};

const CONNECTION_TYPE_BY_LAYER_TYPE: Partial<
  Record<CngRcLayer["type"], ConnectionType>
> = {
  "raster-cog": "cog",
  pmtiles: "pmtiles",
  xyz: "xyz_raster",
  "vector-geoparquet": "geoparquet",
  copc: "copc",
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
    connection_type: CONNECTION_TYPE_BY_LAYER_TYPE[layer.type] ?? "cog",
    tile_type: TILE_TYPE_BY_LAYER_TYPE[layer.type] ?? null,
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
    config: null,
    geozarr_attrs: null,
    created_at: "",
  };
}

function synthesizeTrajectoryDataset(
  layerKey: string,
  layer: CngRcLayer,
  url: string
): Dataset {
  return {
    id: `portable-${layerKey}`,
    filename: layer.label ?? layerKey,
    title: layer.label ?? layerKey,
    dataset_type: "trajectory",
    format_pair: "gpx_to_geoparquet",
    tile_url: url,
    trips_url: url,
    bounds: null,
    band_count: null,
    band_names: null,
    color_interpretation: null,
    dtype: null,
    original_file_size: null,
    converted_file_size: null,
    geoparquet_file_size: null,
    feature_count: null,
    geometry_types: null,
    min_zoom: null,
    max_zoom: null,
    stac_collection_id: null,
    pg_table: null,
    parquet_url: null,
    cog_url: null,
    copc_url: null,
    point_count: null,
    track_count: null,
    time_start: null,
    time_end: null,
    validation_results: [],
    credits: [],
    created_at: "",
    is_temporal: false,
    timesteps: [],
    raster_min: null,
    raster_max: null,
    is_categorical: false,
    categories: null,
    crs: null,
    crs_name: null,
    pixel_width: null,
    pixel_height: null,
    resolution: null,
    compression: null,
    is_mosaic: false,
    is_zero_copy: false,
    is_shared: false,
    preferred_colormap: null,
    preferred_colormap_reversed: null,
    source_url: layer.source_url,
    expires_at: null,
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
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const n = Number(trimmed);
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
  if (layer.type === "trajectory") {
    config.dataset_id = `portable-${layerKey}`;
    config.trail_length = layer.render.trail_length ?? null;
    return config;
  }
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

function buildOverlays(
  layerKeys: string[],
  layers: Record<string, CngRcLayer>,
  synthesizedKeys: Set<string>
): OverlayConfig[] {
  const overlays: OverlayConfig[] = [];
  for (const key of layerKeys) {
    if (!synthesizedKeys.has(key)) continue;
    const layer = layers[key];
    overlays.push({
      connection_id: `portable-${key}`,
      opacity: layer?.render.opacity ?? 1,
      visible: true,
    });
  }
  return overlays;
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
  const overlays = buildOverlays(ch.layers.slice(1), layers, synthesizedKeys);
  const mapState = buildMapState(ch.map);

  // image/video/chart chapters fall back to prose: portable asset hosting is deferred.
  switch (ch.type) {
    case "scrollytelling":
      return createScrollytellingChapter({
        ...baseOverrides,
        map_state: mapState,
        layer_config: layerConfig,
        overlays,
      });
    case "map":
      return createMapChapter({
        ...baseOverrides,
        map_state: mapState,
        layer_config: layerConfig,
        overlays,
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
  const datasets = new Map<string, Dataset>();
  const synthesizedKeys = new Set<string>();

  for (const [key, layer] of Object.entries(config.layers)) {
    const url = pickLayerUrl(layer);
    if (!url) continue;
    if (layer.type === "trajectory") {
      datasets.set(
        `portable-${key}`,
        synthesizeTrajectoryDataset(key, layer, url)
      );
      continue;
    }
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

  return { story, connections, datasets };
}
