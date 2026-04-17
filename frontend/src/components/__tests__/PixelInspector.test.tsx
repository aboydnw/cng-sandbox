import { describe, it, expect } from "vitest";
import { render, screen, renderHook, act, waitFor } from "@testing-library/react";
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
