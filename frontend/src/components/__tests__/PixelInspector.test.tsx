import { describe, it, expect } from "vitest";
import {
  render,
  screen,
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { useRef } from "react";
import { usePixelInspector, CategoricalPixelTooltip } from "../PixelInspector";

function renderWithProvider(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}
import type { TileCacheEntry } from "../../lib/layers";

function seededCache(): Map<string, TileCacheEntry> {
  const m = new Map<string, TileCacheEntry>();
  m.set("0/0", {
    data: new Float32Array([1, 2, 3, 4]),
    width: 2,
    height: 2,
  });
  return m;
}

function hoverInfo(opts: {
  coordinate: [number, number];
  x: number;
  y: number;
  tileX?: number;
  tileY?: number;
  tileBounds?: [number, number, number, number];
}) {
  const {
    coordinate,
    x,
    y,
    tileX = 0,
    tileY = 0,
    tileBounds = [-10, -10, 10, 10],
  } = opts;
  return {
    coordinate,
    x,
    y,
    sourceTile: {
      index: { x: tileX, y: tileY, z: 0 },
      bounds: tileBounds,
    },
  };
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
      result.current.onHover(hoverInfo({ coordinate: [-5, 5], x: 10, y: 20 }));
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
      result.current.onHover(hoverInfo({ coordinate: [-5, 5], x: 0, y: 0 }));
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
      result.current.onHover(hoverInfo({ coordinate: [-5, 5], x: 0, y: 0 }));
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({
        kind: "numeric",
        value: 1,
      });
    });
  });

  it("returns null when sourceTile is missing (hover off COG layer)", async () => {
    const { result } = renderHook(() => {
      const ref = useRef(seededCache());
      return usePixelInspector(ref, null);
    });
    act(() => {
      result.current.onHover({ coordinate: [-5, 5], x: 0, y: 0 });
    });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(result.current.hoverInfo).toBeNull();
  });

  it("samples the right pixel from the right tile when multiple tiles are cached", async () => {
    const cache = new Map<string, TileCacheEntry>();
    cache.set("0/0", {
      data: new Float32Array([1, 1, 1, 1]),
      width: 2,
      height: 2,
    });
    cache.set("1/0", {
      data: new Float32Array([2, 2, 2, 2]),
      width: 2,
      height: 2,
    });
    const cats = [
      { value: 1, color: "#f00", label: "One" },
      { value: 2, color: "#0f0", label: "Two" },
    ];
    const { result } = renderHook(() => {
      const ref = useRef(cache);
      return usePixelInspector(ref, null, cats);
    });
    // Hover the second tile; inspector must look it up by index, not bounds.
    act(() => {
      result.current.onHover(
        hoverInfo({
          coordinate: [15, 5],
          x: 0,
          y: 0,
          tileX: 1,
          tileY: 0,
          tileBounds: [10, -10, 30, 10],
        })
      );
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({
        kind: "categorical",
        label: "Two",
      });
    });
  });
});

describe("CategoricalPixelTooltip", () => {
  it("renders the label and a colored swatch", () => {
    renderWithProvider(
      <CategoricalPixelTooltip
        hoverInfo={{
          kind: "categorical",
          x: 0,
          y: 0,
          lng: 0,
          lat: 0,
          value: 1,
          label: "Forest",
          color: "#228844",
        }}
      />
    );
    expect(screen.getByText("Forest")).toBeInTheDocument();
    const swatch = screen.getByTestId("categorical-swatch");
    expect(swatch).toHaveStyle({ backgroundColor: "rgb(34, 136, 68)" });
  });
});
