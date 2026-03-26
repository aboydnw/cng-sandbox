import { useState, useRef, useCallback, useEffect } from "react";

const SPEED_MS: Record<number, number> = { 0.5: 1600, 1: 800, 2: 400 };

interface AnimationState {
  isPlaying: boolean;
  speed: number;
  activeIndex: number;
}

export function useTemporalAnimation(
  totalFrames: number,
  gapIndices: Set<number>,
  isReady: boolean,
  initialIndex: number = 0
) {
  const [state, setState] = useState<AnimationState>({
    isPlaying: false,
    speed: 1,
    activeIndex: initialIndex,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceFrame = useCallback(() => {
    setState((prev) => {
      let next = (prev.activeIndex + 1) % totalFrames;
      let checked = 0;
      while (gapIndices.has(next) && checked < totalFrames) {
        next = (next + 1) % totalFrames;
        checked++;
      }
      return { ...prev, activeIndex: next };
    });
  }, [totalFrames, gapIndices]);

  const togglePlay = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setActiveIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, activeIndex: index, isPlaying: false }));
  }, []);

  useEffect(() => {
    clearTimer();
    if (state.isPlaying && isReady) {
      timerRef.current = setInterval(
        advanceFrame,
        SPEED_MS[state.speed] ?? 800
      );
    }
    return clearTimer;
  }, [state.isPlaying, state.speed, isReady, advanceFrame, clearTimer]);

  useEffect(() => {
    if (!isReady && state.isPlaying) {
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, [isReady, state.isPlaying]);

  return { ...state, togglePlay, setSpeed, setActiveIndex };
}
