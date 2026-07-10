import { describe, it, expect, vi, beforeEach } from "vitest";

const ctorSpy = vi.fn();
const loadStreaming = vi.fn().mockResolvedValue({});
const setColorScheme = vi.fn();
const setPointSize = vi.fn();
const unloadPointCloud = vi.fn();

vi.mock("maplibre-gl-lidar", () => ({
  LidarControl: class {
    loadPointCloudStreaming = loadStreaming;
    setColorScheme = setColorScheme;
    setPointSize = setPointSize;
    unloadPointCloud = unloadPointCloud;
    constructor(opts: unknown) {
      ctorSpy(opts);
    }
  },
}));

import {
  buildCopcControl,
  DEFAULT_COPC_POINT_BUDGET,
  HIDDEN_CONTROL_CLASS,
} from "../copcLayer";

describe("buildCopcControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs the control with color mode, point size, and dynamic streaming budget", () => {
    buildCopcControl({
      url: "https://x/a.copc.laz",
      colorMode: "intensity",
      pointSize: 3,
    });
    expect(ctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        colorScheme: "intensity",
        pointSize: 3,
        copcLoadingMode: "dynamic",
        streamingPointBudget: DEFAULT_COPC_POINT_BUDGET,
      })
    );
  });

  it("defaults the point budget to 5,000,000", () => {
    buildCopcControl({ url: "u" });
    expect(ctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ streamingPointBudget: 5_000_000 })
    );
  });

  it("disables plugin autoZoom and hides its built-in panel", () => {
    buildCopcControl({ url: "u" });
    expect(ctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        autoZoom: false,
        className: HIDDEN_CONTROL_CLASS,
      })
    );
  });

  it("load() streams the given url", async () => {
    const handle = buildCopcControl({ url: "https://x/a.copc.laz" });
    await handle.load();
    expect(loadStreaming).toHaveBeenCalledWith("https://x/a.copc.laz");
  });

  it("update() proxies color mode and point size", () => {
    const handle = buildCopcControl({ url: "u" });
    handle.update({ colorMode: "elevation", pointSize: 5 });
    expect(setColorScheme).toHaveBeenCalledWith("elevation");
    expect(setPointSize).toHaveBeenCalledWith(5);
  });

  it("destroy() unloads the point cloud", () => {
    const handle = buildCopcControl({ url: "u" });
    handle.destroy();
    expect(unloadPointCloud).toHaveBeenCalled();
  });
});
