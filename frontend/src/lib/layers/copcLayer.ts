import { LidarControl } from "maplibre-gl-lidar";

export type CopcColorMode =
  | "elevation"
  | "intensity"
  | "classification"
  | "rgb";

export interface CopcControlOptions {
  url: string;
  colorMode?: CopcColorMode;
  pointSize?: number;
  pointBudget?: number;
}

export interface CopcControlHandle {
  control: LidarControl;
  /** Begin viewport-LOD streaming of the point cloud. Call after addControl. */
  load: () => Promise<void>;
  /** Apply color-mode / point-size changes without remounting the control. */
  update: (cfg: { colorMode?: CopcColorMode; pointSize?: number }) => void;
  /** Unload the point cloud from the control (call before removeControl). */
  destroy: () => void;
}

export const DEFAULT_COPC_POINT_BUDGET = 5_000_000;

/**
 * Thin adapter over `maplibre-gl-lidar`'s `LidarControl`. Isolates the plugin
 * surface in one file so the lifecycle hook and its tests can mock it.
 */
export function buildCopcControl(opts: CopcControlOptions): CopcControlHandle {
  const {
    url,
    colorMode = "elevation",
    pointSize = 2,
    pointBudget = DEFAULT_COPC_POINT_BUDGET,
  } = opts;

  const control = new LidarControl({
    collapsed: true,
    colorScheme: colorMode,
    pointSize,
    copcLoadingMode: "dynamic",
    streamingPointBudget: pointBudget,
    autoZoom: true,
    shareUrl: false,
    restoreFromUrl: false,
  });

  return {
    control,
    load: () => control.loadPointCloudStreaming(url).then(() => undefined),
    update: (cfg) => {
      if (cfg.colorMode) control.setColorScheme(cfg.colorMode);
      if (cfg.pointSize != null) control.setPointSize(cfg.pointSize);
    },
    destroy: () => control.unloadPointCloud(),
  };
}
