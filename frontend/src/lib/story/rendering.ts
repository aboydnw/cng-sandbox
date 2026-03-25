import { buildRasterTileLayers, buildVectorLayer } from "../layers";
import { DEFAULT_LAYER_CONFIG } from "./types";
import type { Chapter } from "./types";
import type { Dataset } from "../../types";

export type ContentBlock =
  | { type: "scrollytelling"; chapters: Chapter[]; startIndex: number }
  | { type: "prose"; chapter: Chapter; index: number }
  | { type: "map"; chapter: Chapter; index: number };

export function groupChaptersIntoBlocks(chapters: Chapter[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let scrollyGroup: Chapter[] = [];
  let scrollyStartIndex = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (ch.type === "scrollytelling" || !ch.type) {
      if (scrollyGroup.length === 0) scrollyStartIndex = i;
      scrollyGroup.push(ch);
    } else {
      if (scrollyGroup.length > 0) {
        blocks.push({ type: "scrollytelling", chapters: scrollyGroup, startIndex: scrollyStartIndex });
        scrollyGroup = [];
      }
      blocks.push({ type: ch.type, chapter: ch, index: i });
    }
  }
  if (scrollyGroup.length > 0) {
    blocks.push({ type: "scrollytelling", chapters: scrollyGroup, startIndex: scrollyStartIndex });
  }
  return blocks;
}

export function buildLayersForChapter(chapter: Chapter, datasetMap: Map<string, Dataset | null>) {
  const ds = datasetMap.get(chapter.layer_config.dataset_id);
  if (!ds) return [];
  const lc = chapter.layer_config ?? DEFAULT_LAYER_CONFIG;

  if (ds.dataset_type === "raster") {
    const base = ds.tile_url;
    const sep = base.includes("?") ? "&" : "?";
    let tileUrl = `${base}${sep}colormap_name=${lc.colormap}`;
    if (ds.raster_min != null && ds.raster_max != null) {
      tileUrl += `&rescale=${ds.raster_min},${ds.raster_max}`;
    }
    return buildRasterTileLayers({
      tileUrl,
      opacity: lc.opacity,
      isTemporalActive: false,
    });
  }
  return [
    buildVectorLayer({
      tileUrl: ds.tile_url,
      isPMTiles: ds.tile_url.startsWith("/pmtiles/"),
      opacity: lc.opacity,
      minZoom: ds.min_zoom ?? undefined,
      maxZoom: ds.max_zoom ?? undefined,
    }),
  ];
}
