import { useEffect, useMemo, useState } from "react";
import { buildTripsLayer, computeMaxSpeed } from "../lib/layers/tripsLayer";
import type { TripTrack } from "../lib/layers/tripsLayer";

type TripsLayerInstance = ReturnType<typeof buildTripsLayer>;

export function useTripsLayer(tripsUrl: string | null, currentTime: number) {
  const [tracks, setTracks] = useState<TripTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripsUrl) {
      setTracks(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    // Drop the previous dataset's tracks immediately so switching trajectories
    // never renders stale paths while the new sidecar is in flight.
    setTracks(null);
    setLoading(true);
    setError(null);
    fetch(tripsUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load trajectory (${r.status})`);
        return r.json();
      })
      .then((data: TripTrack[]) => {
        if (!cancelled) setTracks(data);
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
  }, [tripsUrl]);

  // Derive the speed-color ceiling once per dataset, not on every animation
  // frame — the layer is rebuilt each time currentTime changes.
  const speedMax = useMemo(
    () => (tracks ? computeMaxSpeed(tracks) : undefined),
    [tracks]
  );

  const layer = useMemo<TripsLayerInstance | null>(
    () => (tracks ? buildTripsLayer({ tracks, currentTime, speedMax }) : null),
    [tracks, currentTime, speedMax]
  );

  return { layer, tracks, loading, error };
}
