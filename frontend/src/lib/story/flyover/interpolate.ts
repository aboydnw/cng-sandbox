import type { CameraPose, FlyoverKeyframe } from "./types";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, s: number): number {
  return a + (b - a) * s;
}

/** Uniform Catmull-Rom for one scalar dimension. */
export function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  s: number
): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * s +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * s3)
  );
}

/** Interpolate a bearing along the shortest arc (350°→10° crosses 0°). */
export function shortestArcBearing(
  from: number,
  to: number,
  s: number
): number {
  const delta = ((to - from + 540) % 360) - 180;
  return (((from + delta * s) % 360) + 360) % 360;
}

/**
 * Rewrite a longitude sequence so consecutive values never differ by more
 * than 180° — Catmull-Rom through raw longitudes would otherwise fly the
 * long way around the antimeridian. MapLibre wraps out-of-range lngs itself.
 */
export function unwrapLongitudes(lngs: number[]): number[] {
  const out: number[] = [];
  for (const lng of lngs) {
    if (out.length === 0) {
      out.push(lng);
      continue;
    }
    let v = lng;
    const prev = out[out.length - 1];
    while (v - prev > 180) v -= 360;
    while (v - prev < -180) v += 360;
    out.push(v);
  }
  return out;
}

/** Progress position (t) of keyframe `index` among `count` keyframes. */
export function keyframeProgress(index: number, count: number): number {
  if (count <= 1) return 0;
  return index / (count - 1);
}

/**
 * Caption card opacity for keyframe `index` at progress `t`. Full opacity
 * within ±15% of a segment around the keyframe, fading linearly to 0 at
 * ±50% of a segment (the midpoint between keyframes).
 */
export function captionOpacity(
  t: number,
  index: number,
  count: number
): number {
  if (count <= 1) return 1;
  const seg = 1 / (count - 1);
  const d = Math.abs(clamp01(t) - keyframeProgress(index, count));
  const plateau = 0.15 * seg;
  const edge = 0.5 * seg;
  if (d <= plateau) return 1;
  if (d >= edge) return 0;
  return 1 - (d - plateau) / (edge - plateau);
}

/**
 * Sample a scalar sequence at index `j`, reflecting past the ends so the
 * boundary tangents match a straight line — `values[-1]` and `values[n]`
 * become the mirror of the nearest interior point. Duplicating endpoints
 * instead would bend a collinear path off the line at segment midpoints.
 */
function reflectedAt(values: number[], j: number): number {
  const n = values.length;
  if (j < 0) return 2 * values[0] - values[1];
  if (j >= n) return 2 * values[n - 1] - values[n - 2];
  return values[j];
}

/**
 * Camera pose at progress t∈[0,1] along the keyframe path: Catmull-Rom
 * through centers (reflected virtual ends), linear zoom/pitch, shortest-arc
 * bearing. Returns null below 2 keyframes.
 */
export function interpolateFlyover(
  keyframes: FlyoverKeyframe[],
  t: number
): CameraPose | null {
  const n = keyframes.length;
  if (n < 2) return null;

  const clamped = clamp01(t);
  const segments = n - 1;
  const pos = clamped * segments;
  const i = Math.min(Math.floor(pos), segments - 1);
  const s = pos - i;

  const lngs = unwrapLongitudes(keyframes.map((k) => k.center[0]));
  const lats = keyframes.map((k) => k.center[1]);
  const lat = (j: number) => reflectedAt(lats, j);
  const lng = (j: number) => reflectedAt(lngs, j);

  const a = keyframes[i];
  const b = keyframes[i + 1];

  return {
    center: [
      catmullRom(lng(i - 1), lng(i), lng(i + 1), lng(i + 2), s),
      catmullRom(lat(i - 1), lat(i), lat(i + 1), lat(i + 2), s),
    ],
    zoom: lerp(a.zoom, b.zoom, s),
    pitch: lerp(a.pitch, b.pitch, s),
    bearing: shortestArcBearing(a.bearing, b.bearing, s),
  };
}
