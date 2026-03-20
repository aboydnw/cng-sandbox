import { WebMercatorViewport } from "@deck.gl/core";

export interface CameraState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export const DEFAULT_CAMERA: CameraState = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

export function cameraFromBounds(
  bounds: [number, number, number, number],
  viewportSize = { width: 800, height: 600 },
): CameraState {
  const [west, south, east, north] = bounds;
  const MERCATOR_LIMIT = 85.051129;
  const viewport = new WebMercatorViewport(viewportSize);
  const { longitude, latitude, zoom } = viewport.fitBounds(
    [
      [west, Math.max(south, -MERCATOR_LIMIT)],
      [east, Math.min(north, MERCATOR_LIMIT)],
    ],
    { padding: 40 },
  );
  return { longitude, latitude, zoom, bearing: 0, pitch: 0 };
}
