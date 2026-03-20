export interface MapState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  basemap: string;
}

export interface Chapter {
  id: string;
  order: number;
  title: string;
  narrative: string;
  map_state: MapState;
  transition: "fly-to" | "instant";
}

export interface Story {
  id: string;
  title: string;
  description?: string;
  dataset_id: string;
  chapters: Chapter[];
  created_at: string;
  published: boolean;
}

export interface StoryIndexEntry {
  id: string;
  title: string;
  dataset_id: string;
  created_at: string;
}

export const DEFAULT_MAP_STATE: MapState = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
  basemap: "streets",
};

export function createChapter(
  overrides: Partial<Chapter> = {},
): Chapter {
  return {
    id: crypto.randomUUID(),
    order: 0,
    title: "Untitled chapter",
    narrative: "",
    map_state: { ...DEFAULT_MAP_STATE },
    transition: "fly-to",
    ...overrides,
  };
}

export function createStory(
  datasetId: string,
  overrides: Partial<Story> = {},
): Story {
  return {
    id: crypto.randomUUID(),
    title: "Untitled story",
    dataset_id: datasetId,
    chapters: [createChapter({ order: 0, title: "Chapter 1" })],
    created_at: new Date().toISOString(),
    published: false,
    ...overrides,
  };
}
