import { useMemo } from "react";
import type { MutableRefObject } from "react";
import type { MapItem } from "../types";
import type { RenderMode } from "./useMapControls";
import type { TileCacheEntry } from "../lib/layers";
import type { Table } from "apache-arrow";
import {
  buildRasterTileLayers,
  buildRasterPMTilesLayer,
  buildCogLayerContinuous,
  buildCogLayerPaletted,
  buildVectorLayer,
  buildGeoJsonLayer,
  arrowTableToGeoJSON,
  isPMTilesDataset,
} from "../lib/layers";
import { classifyCogRenderPath } from "../lib/layers/cogDtype";
import { parseRescaleString } from "../lib/connections";

interface UseLayerBuilderOptions {
  item: MapItem | null;
  renderMode: RenderMode;
  canClientRender: boolean;
  opacity: number;
  colormapName: string;
  effectiveBand: "rgb" | number;
  isSingleBand: boolean;
  isMultiBand: boolean;
  isCategorical: boolean;
  activeTimestepIndex: number;
  renderIndices?: Set<number>;
  isAnimateMode?: boolean;
  getLoadCallback: (index: number) => () => void;
  tileCacheRef: MutableRefObject<Map<string, TileCacheEntry>>;
  arrowTable: Table | null;
  rescaleMin: number | null;
  rescaleMax: number | null;
  colormapReversed: boolean;
  effectiveCategories?:
    | { value: number; color: string; label: string }[]
    | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onVectorClick?: (info: any) => void;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function buildCategoricalColormap(
  categories: { value: number; color: string }[]
): string {
  const map: Record<string, number[]> = {};
  for (const cat of categories) {
    map[String(cat.value)] = hexToRgb(cat.color);
  }
  return JSON.stringify(map);
}

export function useLayerBuilder({
  item,
  renderMode,
  canClientRender,
  opacity,
  colormapName,
  effectiveBand,
  isSingleBand,
  isMultiBand,
  isCategorical,
  activeTimestepIndex,
  renderIndices,
  isAnimateMode,
  getLoadCallback,
  tileCacheRef,
  arrowTable,
  rescaleMin,
  rescaleMax,
  colormapReversed,
  effectiveCategories = null,
  onVectorClick,
}: UseLayerBuilderOptions) {
  const tileUrl = useMemo(() => {
    if (!item) return "";

    const effMin = rescaleMin ?? item.rasterMin;
    const effMax = rescaleMax ?? item.rasterMax;
    const effColormap = colormapReversed ? `${colormapName}_r` : colormapName;

    if (item.source === "connection") {
      const base = item.tileUrl;
      if (
        item.dataType === "raster" &&
        item.connection?.connection_type === "cog"
      ) {
        if (isCategorical && item.categories && item.categories.length > 0) {
          const colormapJson = buildCategoricalColormap(item.categories);
          const sep = base.includes("?") ? "&" : "?";
          return `${base}${sep}colormap=${encodeURIComponent(colormapJson)}&resampling=nearest`;
        }
        const isSingleBandCOG = item.bandCount === 1;
        if (isSingleBandCOG) {
          let url = `${base}&colormap_name=${effColormap}`;
          if (effMin != null && effMax != null) {
            url += `&rescale=${effMin},${effMax}`;
          } else if (item.rescale) {
            url += `&rescale=${item.rescale}`;
          }
          return url;
        }
      }
      return base;
    }

    const base = item.tileUrl;
    if (!base) return "";
    const separator = base.includes("?") ? "&" : "?";

    // Categorical rasters: discrete colormap + nearest resampling
    if (isCategorical && item.categories && item.categories.length > 0) {
      const colormapJson = buildCategoricalColormap(item.categories);
      return `${base}${separator}colormap=${encodeURIComponent(colormapJson)}&resampling=nearest`;
    }

    if (isSingleBand) {
      let url = `${base}${separator}colormap_name=${effColormap}`;
      if (effMin != null && effMax != null) {
        url += `&rescale=${effMin},${effMax}`;
      }
      return url;
    }

    if (isMultiBand && typeof effectiveBand === "number") {
      let url = `${base}${separator}bidx=${effectiveBand + 1}&colormap_name=${effColormap}`;
      if (effMin != null && effMax != null) {
        url += `&rescale=${effMin},${effMax}`;
      }
      return url;
    }

    return base;
  }, [
    item,
    colormapName,
    colormapReversed,
    rescaleMin,
    rescaleMax,
    isSingleBand,
    isMultiBand,
    effectiveBand,
    isCategorical,
  ]);

  const geojson = useMemo(
    () => (arrowTable ? arrowTableToGeoJSON(arrowTable) : null),
    [arrowTable]
  );

  const layers = useMemo(() => {
    if (!item) return [];

    if (item.source === "connection" && item.connection) {
      const connType = item.connection.connection_type;

      if (connType === "cog") {
        if (
          renderMode === "client" &&
          canClientRender &&
          item.cogUrl &&
          item.bounds
        ) {
          if (isCategorical) {
            return buildCogLayerPaletted({
              cogUrl: item.cogUrl,
              opacity,
              categories: effectiveCategories ?? item.categories ?? undefined,
              tileCacheRef,
              datasetBounds: item.bounds,
            });
          }
          const parsed = parseRescaleString(item.rescale);
          return buildCogLayerContinuous({
            cogUrl: item.cogUrl,
            opacity,
            rasterMin: parsed?.min ?? item.rasterMin ?? 0,
            rasterMax: parsed?.max ?? item.rasterMax ?? 1,
            datasetBounds: item.bounds,
            tileCacheRef,
          });
        }
        return buildRasterTileLayers({
          tileUrl,
          opacity,
          isTemporalActive: false,
        });
      }

      if (connType === "pmtiles") {
        if (item.dataType === "vector") {
          return [
            buildVectorLayer({
              tileUrl,
              isPMTiles: true,
              opacity,
              minZoom: item.minZoom ?? undefined,
              maxZoom: item.maxZoom ?? undefined,
            }),
          ];
        }
        return [
          buildRasterPMTilesLayer({
            tileUrl,
            opacity,
            minZoom: item.minZoom ?? undefined,
            maxZoom: item.maxZoom ?? undefined,
          }),
        ];
      }

      if (connType === "xyz_raster") {
        return buildRasterTileLayers({
          tileUrl,
          opacity,
          isTemporalActive: false,
        });
      }

      if (connType === "xyz_vector") {
        return [
          buildVectorLayer({
            tileUrl,
            isPMTiles: false,
            opacity,
            minZoom: item.minZoom ?? undefined,
            maxZoom: item.maxZoom ?? undefined,
          }),
        ];
      }

      if (connType === "geoparquet") {
        const renderPath = item.connection.render_path;
        if (renderPath === "server") {
          if (
            item.connection.conversion_status !== "ready" ||
            !item.connection.tile_url
          ) {
            return [];
          }
          return [
            buildVectorLayer({
              tileUrl,
              isPMTiles: true,
              opacity,
              minZoom: item.minZoom ?? undefined,
              maxZoom: item.maxZoom ?? undefined,
            }),
          ];
        }
        return buildGeoJsonLayer({ geojson });
      }

      return [];
    }

    const ds = item.dataset;
    if (!ds) return [];

    if (item.dataType === "raster") {
      if (renderMode === "client" && canClientRender) {
        const renderPath = classifyCogRenderPath({
          dtype: item.dtype,
          isCategorical,
        });
        if (renderPath === "paletted") {
          return buildCogLayerPaletted({
            cogUrl: item.cogUrl!,
            opacity,
            categories: isCategorical
              ? (effectiveCategories ?? item.categories ?? undefined)
              : undefined,
            tileCacheRef,
            datasetBounds: item.bounds,
          });
        }
        return buildCogLayerContinuous({
          cogUrl: item.cogUrl!,
          opacity,
          rasterMin: item.rasterMin ?? 0,
          rasterMax: item.rasterMax ?? 1,
          datasetBounds: item.bounds,
          tileCacheRef,
        });
      }
      return buildRasterTileLayers({
        id: `raster-layer-${colormapName}${colormapReversed ? "-r" : ""}-${effectiveBand}-${rescaleMin ?? "d"}-${rescaleMax ?? "d"}`,
        tileUrl,
        opacity,
        isTemporalActive: ds.is_temporal,
        isAnimateMode,
        timesteps: ds.timesteps,
        activeTimestepIndex,
        renderIndices,
        getLoadCallback,
      });
    }

    if (renderMode === "geojson" && geojson) {
      return buildGeoJsonLayer({ geojson });
    }

    return [
      buildVectorLayer({
        tileUrl: ds.tile_url,
        isPMTiles: isPMTilesDataset(ds),
        opacity,
        minZoom: ds.min_zoom ?? undefined,
        maxZoom: ds.max_zoom ?? undefined,
        onClick: onVectorClick,
      }),
    ];
  }, [
    item,
    renderMode,
    canClientRender,
    tileUrl,
    opacity,
    colormapName,
    colormapReversed,
    rescaleMin,
    rescaleMax,
    effectiveBand,
    activeTimestepIndex,
    isAnimateMode,
    renderIndices,
    geojson,
    onVectorClick,
    getLoadCallback,
    tileCacheRef,
    isCategorical,
    effectiveCategories,
  ]);

  return { layers, tileUrl, geojson };
}
