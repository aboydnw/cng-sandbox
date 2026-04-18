import type { MutableRefObject } from "react";
import type { Layer } from "@deck.gl/core";
import { buildRasterPMTilesLayer, buildVectorLayer } from "../layers";
import type { TileCacheEntry } from "../layers";
import { buildConnectionTileUrl } from "../connections";
import { resolveRasterLayers } from "../layers/resolveRasterLayers";
import { datasetToMapItem, connectionToMapItem } from "../../hooks/useMapData";
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

export interface ChapterRenderMetadata {
  renderMode: "client" | "server";
  reason: string;
  sizeBytes: number | null;
}

export interface ChapterLayerResult {
  layers: Layer[];
  renderMetadata?: ChapterRenderMetadata;
}

export function buildLayersForChapter(
  chapter: Chapter,
  datasetMap: Map<string, Dataset | null>,
  connectionMap: Map<string, Connection> | undefined,
  tileCacheRef: MutableRefObject<Map<string, TileCacheEntry>>
): ChapterLayerResult {
  const lc = chapter.layer_config ?? DEFAULT_LAYER_CONFIG;

  // Connection path
  if (lc.connection_id && connectionMap) {
    const conn = connectionMap.get(lc.connection_id);
    if (!conn) return { layers: [] };

    if (conn.connection_type === "cog") {
      const item = connectionToMapItem(conn);
      const rescaleMin = lc.rescale_min ?? null;
      const rescaleMax = lc.rescale_max ?? null;
      let serverTileUrl = buildConnectionTileUrl(conn);
      if (conn.band_count === 1) {
        const effColormap = lc.colormap_reversed
          ? `${lc.colormap}_r`
          : lc.colormap;
        const sep = serverTileUrl.includes("?") ? "&" : "?";
        serverTileUrl += `${sep}colormap_name=${effColormap}`;
        if (rescaleMin != null && rescaleMax != null) {
          serverTileUrl += `&rescale=${rescaleMin},${rescaleMax}`;
        } else if (conn.rescale) {
          serverTileUrl += `&rescale=${conn.rescale}`;
        }
      }
      const resolved = resolveRasterLayers({
        item,
        opacity: lc.opacity,
        rescaleMin,
        rescaleMax,
        tileCacheRef,
        serverTileUrl,
        effectiveCategories: conn.categories ?? undefined,
      });
      return {
        layers: resolved.layers,
        renderMetadata: {
          renderMode: resolved.renderMode,
          reason: resolved.reason,
          sizeBytes: resolved.sizeBytes,
        },
      };
    }

    const tileUrl = buildConnectionTileUrl(conn);

    if (conn.connection_type === "pmtiles" && conn.tile_type === "vector") {
      return {
        layers: [
          buildVectorLayer({
            tileUrl,
            isPMTiles: true,
            opacity: lc.opacity,
            minZoom: conn.min_zoom ?? undefined,
            maxZoom: conn.max_zoom ?? undefined,
          }),
        ],
      };
    }

    if (conn.connection_type === "pmtiles" && conn.tile_type === "raster") {
      return {
        layers: [
          buildRasterPMTilesLayer({
            tileUrl,
            opacity: lc.opacity,
            minZoom: conn.min_zoom ?? undefined,
            maxZoom: conn.max_zoom ?? undefined,
          }),
        ],
      };
    }

    if (conn.connection_type === "xyz_vector") {
      return {
        layers: [
          buildVectorLayer({
            tileUrl,
            isPMTiles: false,
            opacity: lc.opacity,
            minZoom: conn.min_zoom ?? undefined,
            maxZoom: conn.max_zoom ?? undefined,
          }),
        ],
      };
    }

    // Fallback raster (xyz_raster, etc.)
    const item = connectionToMapItem(conn);
    const resolved = resolveRasterLayers({
      item,
      opacity: lc.opacity,
      rescaleMin: null,
      rescaleMax: null,
      tileCacheRef,
      serverTileUrl: tileUrl,
    });
    return {
      layers: resolved.layers,
      renderMetadata: {
        renderMode: resolved.renderMode,
        reason: resolved.reason,
        sizeBytes: resolved.sizeBytes,
      },
    };
  }

  // Dataset path
  const ds = datasetMap.get(lc.dataset_id);
  if (!ds) return { layers: [] };

  if (ds.dataset_type === "raster") {
    const item = datasetToMapItem(ds);
    const rescaleMin = lc.rescale_min ?? null;
    const rescaleMax = lc.rescale_max ?? null;

    const base = ds.tile_url;
    const sep = base.includes("?") ? "&" : "?";
    const effColormap = lc.colormap_reversed ? `${lc.colormap}_r` : lc.colormap;
    const effMin = rescaleMin ?? ds.raster_min;
    const effMax = rescaleMax ?? ds.raster_max;
    let serverTileUrl = `${base}${sep}colormap_name=${effColormap}`;
    if (effMin != null && effMax != null) {
      serverTileUrl += `&rescale=${effMin},${effMax}`;
    }
    if (ds.is_temporal && ds.timesteps.length > 0) {
      const raw = Number.isInteger(lc.timestep) ? lc.timestep! : 0;
      const tsIndex = Math.max(0, Math.min(raw, ds.timesteps.length - 1));
      const ts = ds.timesteps[tsIndex];
      serverTileUrl = `${serverTileUrl}&datetime=${encodeURIComponent(ts.datetime)}`;
    }

    const resolved = resolveRasterLayers({
      item,
      opacity: lc.opacity,
      rescaleMin,
      rescaleMax,
      tileCacheRef,
      serverTileUrl,
      effectiveCategories: ds.categories ?? undefined,
    });
    return {
      layers: resolved.layers,
      renderMetadata: {
        renderMode: resolved.renderMode,
        reason: resolved.reason,
        sizeBytes: resolved.sizeBytes,
      },
    };
  }

  return {
    layers: [
      buildVectorLayer({
        tileUrl: ds.tile_url,
        isPMTiles: ds.tile_url.startsWith("/pmtiles/"),
        opacity: lc.opacity,
        minZoom: ds.min_zoom ?? undefined,
        maxZoom: ds.max_zoom ?? undefined,
      }),
    ],
  };
}
