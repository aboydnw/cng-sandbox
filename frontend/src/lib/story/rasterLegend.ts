import type { LegendLayerConfig } from "../maptool/MapLegend/types";

export function buildRasterLegend(args: {
  bandCount: number | null;
  title: string;
  domain: [number, number];
  colors: string[];
  isCategorical: boolean;
}): LegendLayerConfig | null {
  if (args.isCategorical) return null;
  if (args.bandCount === 3) {
    return { type: "rgb", id: "raster", title: args.title };
  }
  return {
    type: "continuous",
    id: "raster",
    title: args.title,
    domain: args.domain,
    colors: args.colors,
  };
}
