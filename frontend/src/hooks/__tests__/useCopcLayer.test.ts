import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { MapItem } from "../../types";

const load = vi.fn().mockResolvedValue(undefined);
const update = vi.fn();
const destroy = vi.fn();
const control = { __copc: true };
const buildCopcControl = vi.fn((_opts: unknown) => ({
  control,
  load,
  update,
  destroy,
}));

vi.mock("../../lib/layers/copcLayer", () => ({
  buildCopcControl: (opts: unknown) => buildCopcControl(opts),
  DEFAULT_COPC_POINT_BUDGET: 5_000_000,
}));

import { useCopcLayer } from "../useCopcLayer";

function makeMap() {
  return {
    addControl: vi.fn(),
    removeControl: vi.fn(),
  } as unknown as import("maplibre-gl").Map;
}

function copcItem(url = "https://x/a.copc.laz"): MapItem {
  return { dataType: "pointcloud", copcUrl: url } as unknown as MapItem;
}

describe("useCopcLayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds the control and streams when mounted with a copc item", () => {
    const map = makeMap();
    renderHook(() => useCopcLayer(map, copcItem(), {}));
    expect(buildCopcControl).toHaveBeenCalledTimes(1);
    expect(map.addControl).toHaveBeenCalledWith(control);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a non-copc item", () => {
    const map = makeMap();
    renderHook(() =>
      useCopcLayer(map, { dataType: "raster", copcUrl: null } as MapItem, {})
    );
    expect(buildCopcControl).not.toHaveBeenCalled();
    expect(map.addControl).not.toHaveBeenCalled();
  });

  it("removes the control when the item becomes non-copc", () => {
    const map = makeMap();
    const { rerender } = renderHook(
      ({ item }: { item: MapItem }) => useCopcLayer(map, item, {}),
      { initialProps: { item: copcItem() } }
    );
    rerender({ item: { dataType: "raster", copcUrl: null } as MapItem });
    expect(destroy).toHaveBeenCalled();
    expect(map.removeControl).toHaveBeenCalledWith(control);
  });

  it("destroys the control on unmount", () => {
    const map = makeMap();
    const { unmount } = renderHook(() => useCopcLayer(map, copcItem(), {}));
    unmount();
    expect(destroy).toHaveBeenCalled();
  });

  it("updates config in place without remounting", () => {
    const map = makeMap();
    type Cfg = { colorMode: "elevation" | "intensity" };
    const { rerender } = renderHook(
      ({ cfg }: { cfg: Cfg }) => useCopcLayer(map, copcItem(), cfg),
      { initialProps: { cfg: { colorMode: "elevation" } as Cfg } }
    );
    expect(buildCopcControl).toHaveBeenCalledTimes(1);
    update.mockClear();
    rerender({ cfg: { colorMode: "intensity" } });
    expect(update).toHaveBeenCalledWith({
      colorMode: "intensity",
      pointSize: undefined,
    });
    expect(buildCopcControl).toHaveBeenCalledTimes(1);
  });
});
