// Mirrors ingestion/src/models/cng_rc.py — keep in sync.
export interface CngRcConfig {
  version: "1";
  origin: {
    story_id: string;
    workspace_id: string | null;
    exported_at: string;
  };
  metadata: {
    title: string;
    description: string | null;
    author: string | null;
    created: string;
    updated: string;
  };
  chapters: CngRcChapter[];
  layers: Record<string, CngRcLayer>;
  assets: Record<string, CngRcAsset>;
}

export interface CngRcChapter {
  id: string;
  type: "prose" | "map" | "scrollytelling" | "image" | "video" | "chart";
  title: string | null;
  body: string | null;
  map: {
    center: [number, number];
    zoom: number;
    bearing?: number;
    pitch?: number;
  } | null;
  layers: string[];
  extra?: Record<string, unknown> | null;
}

export interface CngRcLayer {
  type: "raster-cog" | "vector-geoparquet" | "pmtiles" | "xyz";
  source_url: string | null;
  cng_url: string | null;
  label: string | null;
  attribution: string | null;
  render: {
    colormap: string | null;
    rescale: [number, number] | null;
    opacity: number;
    band: number | null;
    timestep: string | null;
  };
}

export interface CngRcAsset {
  kind: "image" | "video" | "video-thumbnail";
  url: string;
  mime: string | null;
}
