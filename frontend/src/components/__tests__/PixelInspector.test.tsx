import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { usePixelInspector } from "../PixelInspector";
import type { TileCacheEntry } from "../../lib/layers";

function seededCache(): Map<string, TileCacheEntry> {
  const m = new Map<string, TileCacheEntry>();
  m.set("0/0", {
    data: new Float32Array([1, 2, 3, 4]),
    width: 2,
    height: 2,
    bounds: [-10, -10, 10, 10],
  });
  return m;
}

describe("usePixelInspector categorical branch", () => {
  it("returns categorical hover info when categories provided and value matches", async () => {
    const cats = [
      { value: 1, color: "#ff0000", label: "A" },
      { value: 2, color: "#00ff00", label: "B" },
    ];
    const { result } = renderHook(() => {
      const ref = useRef(seededCache());
      return usePixelInspector(ref, null, cats);
    });
    act(() => {
      result.current.onHover({ coordinate: [-5, 5], x: 10, y: 20 });
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({
        kind: "categorical",
        label: "A",
        color: "#ff0000",
        x: 10,
        y: 20,
      });
    });
  });

  it("returns null when hovered value has no matching category", async () => {
    const cats = [{ value: 99, color: "#ff0000", label: "X" }];
    const { result } = renderHook(() => {
      const ref = useRef(seededCache());
      return usePixelInspector(ref, null, cats);
    });
    act(() => {
      result.current.onHover({ coordinate: [-5, 5], x: 0, y: 0 });
    });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(result.current.hoverInfo).toBeNull();
  });

  it("keeps numeric behavior when categories is undefined", async () => {
    const { result } = renderHook(() => {
      const ref = useRef(seededCache());
      return usePixelInspector(ref, null);
    });
    act(() => {
      result.current.onHover({ coordinate: [-5, 5], x: 0, y: 0 });
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({ kind: "numeric", value: 1 });
    });
  });
});
