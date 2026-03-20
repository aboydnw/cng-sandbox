import { createCOGLayer } from "../maptool";
import type { Timestep } from "../../types";

interface RasterTileLayerOptions {
  tileUrl: string;
  opacity: number;
  isTemporalActive: boolean;
  timesteps?: Timestep[];
  activeTimestepIndex?: number;
  onViewportLoad?: (index: number) => () => void;
}

export function buildRasterTileLayers({
  tileUrl,
  opacity,
  isTemporalActive,
  timesteps = [],
  activeTimestepIndex = 0,
  onViewportLoad,
}: RasterTileLayerOptions) {
  if (!isTemporalActive) {
    return [
      createCOGLayer({
        id: "raster-tile-0",
        tileUrl,
        opacity,
      }),
    ];
  }

  return timesteps.map((ts, i) =>
    createCOGLayer({
      id: `raster-ts-${i}`,
      tileUrl: `${tileUrl}&datetime=${ts.datetime}`,
      opacity: i === activeTimestepIndex ? opacity : 0,
      onViewportLoad: onViewportLoad?.(i),
    }),
  );
}
