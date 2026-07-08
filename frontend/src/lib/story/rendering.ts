import type { Layer } from "@deck.gl/core";
import {
  buildRasterPMTilesLayer,
  buildVectorLayer,
  isPMTilesDataset,
} from "../layers";
import { buildZarrLayer } from "../layers/zarrLayer";
import { buildConnectionTileUrl } from "../connections";
import { resolveRasterLayers } from "../layers/resolveRasterLayers";
import { datasetToMapItem, connectionToMapItem } from "../../hooks/useMapData";
import { DEFAULT_LAYER_CONFIG, isMapBoundChapter } from "./types";
import type {
  Chapter,
  LayerConfig,
  ScrollytellingChapter,
  MapChapter,
  ProseChapter,
  ImageChapter,
  VideoChapter,
  ChartChapter,
} from "./types";
import type { Dataset, Connection } from "../../types";
import type { ZarrNode } from "../../hooks/useZarrNode";

function makePcaRgbFillColor(
  colorProperty: string
): (feature: {
  properties: Record<string, unknown> | null;
}) => [number, number, number, number] {
  return (feature) => {
    const val = feature?.properties?.[colorProperty];
    if (Array.isArray(val) && val.length >= 3) {
      return [
        Math.round(Math.max(0, Math.min(1, val[0] as number)) * 255),
        Math.round(Math.max(0, Math.min(1, val[1] as number)) * 255),
        Math.round(Math.max(0, Math.min(1, val[2] as number)) * 255),
        200,
      ];
    }
    return [128, 128, 128, 200];
  };
}

export function buildDatasetServerTileUrl(
  ds: Dataset,
  lc: LayerConfig,
  rescaleMin: number | null,
  rescaleMax: number | null
): string {
  const base = ds.tile_url;
  const sep = base.includes("?") ? "&" : "?";
  let serverTileUrl = base;
  if (ds.band_count === 1) {
    const effColormap = lc.colormap_reversed ? `${lc.colormap}_r` : lc.colormap;
    const effMin = rescaleMin ?? ds.raster_min;
    const effMax = rescaleMax ?? ds.raster_max;
    serverTileUrl = `${base}${sep}colormap_name=${effColormap}`;
    if (effMin != null && effMax != null) {
      serverTileUrl += `&rescale=${effMin},${effMax}`;
    }
  }
  if (ds.is_temporal && ds.timesteps.length > 0) {
    const raw = Number.isInteger(lc.timestep) ? lc.timestep! : 0;
    const tsIndex = Math.max(0, Math.min(raw, ds.timesteps.length - 1));
    const ts = ds.timesteps[tsIndex];
    const tsep = serverTileUrl.includes("?") ? "&" : "?";
    serverTileUrl = `${serverTileUrl}${tsep}datetime=${encodeURIComponent(ts.datetime)}`;
  }
  return serverTileUrl;
}

export type ContentBlock =
  | {
      type: "scrollytelling";
      chapters: ScrollytellingChapter[];
      startIndex: number;
    }
  | { type: "prose"; chapter: ProseChapter; index: number }
  | { type: "map"; chapter: MapChapter; index: number }
  | { type: "image"; chapter: ImageChapter; index: number }
  | { type: "video"; chapter: VideoChapter; index: number }
  | { type: "chart"; chapter: ChartChapter; index: number };

