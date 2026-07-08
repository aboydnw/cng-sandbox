import type { CameraState } from "../lib/layers/types";

export interface CameraCommand {
  method: "flyTo" | "jumpTo";
  options: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
    duration?: number;
  };
}

export function resolveCameraCommand(
  camera: CameraState,
  transitionDuration?: number
): CameraCommand {
  const base = {
    center: [camera.longitude, camera.latitude] as [number, number],
    zoom: camera.zoom,
    bearing: camera.bearing,
    pitch: camera.pitch,
  };
  if (transitionDuration && transitionDuration > 0) {
    return {
      method: "flyTo",
      options: { ...base, duration: transitionDuration },
    };
  }
  return { method: "jumpTo", options: base };
}
