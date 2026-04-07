import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import { PMTiles } from "pmtiles";

interface RasterPMTilesLayerOptions {
  id?: string;
  tileUrl: string;
  opacity: number;
  minZoom?: number;
  maxZoom?: number;
}

export function buildRasterPMTilesLayer({
  id = "raster-pmtiles",
  tileUrl,
  opacity,
  minZoom,
  maxZoom,
}: RasterPMTilesLayerOptions) {
  const isExternal = tileUrl.startsWith("http");
  const absoluteUrl = isExternal
    ? `${window.location.origin}/api/proxy?url=${encodeURIComponent(tileUrl)}`
    : `${window.location.origin}${tileUrl}`;
  const pmtilesSource = new PMTiles(absoluteUrl);

  return new TileLayer({
    id,
    data: `${absoluteUrl}/{z}/{x}/{y}.png`,
    opacity,
    tileSize: 256,
    ...(minZoom !== undefined && { minZoom }),
    ...(maxZoom !== undefined && { maxZoom }),
    fetch: async (url: string) => {
      const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
      if (!match) return null;
      const [, z, x, y] = match.map(Number);
      try {
        const tile = await pmtilesSource.getZxy(z, x, y);
        if (!tile?.data) return null;
        const blob = new Blob([tile.data]);
        const imageBitmap = await createImageBitmap(blob);
        return imageBitmap;
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderSubLayers: (props: any) => {
      const { boundingBox } = props.tile;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new BitmapLayer(props as any, {
        data: undefined,
        image: props.data,
        bounds: [
          boundingBox[0][0],
          boundingBox[0][1],
          boundingBox[1][0],
          boundingBox[1][1],
        ],
      });
    },
  });
}
