import { useMemo } from "react";
import type { MutableRefObject } from "react";
import type { MapItem } from "../types";
import type { RenderMode } from "./useMapControls";
import type { TileCacheEntry } from "../lib/layers";
import type { Table } from "apache-arrow";
import {
  buildRasterTileLayers,
  buildCogLayer,
  buildVectorLayer,
  buildGeoJsonLayer,
  arrowTableToGeoJSON,
} from "../lib/layers";

interface UseLayerBuilderOptions {
  item: MapItem | null;
  renderMode: RenderMode;
  canClientRender: boolean;
  opacity: number;
  colormapName: string;
  effectiveBand: "rgb" | number;
  isSingleBand: boolean;
  isMultiBand: boolean;
  activeTimestepIndex: number;
  renderIndices?: Set<number>;
  getLoadCallback: (index: number) => () => void;
  tileCacheRef: MutableRefObject<Map<string, TileCacheEntry>>;
  arrowTable: Table | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onVectorClick?: (info: any) => void;
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
  activeTimestepIndex,
  renderIndices,
  getLoadCallback,
  tileCacheRef,
  arrowTable,
  onVectorClick,
}: UseLayerBuilderOptions) {
  const tileUrl = useMemo(() => {
    if (!item) return "";

    if (item.source === "connection") {
      const base = item.tileUrl;
      if (
        item.dataType === "raster" &&
        item.connection?.connection_type === "cog"
      ) {
        const isSingleBandCOG = item.bandCount === 1;
        if (isSingleBandCOG) {
          let url = `${base}&colormap_name=${colormapName}`;
          if (item.rescale) url += `&rescale=${item.rescale}`;
          return url;
        }
      }
      return base;
    }

    const base = item.tileUrl;
    if (!base) return "";
    const separator = base.includes("?") ? "&" : "?";

    if (isSingleBand) {
      let url = `${base}${separator}colormap_name=${colormapName}`;
      if (item.rasterMin != null && item.rasterMax != null) {
        url += `&rescale=${item.rasterMin},${item.rasterMax}`;
      }
      return url;
    }

    if (isMultiBand && typeof effectiveBand === "number") {
      let url = `${base}${separator}bidx=${effectiveBand + 1}&colormap_name=${colormapName}`;
      if (item.rasterMin != null && item.rasterMax != null) {
        url += `&rescale=${item.rasterMin},${item.rasterMax}`;
      }
      return url;
    }

    return base;
  }, [item, colormapName, isSingleBand, isMultiBand, effectiveBand]);

  const geojson = useMemo(
    () => (arrowTable ? arrowTableToGeoJSON(arrowTable) : null),
    [arrowTable]
  );

  const layers = useMemo(() => {
    if (!item) return [];

    if (item.source === "connection" && item.connection) {
      const connType = item.connection.connection_type;

      if (connType === "cog") {
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
        return buildRasterTileLayers({
          tileUrl,
          opacity,
          isTemporalActive: false,
        });
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

      return [];
    }

    const ds = item.dataset;
    if (!ds) return [];

    if (item.dataType === "raster") {
      if (renderMode === "client" && canClientRender) {
        return buildCogLayer({
          cogUrl: item.cogUrl!,
          opacity,
          rasterMin: item.rasterMin ?? 0,
          rasterMax: item.rasterMax ?? 1,
          datasetBounds: item.bounds,
          tileCacheRef,
        });
      }
      return buildRasterTileLayers({
        id: `raster-layer-${colormapName}-${effectiveBand}`,
        tileUrl,
        opacity,
        isTemporalActive: ds.is_temporal,
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
        isPMTiles: ds.tile_url.startsWith("/pmtiles/"),
        opacity: 1,
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
    effectiveBand,
    activeTimestepIndex,
    renderIndices,
    geojson,
    onVectorClick,
    getLoadCallback,
    tileCacheRef,
  ]);

  return { layers, tileUrl, geojson };
}
