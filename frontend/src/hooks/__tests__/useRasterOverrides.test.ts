import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRasterOverrides } from "../useRasterOverrides";

function makeParams(init: Record<string, string> = {}) {
  const params = new URLSearchParams(init);
  let current = params;
  const set = (next: URLSearchParams) => {
    current = next;
  };
  return {
    get: () => current,
    setter: (updater: (prev: URLSearchParams) => URLSearchParams) => {
      set(updater(current));
    },
  };
}

describe("useRasterOverrides", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null overrides when no URL params and no localStorage", () => {
    const params = makeParams();
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    expect(result.current.initialOverrides?.rescaleMin).toBeNull();
    expect(result.current.initialOverrides?.rescaleMax).toBeNull();
    expect(result.current.initialOverrides?.colormapReversed).toBe(false);
  });

  it("seeds from URL params when present", () => {
    const params = makeParams({ rmin: "10", rmax: "50", flip: "1" });
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    expect(result.current.initialOverrides?.rescaleMin).toBe(10);
    expect(result.current.initialOverrides?.rescaleMax).toBe(50);
    expect(result.current.initialOverrides?.colormapReversed).toBe(true);
  });

  it("ignores non-numeric URL params", () => {
    const params = makeParams({ rmin: "abc", rmax: "50" });
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    expect(result.current.initialOverrides?.rescaleMin).toBeNull();
    expect(result.current.initialOverrides?.rescaleMax).toBe(50);
  });

  it("falls back to localStorage when URL params absent", () => {
    localStorage.setItem(
      "cng:raster-override:item-1",
      JSON.stringify({
        rescaleMin: 5,
        rescaleMax: 95,
        colormapReversed: true,
        colormapName: "inferno",
      })
    );
    const params = makeParams();
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    expect(result.current.initialOverrides?.rescaleMin).toBe(5);
    expect(result.current.initialOverrides?.rescaleMax).toBe(95);
    expect(result.current.initialOverrides?.colormapReversed).toBe(true);
    expect(result.current.initialOverrides?.colormapName).toBe("inferno");
  });

  it("URL params take precedence over localStorage", () => {
    localStorage.setItem(
      "cng:raster-override:item-1",
      JSON.stringify({ rescaleMin: 1, rescaleMax: 2, colormapReversed: false })
    );
    const params = makeParams({ rmin: "10", flip: "1" });
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    expect(result.current.initialOverrides?.rescaleMin).toBe(10);
    expect(result.current.initialOverrides?.rescaleMax).toBeNull();
    expect(result.current.initialOverrides?.colormapReversed).toBe(true);
  });

  it("persist writes localStorage and updates URL params", () => {
    const params = makeParams();
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    act(() =>
      result.current.persist({
        rescaleMin: 10,
        rescaleMax: 50,
        colormapReversed: true,
        colormapName: "magma",
      })
    );
    expect(params.get().get("rmin")).toBe("10");
    expect(params.get().get("rmax")).toBe("50");
    expect(params.get().get("flip")).toBe("1");
    const stored = JSON.parse(
      localStorage.getItem("cng:raster-override:item-1")!
    );
    expect(stored.rescaleMin).toBe(10);
    expect(stored.colormapReversed).toBe(true);
  });

  it("persist with all defaults removes URL params", () => {
    const params = makeParams({ rmin: "10", rmax: "50", flip: "1" });
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    act(() =>
      result.current.persist({
        rescaleMin: null,
        rescaleMax: null,
        colormapReversed: false,
        colormapName: "viridis",
      })
    );
    expect(params.get().get("rmin")).toBeNull();
    expect(params.get().get("rmax")).toBeNull();
    expect(params.get().get("flip")).toBeNull();
  });

  it("handles malformed localStorage without throwing", () => {
    localStorage.setItem("cng:raster-override:item-1", "not json");
    const params = makeParams();
    const { result } = renderHook(() =>
      useRasterOverrides("item-1", params.get(), params.setter)
    );
    expect(result.current.initialOverrides?.rescaleMin).toBeNull();
    expect(result.current.initialOverrides?.rescaleMax).toBeNull();
    expect(result.current.initialOverrides?.colormapReversed).toBe(false);
  });
});
