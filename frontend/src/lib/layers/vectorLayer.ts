import { MVTLayer } from "@deck.gl/geo-layers";
import { PMTiles } from "pmtiles";
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
  onHover?: (info: any) => void;
  onClick?: (info: any) => void;
}

export function buildVectorLayer({
  id = "vector-mvt",
  tileUrl,
  isPMTiles,
  opacity,
  onHover,
  onClick,
}: VectorLayerOptions) {
  const baseConfig = {
    id,
    opacity,
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
    const absoluteUrl = `${window.location.origin}${tileUrl}`;
    const pmtilesSource = new PMTiles(absoluteUrl);

    return new MVTLayer({
      ...baseConfig,
      data: `${absoluteUrl}/{z}/{x}/{y}.pbf`,
      loadOptions: {
        fetch: async (url: string, _context: any) => {
          const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
          if (!match) return new Response(null, { status: 404 });
          const [, z, x, y] = match.map(Number);
          const tile = await pmtilesSource.getZxy(z, x, y);
          if (!tile?.data) return new Response(null, { status: 404 });
          return new Response(tile.data);
        },
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
