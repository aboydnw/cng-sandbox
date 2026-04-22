import { MVTLayer } from "@deck.gl/geo-layers";
import { PMTiles } from "pmtiles";
import { load } from "@loaders.gl/core";
import { MVTLoader } from "@loaders.gl/mvt";
import { BRAND_COLOR_RGBA } from "../../components/MapShell";

const FILL_COLOR: [number, number, number, number] = [
  BRAND_COLOR_RGBA[0],
  BRAND_COLOR_RGBA[1],
  BRAND_COLOR_RGBA[2],
  77,
];
const LINE_COLOR: [number, number, number, number] = [
  BRAND_COLOR_RGBA[0],
  BRAND_COLOR_RGBA[1],
  BRAND_COLOR_RGBA[2],
  255,
];

/* eslint-disable @typescript-eslint/no-explicit-any */
interface VectorLayerOptions {
  id?: string;
  tileUrl: string;
  isPMTiles: boolean;
  opacity: number;
  minZoom?: number;
  maxZoom?: number;
  onHover?: (info: any) => void;
  onClick?: (info: any) => void;
}

export function buildVectorLayer({
  id = "vector-mvt",
  tileUrl,
  isPMTiles,
  opacity,
  minZoom,
  maxZoom,
  onHover,
  onClick,
}: VectorLayerOptions) {
  const baseConfig = {
    id,
    opacity,
    ...(minZoom !== undefined && { minZoom }),
    ...(maxZoom !== undefined && { maxZoom }),
    // MVTLayer's default loader is `MVTWorkerLoader` (worker-only, no
    // main-thread parser). loaders.gl's worker fetches its script from
    // unpkg.com which our CSP `script-src` blocks, so we disable the
    // worker — but then the worker loader has no parser. Override with
    // the full `MVTLoader` which bundles `parseSync`.
    loaders: [MVTLoader],
    loadOptions: { worker: false },
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 60] as [number, number, number, number],
    getFillColor: FILL_COLOR,
    getLineColor: LINE_COLOR,
    getLineWidth: 1.5,
    lineWidthMinPixels: 1,
    getPointRadius: 4,
    pointRadiusMinPixels: 3,
    pointType: "circle" as const,
    stroked: true,
    filled: true,
    onHover,
    onClick,
  };

  if (isPMTiles) {
    // External PMTiles need to go through our proxy to avoid CORS issues
    const isExternal = tileUrl.startsWith("http");
    const absoluteUrl = isExternal
      ? `${window.location.origin}/api/proxy?url=${encodeURIComponent(tileUrl)}`
      : `${window.location.origin}${tileUrl}`;
    const pmtilesSource = new PMTiles(absoluteUrl);

    return new MVTLayer({
      ...baseConfig,
      data: `${absoluteUrl}/{z}/{x}/{y}.pbf`,
      fetch: async (url: string, context: any) => {
        const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
        if (!match) return null;
        const [, z, x, y] = match.map(Number);
        try {
          const tile = await pmtilesSource.getZxy(z, x, y);
          if (!tile?.data) return null;
          // Parse through loaders.gl so MVTLayer gets properly structured data
          return load(tile.data, MVTLoader, {
            ...context.loadOptions,
            worker: false,
            mimeType: "application/x-protobuf",
          });
        } catch {
          return null;
        }
      },
    });
  }

  // Regular MVT tiles from tipg
  const data = tileUrl.startsWith("/")
    ? `${window.location.origin}${tileUrl}`
    : tileUrl;

  return new MVTLayer({
    ...baseConfig,
    data,
  });
}
