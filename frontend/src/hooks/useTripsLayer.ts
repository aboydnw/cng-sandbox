import { useEffect, useMemo, useState } from "react";
import { buildTripsLayer } from "../lib/layers/tripsLayer";
import type { TripTrack } from "../lib/layers/tripsLayer";

type TripsLayerInstance = ReturnType<typeof buildTripsLayer>;

export function useTripsLayer(tripsUrl: string | null, currentTime: number) {
  const [tracks, setTracks] = useState<TripTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripsUrl) {
      setTracks(null);
      setError(null);
      return;
    }
    let cancelled = false;
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

  const layer = useMemo<TripsLayerInstance | null>(
    () => (tracks ? buildTripsLayer({ tracks, currentTime }) : null),
    [tracks, currentTime]
  );

  return { layer, tracks, loading, error };
}
