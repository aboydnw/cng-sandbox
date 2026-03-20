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

interface VectorLayerOptions {
  tileUrl: string;
  isPMTiles: boolean;
  opacity: number;
  onHover?: (info: any) => void;
  onClick?: (info: any) => void;
}

export function buildVectorLayer({
  tileUrl,
  isPMTiles,
  opacity,
  onHover,
  onClick,
}: VectorLayerOptions) {
  if (isPMTiles) {
    const absoluteUrl = `${window.location.origin}${tileUrl}`;
    const pmtilesSource = new PMTiles(absoluteUrl);

    return new MVTLayer({
      id: "vector-mvt",
      data: `${absoluteUrl}/{z}/{x}/{y}.pbf`,
      opacity,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      getFillColor: FILL_COLOR,
      getLineColor: LINE_COLOR,
      getLineWidth: 1.5,
      lineWidthMinPixels: 1,
      getPointRadius: 4,
      pointRadiusMinPixels: 3,
      pointType: "circle",
      stroked: true,
      filled: true,
      onHover,
      onClick,
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
    id: "vector-mvt",
    data,
    opacity,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 60],
    getFillColor: FILL_COLOR,
    getLineColor: LINE_COLOR,
    getLineWidth: 1.5,
    lineWidthMinPixels: 1,
    getPointRadius: 4,
    pointRadiusMinPixels: 3,
    pointType: "circle",
    stroked: true,
    filled: true,
    onHover,
    onClick,
  });
}
