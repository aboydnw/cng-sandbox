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
  connection_id?: string;  // new — one or the other is set
  colormap: string;
  opacity: number;
  basemap: string;
  band?: number;
  timestep?: number;
}

export type ChapterType = "scrollytelling" | "prose" | "map";

export interface Chapter {
  id: string;
  order: number;
  type: ChapterType;
  title: string;
  narrative: string;
  map_state: MapState;
  transition: "fly-to" | "instant";
  layer_config: LayerConfig;
}

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

export function createChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: uuid(),
    order: 0,
    type: "scrollytelling",
    title: "Untitled chapter",
    narrative: "",
    map_state: { ...DEFAULT_MAP_STATE },
    transition: "fly-to",
    layer_config: { ...DEFAULT_LAYER_CONFIG },
    ...overrides,
  };
}

export function createStory(
  datasetId?: string | null,
  overrides: Partial<Story> = {}
): Story {
  const chapter = datasetId
    ? createChapter({
        order: 0,
        title: "Chapter 1",
        layer_config: { ...DEFAULT_LAYER_CONFIG, dataset_id: datasetId },
      })
    : createChapter({
        order: 0,
        title: "Chapter 1",
        type: "prose",
        narrative: "",
      });

  return {
    id: uuid(),
    title: "Untitled story",
    dataset_id: datasetId ?? null,
    dataset_ids: datasetId ? [datasetId] : [],
    chapters: [chapter],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published: false,
    ...overrides,
  };
}
