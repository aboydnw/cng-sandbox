import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapItem } from "../types";
import {
  buildCopcControl,
  DEFAULT_COPC_POINT_BUDGET,
} from "../lib/layers/copcLayer";
import type { CopcColorMode, CopcControlHandle } from "../lib/layers/copcLayer";

export interface UseCopcLayerConfig {
  colorMode?: CopcColorMode;
  pointSize?: number;
  pointBudget?: number;
}

export interface UseCopcLayerResult {
  isLoading: boolean;
  error: string | null;
}

/**
 * Mounts a `maplibre-gl-lidar` control onto `map` when `item` is a COPC point
 * cloud and streams it with a viewport-LOD point budget. Removes the control on
 * change/unmount. Color-mode and point-size changes update the existing control
 * in place rather than remounting it.
 */
export function useCopcLayer(
  map: MapLibreMap | null,
  item: MapItem | null,
  config: UseCopcLayerConfig = {}
): UseCopcLayerResult {
  const { colorMode, pointSize } = config;
  const pointBudget = config.pointBudget ?? DEFAULT_COPC_POINT_BUDGET;
  const copcUrl = item?.copcUrl ?? null;
  const isCopc = item?.dataType === "pointcloud" && !!copcUrl;

  const handleRef = useRef<CopcControlHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!map || !isCopc || !copcUrl) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const handle = buildCopcControl({
      url: copcUrl,
      colorMode,
      pointSize,
      pointBudget,
    });
    handleRef.current = handle;
    map.addControl(handle.control);

    handle
      .load()
      .then(() => {
        if (!cancelled) setIsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setIsLoading(false);
        setError(e instanceof Error ? e.message : "Failed to load point cloud");
      });

    return () => {
      cancelled = true;
      handle.destroy();
      try {
        map.removeControl(handle.control);
      } catch {
        // Map may already be torn down; ignore.
      }
      handleRef.current = null;
    };
    // colorMode/pointSize deliberately excluded — handled by the update effect
    // below so a style change updates the control instead of remounting it.
  }, [map, isCopc, copcUrl, pointBudget]);

  useEffect(() => {
    handleRef.current?.update({ colorMode, pointSize });
  }, [colorMode, pointSize]);

  return { isLoading, error };
}
