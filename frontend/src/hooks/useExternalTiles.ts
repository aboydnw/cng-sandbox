import { useMemo } from "react";
import { config } from "../config";

interface CogTileOptions {
  assetUrl: string;
  colormap?: string;
  bands?: string[];
  rescale?: [number, number];
}

export function buildCogTileUrl(options: CogTileOptions): string {
  const { assetUrl, colormap, bands, rescale } = options;
  const base = `${config.cogTilerUrl}/tiles/WebMercatorQuad/{z}/{x}/{y}`;
  const params = new URLSearchParams();
  params.set("url", assetUrl);

  if (colormap && (!bands || bands.length <= 1)) {
    params.set("colormap_name", colormap);
  }
  if (rescale) {
    params.set("rescale", `${rescale[0]},${rescale[1]}`);
  }

  return `${base}?${params.toString()}`;
}

export function useExternalTiles(options: CogTileOptions | null) {
  return useMemo(() => {
    if (!options) return null;
    return buildCogTileUrl(options);
  }, [options?.assetUrl, options?.colormap, options?.bands?.join(","), options?.rescale?.join(",")]);
}
