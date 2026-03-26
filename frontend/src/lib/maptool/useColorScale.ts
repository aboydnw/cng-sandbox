import { useMemo } from "react";
import { getColormap } from "./colormaps";

export interface UseColorScaleOptions {
  domain: [number, number];
  colormap?: string;
  steps?: number;
}

export interface UseColorScaleReturn {
  colors: string[];
  values: number[];
}

export function useColorScale({
  domain,
  colormap = "viridis",
  steps = 8,
}: UseColorScaleOptions): UseColorScaleReturn {
  return useMemo(() => {
    const palette = getColormap(colormap);
    const colors = Array.from({ length: steps }, (_, i) => {
      const t = steps <= 1 ? 0 : i / (steps - 1);
      const idx = Math.round(t * (palette.length - 1));
      return palette[idx];
    });
    const values = Array.from({ length: steps }, (_, i) => {
      const t = steps <= 1 ? 0 : i / (steps - 1);
      return domain[0] + (domain[1] - domain[0]) * t;
    });
    return { colors, values };
  }, [domain, colormap, steps]);
}
