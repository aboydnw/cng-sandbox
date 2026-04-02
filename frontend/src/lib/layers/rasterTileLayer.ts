import { createCOGLayer } from "../maptool";
import type { Timestep } from "../../types";

interface RasterTileLayerOptions {
  id?: string;
  tileUrl: string;
  opacity: number;
  isTemporalActive: boolean;
  isAnimateMode?: boolean;
  timesteps?: Timestep[];
  activeTimestepIndex?: number;
  renderIndices?: Set<number>;
  getLoadCallback?: (index: number) => () => void;
}

export function buildRasterTileLayers({
  id = "raster-tile-0",
  tileUrl,
  opacity,
  isTemporalActive,
  isAnimateMode,
  timesteps = [],
  activeTimestepIndex = 0,
  renderIndices,
  getLoadCallback,
}: RasterTileLayerOptions) {
  if (!isTemporalActive) {
    return [
      createCOGLayer({
        id,
        tileUrl,
        opacity,
      }),
    ];
  }

  if (!isAnimateMode && timesteps.length > 0) {
    const ts = timesteps[activeTimestepIndex];
    const separator = tileUrl.includes("?") ? "&" : "?";
    return [
      createCOGLayer({
        id,
        tileUrl: `${tileUrl}${separator}datetime=${ts.datetime}`,
        opacity,
      }),
    ];
  }

  return timesteps
    .map((ts, i) => {
      if (renderIndices && !renderIndices.has(i)) return null;
      return createCOGLayer({
        id: `raster-ts-${i}`,
        tileUrl: `${tileUrl}&datetime=${ts.datetime}`,
        opacity: i === activeTimestepIndex ? opacity : 0,
        onViewportLoad: getLoadCallback?.(i),
      });
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
}
