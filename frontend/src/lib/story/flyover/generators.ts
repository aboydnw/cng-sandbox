import type { CameraPose, FlyoverKeyframe } from "./types";

const ORBIT_MIN_READABLE_PITCH = 30;
const ORBIT_DEFAULT_PITCH = 60;
export const ZOOM_GAP_WARNING_THRESHOLD = 3;

/**
 * Orbit preset: `count` keyframes circling the current center by sweeping
 * the bearing `sweepDeg` degrees (default 180°). Center/zoom stay fixed; a
 * near-flat pitch is raised to 60° so the orbit reads as 3D.
 */
export function orbitKeyframes(
  current: CameraPose,
  opts: { count?: number; sweepDeg?: number } = {}
): FlyoverKeyframe[] {
  const count = Math.max(2, opts.count ?? 5);
  const sweep = opts.sweepDeg ?? 180;
  const pitch =
    current.pitch >= ORBIT_MIN_READABLE_PITCH
      ? current.pitch
      : ORBIT_DEFAULT_PITCH;
  return Array.from({ length: count }, (_, i) => ({
    center: [current.center[0], current.center[1]] as [number, number],
    zoom: current.zoom,
    pitch,
    bearing:
      (((current.bearing + (sweep * i) / (count - 1)) % 360) + 360) % 360,
  }));
}

/**
 * Approach preset: high-altitude overview → current view in 3 keyframes
 * (wide, mid, close). Segment zoom gaps stay at ~2.5, under the pop-in
 * warning threshold.
 */
export function approachKeyframes(target: CameraPose): FlyoverKeyframe[] {
  const wideZoom = Math.max(target.zoom - 5, 1.5);
  const midZoom = (wideZoom + target.zoom) / 2;
  const center: [number, number] = [target.center[0], target.center[1]];
  return [
    { center, zoom: wideZoom, bearing: target.bearing, pitch: 0 },
    { center, zoom: midZoom, bearing: target.bearing, pitch: target.pitch / 2 },
    {
      center,
      zoom: target.zoom,
      bearing: target.bearing,
      pitch: target.pitch,
    },
  ];
}

/**
 * Indices of segments whose zoom jump exceeds 3 levels — the tile-pop-in
 * zone. Soft editor hint only; never blocks saving or rendering.
 */
export function zoomGapWarnings(keyframes: FlyoverKeyframe[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (
      Math.abs(keyframes[i + 1].zoom - keyframes[i].zoom) >
      ZOOM_GAP_WARNING_THRESHOLD
    ) {
      out.push(i);
    }
  }
  return out;
}
