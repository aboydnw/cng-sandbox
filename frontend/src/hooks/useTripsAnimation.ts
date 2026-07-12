import { useCallback, useEffect, useRef, useState } from "react";

const ANIM_SPAN_SECONDS = 20; // wall-clock seconds to traverse the range at 1x

interface TripsState {
  currentTime: number;
  isPlaying: boolean;
  speed: number;
}

export function useTripsAnimation(
  tMin: number,
  tMax: number,
  isReady: boolean
) {
  const [state, setState] = useState<TripsState>({
    currentTime: tMin,
    isPlaying: false,
    speed: 1,
  });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    setState((s) => ({ ...s, currentTime: tMin }));
  }, [tMin, tMax]);

  const togglePlay = useCallback(
    () => setState((s) => ({ ...s, isPlaying: !s.isPlaying })),
    []
  );
  const setSpeed = useCallback(
    (speed: number) => setState((s) => ({ ...s, speed })),
    []
  );
  const scrub = useCallback(
    (t: number) =>
      setState((s) => ({ ...s, currentTime: t, isPlaying: false })),
    []
  );

  useEffect(() => {
    if (!state.isPlaying || !isReady || tMax <= tMin) return;
    const span = tMax - tMin;
    const tick = (now: number) => {
      const last = lastRef.current ?? now;
      const dt = (now - last) / 1000;
      lastRef.current = now;
      setState((s) => {
        const delta = s.speed * dt * (span / ANIM_SPAN_SECONDS);
        let next = s.currentTime + delta;
        if (next >= tMax) next = tMin + ((next - tMin) % span);
        return { ...s, currentTime: next };
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [state.isPlaying, state.speed, isReady, tMin, tMax]);

  return { ...state, togglePlay, setSpeed, scrub };
}
