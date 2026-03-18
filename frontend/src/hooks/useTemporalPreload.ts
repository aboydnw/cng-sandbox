import { useState, useEffect, useRef, useCallback } from "react";
import type { Timestep } from "../types";

interface PreloadState {
  progress: { current: number; total: number } | null;
  isReady: boolean;
}

export function useTemporalPreload(
  tileUrlTemplate: string,
  timesteps: Timestep[],
  viewState: { zoom: number; longitude: number; latitude: number },
) {
  const [state, setState] = useState<PreloadState>({ progress: null, isReady: false });
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, boolean>>(new Map());

  const preload = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    cacheRef.current.clear();
    setState({ progress: { current: 0, total: timesteps.length }, isReady: false });

    const z = Math.round(viewState.zoom);
    const x = Math.floor(((viewState.longitude + 180) / 360) * Math.pow(2, z));
    const latRad = (viewState.latitude * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z),
    );

    let loaded = 0;
    for (const ts of timesteps) {
      if (controller.signal.aborted) return;
      const url =
        tileUrlTemplate
          .replace("{z}", String(z))
          .replace("{x}", String(x))
          .replace("{y}", String(y)) + `&datetime=${ts.datetime}`;
      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (resp.ok) cacheRef.current.set(ts.datetime, true);
      } catch {
        if (controller.signal.aborted) return;
      }
      loaded++;
      setState({ progress: { current: loaded, total: timesteps.length }, isReady: false });
    }
    if (!controller.signal.aborted) {
      setState({ progress: null, isReady: true });
    }
  }, [tileUrlTemplate, timesteps, viewState.zoom, viewState.longitude, viewState.latitude]);

  useEffect(() => {
    if (timesteps.length > 0) preload();
    return () => {
      abortRef.current?.abort();
    };
  }, [preload]);

  return state;
}
