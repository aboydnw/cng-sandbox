import type { VideoProvider } from "./video";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface MapState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  basemap: string;
}

export interface LayerConfig {
  dataset_id: string;
  connection_id?: string;
  colormap: string;
  opacity: number;
  basemap: string;
  band?: number;
  timestep?: number;
  rescale_min?: number | null;
  rescale_max?: number | null;
  colormap_reversed?: boolean;
}

export type ChapterType =
  | "scrollytelling"
  | "prose"
  | "map"
  | "image"
  | "video"
  | "chart";

interface BaseChapter {
  id: string;
  order: number;
  title: string;
  narrative: string;
}

export interface ScrollytellingChapter extends BaseChapter {
  type: "scrollytelling";
  map_state: MapState;
  layer_config: LayerConfig;
  transition: "fly-to" | "instant";
  overlay_position: "left" | "right";
}

export interface MapChapter extends BaseChapter {
  type: "map";
  map_state: MapState;
  layer_config: LayerConfig;
}

export interface ProseChapter extends BaseChapter {
  type: "prose";
}

export interface ImageAsset {
  asset_id: string;
  url: string;
  thumbnail_url: string;
  alt_text: string;
  width: number;
  height: number;
}

export interface ImageChapter extends BaseChapter {
  type: "image";
  image: ImageAsset;
}

export interface VideoEmbed {
  provider: VideoProvider;
  video_id: string;
  original_url: string;
}

export interface VideoChapter extends BaseChapter {
  type: "video";
  video: VideoEmbed;
}

export interface CsvSource {
  kind: "csv";
  asset_id: string;
  url: string;
  columns: string[];
}

export interface DatasetTimeseriesSource {
  kind: "dataset_timeseries";
  dataset_id: string;
  point: [number, number];
}

export interface DatasetHistogramSource {
  kind: "dataset_histogram";
  dataset_id: string;
  bins?: number;
}

export type ChartSource =
  | CsvSource
  | DatasetTimeseriesSource
  | DatasetHistogramSource;

export interface ChartViz {
  kind: "line" | "bar";
  x_field: string;
  y_fields: string[];
  x_label?: string;
  y_label?: string;
  y_scale?: "linear" | "log";
}

export interface ChartChapter extends BaseChapter {
  type: "chart";
  chart: { source: ChartSource; viz: ChartViz };
}

export type Chapter =
  | ScrollytellingChapter
  | MapChapter
  | ProseChapter
  | ImageChapter
  | VideoChapter
  | ChartChapter;

export interface Story {
  id: string;
  title: string;
  description?: string;
  dataset_id: string | null;
  dataset_ids: string[];
  chapters: Chapter[];
  created_at: string;
  updated_at: string;
  published: boolean;
}

export interface StoryIndexEntry {
  id: string;
  title: string;
  dataset_id: string | null;
  created_at: string;
}

export const DEFAULT_LAYER_CONFIG: LayerConfig = {
  dataset_id: "",
  colormap: "viridis",
  opacity: 0.8,
  basemap: "streets",
};

export const DEFAULT_MAP_STATE: MapState = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
  basemap: "streets",
};

const baseFields = (overrides: Partial<BaseChapter>): BaseChapter => ({
  id: overrides.id ?? uuid(),
  order: overrides.order ?? 0,
  title: overrides.title ?? "Untitled chapter",
  narrative: overrides.narrative ?? "",
});

export function createScrollytellingChapter(
  overrides: Partial<ScrollytellingChapter> = {}
): ScrollytellingChapter {
  return {
    ...baseFields(overrides),
    type: "scrollytelling",
    map_state: overrides.map_state ?? { ...DEFAULT_MAP_STATE },
    layer_config: overrides.layer_config ?? { ...DEFAULT_LAYER_CONFIG },
    transition: overrides.transition ?? "fly-to",
    overlay_position: overrides.overlay_position ?? "left",
  };
}

export function createMapChapter(
  overrides: Partial<MapChapter> = {}
): MapChapter {
  return {
    ...baseFields(overrides),
    type: "map",
    map_state: overrides.map_state ?? { ...DEFAULT_MAP_STATE },
    layer_config: overrides.layer_config ?? { ...DEFAULT_LAYER_CONFIG },
  };
}

export function createProseChapter(
  overrides: Partial<ProseChapter> = {}
): ProseChapter {
  return {
    ...baseFields(overrides),
    type: "prose",
  };
}

export function createImageChapter(
  overrides: Partial<ImageChapter> = {}
): ImageChapter {
  return {
    ...baseFields(overrides),
    type: "image",
    image: overrides.image ?? {
      asset_id: "",
      url: "",
      thumbnail_url: "",
      alt_text: "",
      width: 0,
      height: 0,
    },
  };
}

export function createVideoChapter(
  overrides: Partial<VideoChapter> = {}
): VideoChapter {
  return {
    ...baseFields(overrides),
    type: "video",
    video: overrides.video ?? {
      provider: "youtube",
      video_id: "",
      original_url: "",
    },
  };
}

export function createChartChapter(
  overrides: Partial<ChartChapter> = {}
): ChartChapter {
  return {
    ...baseFields(overrides),
    type: "chart",
    chart: overrides.chart ?? {
      source: { kind: "csv", asset_id: "", url: "", columns: [] },
      viz: { kind: "line", x_field: "", y_fields: [], y_scale: "linear" },
    },
  };
}

/** Backwards-compat alias used by older callers. Defaults to scrollytelling. */
export function createChapter(
  overrides: Partial<ScrollytellingChapter> = {}
): ScrollytellingChapter {
  return createScrollytellingChapter(overrides);
}

export interface CreateStoryOptions {
  preferredColormap?: string | null;
  preferredColormapReversed?: boolean | null;
}

export function createStory(
  datasetId?: string | null,
  overrides: Partial<Story> & CreateStoryOptions = {}
): Story {
  const { preferredColormap, preferredColormapReversed, ...storyOverrides } =
    overrides;
  const chapter: Chapter = datasetId
    ? createScrollytellingChapter({
        order: 0,
        title: "Chapter 1",
        layer_config: {
          ...DEFAULT_LAYER_CONFIG,
          dataset_id: datasetId,
          colormap: preferredColormap ?? DEFAULT_LAYER_CONFIG.colormap,
          ...(preferredColormapReversed != null
            ? { colormap_reversed: preferredColormapReversed }
            : {}),
        },
      })
    : createProseChapter({ order: 0, title: "Chapter 1" });

  return {
    id: uuid(),
    title: "Untitled story",
    dataset_id: datasetId ?? null,
    dataset_ids: datasetId ? [datasetId] : [],
    chapters: [chapter],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published: false,
    ...storyOverrides,
  };
}

/** Type guard: chapter has map_state + layer_config. */
export function isMapBoundChapter(
  ch: Chapter
): ch is ScrollytellingChapter | MapChapter {
  return ch.type === "scrollytelling" || ch.type === "map";
}
