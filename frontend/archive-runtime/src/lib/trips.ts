import { TripsLayer } from "@deck.gl/geo-layers";

// Vendored from frontend/src/lib/layers/tripsLayer.ts — the archive runtime is
// a separate, self-contained workspace and must not import from the main app.

export interface TripTrack {
  trajectory_id: string;
  path: [number, number][];
  timestamps: number[];
  speeds: number[];
}

const SLOW: [number, number, number] = [43, 131, 186];
const FAST: [number, number, number] = [215, 25, 28];

export function computeMaxSpeed(tracks: TripTrack[]): number {
  let max = 1;
  for (const track of tracks) {
    for (const speed of track.speeds) {
      if (Number.isFinite(speed) && speed > max) max = speed;
    }
  }
  return max;
}

export function speedToColor(
  speed: number,
  speedMax: number
): [number, number, number] {
  const t = speedMax > 0 ? Math.max(0, Math.min(1, speed / speedMax)) : 0;
  return [
    Math.round(SLOW[0] + (FAST[0] - SLOW[0]) * t),
    Math.round(SLOW[1] + (FAST[1] - SLOW[1]) * t),
    Math.round(SLOW[2] + (FAST[2] - SLOW[2]) * t),
  ];
}

interface BuildArchiveTripsLayerOpts {
  id?: string;
  tracks: TripTrack[];
  currentTime: number;
  trailLength?: number;
  opacity?: number;
  speedMax?: number;
}

export function buildArchiveTripsLayer({
  id = "trips",
  tracks,
  currentTime,
  trailLength = 600,
  opacity = 1,
  speedMax,
}: BuildArchiveTripsLayerOpts) {
  const maxSpeed = speedMax ?? computeMaxSpeed(tracks);
  return new TripsLayer<TripTrack>({
    id,
    data: tracks,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.timestamps,
    getColor: (d) => d.speeds.map((s) => speedToColor(s, maxSpeed)),
    currentTime,
    trailLength,
    opacity,
    widthMinPixels: 3,
    capRounded: true,
    jointRounded: true,
    fadeTrail: true,
  });
}

export function tracksTimeBounds(tracks: TripTrack[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const t of tracks) {
    for (const ts of t.timestamps) {
      if (ts < min) min = ts;
      if (ts > max) max = ts;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0];
  return [min, max];
}
