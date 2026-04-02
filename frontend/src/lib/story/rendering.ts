import { buildRasterTileLayers, buildVectorLayer } from "../layers";
import { buildConnectionTileUrl } from "../connections";
import { DEFAULT_LAYER_CONFIG } from "./types";
import type { Chapter } from "./types";
import type { Dataset, Connection } from "../../types";

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
        blocks.push({
          type: "scrollytelling",
          chapters: scrollyGroup,
          startIndex: scrollyStartIndex,
        });
        scrollyGroup = [];
      }
      blocks.push({ type: ch.type, chapter: ch, index: i });
    }
  }
  if (scrollyGroup.length > 0) {
    blocks.push({
      type: "scrollytelling",
      chapters: scrollyGroup,
      startIndex: scrollyStartIndex,
    });
  }
  return blocks;
}

export function buildLayersForChapter(
  chapter: Chapter,
  datasetMap: Map<string, Dataset | null>,
  connectionMap?: Map<string, Connection>
) {
  const lc = chapter.layer_config ?? DEFAULT_LAYER_CONFIG;

  // Check for connection first
  if (lc.connection_id && connectionMap) {
    const conn = connectionMap.get(lc.connection_id);
    if (!conn) return [];
    const tileUrl = buildConnectionTileUrl(conn);

    // COG connections: only apply colormap + rescale for single-band
    if (conn.connection_type === "cog") {
      let finalTileUrl = tileUrl;
      if (conn.band_count === 1) {
        const sep = finalTileUrl.includes("?") ? "&" : "?";
        finalTileUrl += `${sep}colormap_name=${lc.colormap}`;
        if (conn.rescale) {
          finalTileUrl += `&rescale=${conn.rescale}`;
        }
      }
      return buildRasterTileLayers({
        tileUrl: finalTileUrl,
        opacity: lc.opacity,
        isTemporalActive: false,
      });
    }

    // PMTiles vector
    if (conn.connection_type === "pmtiles" && conn.tile_type === "vector") {
      return [
        buildVectorLayer({
          tileUrl,
          isPMTiles: true,
          opacity: lc.opacity,
          minZoom: conn.min_zoom ?? undefined,
          maxZoom: conn.max_zoom ?? undefined,
        }),
      ];
    }

    // XYZ vector
    if (conn.connection_type === "xyz_vector") {
      return [
        buildVectorLayer({
          tileUrl,
          isPMTiles: false,
          opacity: lc.opacity,
          minZoom: conn.min_zoom ?? undefined,
          maxZoom: conn.max_zoom ?? undefined,
        }),
      ];
    }

    // Everything else: raster tiles
    return buildRasterTileLayers({
      tileUrl,
      opacity: lc.opacity,
      isTemporalActive: false,
    });
  }

  // Existing dataset path (keep unchanged)
  const ds = datasetMap.get(lc.dataset_id);
  if (!ds) return [];

  if (ds.dataset_type === "raster") {
    const base = ds.tile_url;
    const sep = base.includes("?") ? "&" : "?";
    let tileUrl = `${base}${sep}colormap_name=${lc.colormap}`;
    if (ds.raster_min != null && ds.raster_max != null) {
      tileUrl += `&rescale=${ds.raster_min},${ds.raster_max}`;
    }
    if (ds.is_temporal && ds.timesteps.length > 0) {
      const tsIndex = lc.timestep ?? 0;
      const ts = ds.timesteps[Math.min(tsIndex, ds.timesteps.length - 1)];
      tileUrl = `${tileUrl}&datetime=${ts.datetime}`;
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
