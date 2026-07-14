import { useEffect, useState } from "react";
import type { TripTrack } from "../lib/layers/tripsLayer";
import type { Dataset } from "../types";

export interface StoryTripsTracks {
  tracksByDatasetId: Map<string, TripTrack[]>;
  boundsByDatasetId: Map<string, [number, number]>;
  loading: boolean;
  error: string | null;
}

function trackBounds(tracks: TripTrack[]): [number, number] {
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

/**
 * Fetch and cache the `trips.json` sidecar for each trajectory dataset that
 * carries a `trips_url`. Dedupes by dataset id, derives each dataset's
 * `[tMin, tMax]` time span, and surfaces a loud error state (no silent catch).
 */
export function useStoryTripsTracks(
  datasets: (Dataset | null | undefined)[]
): StoryTripsTracks {
  const [tracksByDatasetId, setTracks] = useState<Map<string, TripTrack[]>>(
    new Map()
  );
  const [boundsByDatasetId, setBounds] = useState<
    Map<string, [number, number]>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = new Map<string, string>();
  for (const ds of datasets) {
    if (ds && ds.dataset_type === "trajectory" && ds.trips_url) {
      targets.set(ds.id, ds.trips_url);
    }
  }
  const key = [...targets.entries()]
    .map(([id, url]) => `${id}=${url}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (targets.size === 0) {
      setTracks(new Map());
      setBounds(new Map());
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(
      [...targets.entries()].map(([id, url]) =>
        fetch(url)
          .then((r) => {
            if (!r.ok)
              throw new Error(`Failed to load trajectory (${r.status})`);
            return r.json();
          })
          .then((data: TripTrack[]) => [id, data] as const)
      )
    )
      .then((entries) => {
        if (cancelled) return;
        const tracks = new Map<string, TripTrack[]>();
        const bounds = new Map<string, [number, number]>();
        for (const [id, data] of entries) {
          tracks.set(id, data);
          bounds.set(id, trackBounds(data));
        }
        setTracks(tracks);
        setBounds(bounds);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { tracksByDatasetId, boundsByDatasetId, loading, error };
}
