import { TripsLayer } from "@deck.gl/geo-layers";

export interface TripTrack {
  trajectory_id: string;
  path: [number, number][];
  timestamps: number[];
  speeds: number[];
}

interface BuildTripsLayerOpts {
  id?: string;
  tracks: TripTrack[];
  currentTime: number;
  trailLength?: number;
  speedMax?: number;
}

// Fixed slow (cool) -> fast (warm) gradient.
const SLOW: [number, number, number] = [43, 131, 186];
const FAST: [number, number, number] = [215, 25, 28];

// Single-pass max: a trajectory can hold up to 2M points, and spreading that
// many values into Math.max(...) risks exceeding the JS engine's argument limit.
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

export function buildTripsLayer({
  id = "trips",
  tracks,
  currentTime,
  trailLength = 600,
  speedMax,
}: BuildTripsLayerOpts) {
  const maxSpeed = speedMax ?? computeMaxSpeed(tracks);
  return new TripsLayer<TripTrack>({
    id,
    data: tracks,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.timestamps,
    getColor: (d) => d.speeds.map((s) => speedToColor(s, maxSpeed)),
    currentTime,
    trailLength,
    widthMinPixels: 3,
    capRounded: true,
    jointRounded: true,
    fadeTrail: true,
  });
}
