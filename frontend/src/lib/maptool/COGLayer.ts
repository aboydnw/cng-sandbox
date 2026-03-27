import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";

export interface COGLayerOptions {
  id: string;
  tileUrl: string;
  bounds?: [number, number, number, number];
  minZoom?: number;
  maxZoom?: number;
  opacity?: number;
  visible?: boolean;
  onViewportLoad?: () => void;
}

export function createCOGLayer({
  id,
  tileUrl,
  bounds,
  minZoom = 0,
  maxZoom = 22,
  opacity = 1,
  visible = true,
  onViewportLoad,
}: COGLayerOptions) {
  return new TileLayer({
    id,
    data: tileUrl,
    minZoom,
    maxZoom,
    opacity,
    visible,
    tileSize: 256,
    ...(bounds ? { extent: bounds } : {}),
    ...(onViewportLoad ? { onViewportLoad } : {}),
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
