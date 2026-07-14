export interface ManifestStory {
  id: string;
  title: string;
  description: string;
}

export interface ManifestCameraView {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface RasterLayer {
  id: string;
  kind: "raster";
  src: string;
  colormap: string;
  rescale_min?: number | null;
  rescale_max?: number | null;
  opacity?: number;
  colormap_reversed?: boolean;
  band?: number | null;
  timestep?: string | number | null;
  /** Legacy fallback when only Plan 1 manifest fields are present. */
  rescale?: [number, number];
}

export interface VectorLayer {
  id: string;
  kind: "vector";
  src: string;
  geom: "point" | "line" | "polygon";
  style: Record<string, unknown>;
  opacity?: number;
}

export interface TripsLayerEntry {
  id: string;
  kind: "trips";
  src: string;
  opacity?: number;
  trail_length?: number;
}

export type MapLayer = RasterLayer | VectorLayer | TripsLayerEntry;

export interface LegendStop {
  value?: number | string;
  color: [number, number, number, number?] | string;
  label?: string;
}

export interface Legend {
  title?: string;
  kind: "categorical" | "continuous";
  stops: LegendStop[];
}

export interface BaseChapter {
  id: string;
  type: "map" | "chart" | "scrollytelling" | "prose" | "image" | "video";
  title: string;
  narrative: string;
}

export interface MapChapterEntry extends BaseChapter {
  type: "map";
  camera: ManifestCameraView;
  basemap: string;
  layers: MapLayer[];
  legend?: Legend | null;
}

export interface ChartChapterEntry extends BaseChapter {
  type: "chart";
  chart_src: string;
}

export interface ScrollyChapterEntry extends BaseChapter {
  type: "scrollytelling";
  snapshot_src: string;
}

export interface ProseChapterEntry extends BaseChapter {
  type: "prose";
}

export interface ImageChapterEntry extends BaseChapter {
  type: "image";
  image_url: string;
  alt: string;
}

export interface VideoChapterEntry extends BaseChapter {
  type: "video";
  video: { provider?: string; video_id?: string; original_url?: string };
}

export type ChapterEntry =
  | MapChapterEntry
  | ChartChapterEntry
  | ScrollyChapterEntry
  | ProseChapterEntry
  | ImageChapterEntry
  | VideoChapterEntry;

export interface Manifest {
  story: ManifestStory;
  exported_at: string;
  runtime_version: string;
  chapters: ChapterEntry[];
}