export function groupChaptersIntoBlocks(chapters: Chapter[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let scrollyGroup: ScrollytellingChapter[] = [];
  let scrollyStartIndex = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (ch.type === "scrollytelling") {
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
      switch (ch.type) {
        case "map":
          blocks.push({ type: "map", chapter: ch, index: i });
          break;
        case "prose":
          blocks.push({ type: "prose", chapter: ch, index: i });
          break;
        case "image":
          blocks.push({ type: "image", chapter: ch, index: i });
          break;
        case "video":
          blocks.push({ type: "video", chapter: ch, index: i });
          break;
        case "chart":
          blocks.push({ type: "chart", chapter: ch, index: i });
          break;
        default: {
          const _exhaustive: never = ch;
          void _exhaustive;
        }
      }
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
  connectionMap?: Map<string, Connection>,
  zarrNodeMap?: Map<string, ZarrNode>
): ChapterLayerResult {
  if (!isMapBoundChapter(chapter)) return { layers: [] };
  const lc = chapter.layer_config ?? DEFAULT_LAYER_CONFIG;

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

    if (conn.connection_type === "copc") {
      return {
        layers: [],
        renderMetadata: {
          renderMode: "client",
          reason: "point cloud",
          sizeBytes: null,
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
            ...(lc.color_mode === "rgb" && lc.color_property
              ? { getFillColor: makePcaRgbFillColor(lc.color_property) }
              : {}),
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
            ...(lc.color_mode === "rgb" && lc.color_property
              ? { getFillColor: makePcaRgbFillColor(lc.color_property) }
              : {}),
          }),
        ],
      };
    }

    if (conn.connection_type === "zarr") {
      const node = zarrNodeMap?.get(lc.connection_id);
      if (!node) return { layers: [] };
      const zarrConfig =
        (conn.config as
          | {
              variable?: string;
              timeDim?: string | null;
              timesteps?: Array<{ index: number }> | null;
              extraDim?: string | null;
              extraIndex?: number | null;
              rescaleMin?: number | null;
              rescaleMax?: number | null;
            }
          | null
          | undefined) ?? {};
      const variable = zarrConfig.variable;
      if (!variable) return { layers: [] };
      const timeDim = zarrConfig.timeDim ?? null;
      const selection: Record<string, number> = {};
      if (timeDim) {
        const tsIdx = lc.timestep ?? 0;
        const slot = zarrConfig.timesteps?.[tsIdx];
        selection[timeDim] = slot?.index ?? tsIdx;
      }
      if (zarrConfig.extraDim != null && zarrConfig.extraIndex != null) {
        selection[zarrConfig.extraDim] = zarrConfig.extraIndex;
      }
      const isArrayNode = "shape" in node;
      return {
        layers: buildZarrLayer({
          node,
          variable: isArrayNode ? undefined : variable,
          selection,
          opacity: lc.opacity,
          rescaleMin:
            lc.rescale_min ??
            (typeof zarrConfig.rescaleMin === "number"
              ? zarrConfig.rescaleMin
              : null) ??
            0,
          rescaleMax:
            lc.rescale_max ??
            (typeof zarrConfig.rescaleMax === "number"
              ? zarrConfig.rescaleMax
              : null) ??
            1,
          colormapName: lc.colormap,
          colormapReversed: lc.colormap_reversed ?? false,
          id: `zarr-story-${lc.connection_id}`,
          geozarrAttrs: conn.geozarr_attrs ?? undefined,
        }),
      };
    }

    const item = connectionToMapItem(conn);
    const resolved = resolveRasterLayers({
      item,
      opacity: lc.opacity,
      rescaleMin: null,
      rescaleMax: null,
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

  const ds = datasetMap.get(lc.dataset_id);
  if (!ds) return { layers: [] };

  if (ds.dataset_type === "pointcloud") {
    return {
      layers: [],
      renderMetadata: {
        renderMode: "client",
        reason: "point cloud",
        sizeBytes: null,
      },
    };
  }

  if (ds.dataset_type === "raster") {
    const item = datasetToMapItem(ds);
    const rescaleMin = lc.rescale_min ?? null;
    const rescaleMax = lc.rescale_max ?? null;

    const serverTileUrl = buildDatasetServerTileUrl(
      ds,
      lc,
      rescaleMin,
      rescaleMax
    );

    const resolved = resolveRasterLayers({
      item,
      opacity: lc.opacity,
      rescaleMin,
      rescaleMax,
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
        isPMTiles: isPMTilesDataset(ds),
        opacity: lc.opacity,
        minZoom: ds.min_zoom ?? undefined,
        maxZoom: ds.max_zoom ?? undefined,
        ...(lc.color_mode === "rgb" && lc.color_property
          ? { getFillColor: makePcaRgbFillColor(lc.color_property) }
          : {}),
      }),
    ],
  };
}
