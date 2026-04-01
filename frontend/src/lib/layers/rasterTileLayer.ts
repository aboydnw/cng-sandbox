import { createCOGLayer } from "../maptool";
import type { Timestep } from "../../types";

interface RasterTileLayerOptions {
  id?: string;
  tileUrl: string;
  opacity: number;
  isTemporalActive: boolean;
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
