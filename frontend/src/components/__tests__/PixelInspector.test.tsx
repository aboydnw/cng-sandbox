import { describe, it, expect } from "vitest";
import {
  render,
  screen,
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { usePixelInspector, CategoricalPixelTooltip } from "../PixelInspector";

function renderWithProvider(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

function hoverInfo(opts: {
  coordinate: [number, number];
  x: number;
  y: number;
  tileX?: number;
  tileY?: number;
  tileBounds?: [number, number, number, number];
  raw?: ArrayLike<number>;
  width?: number;
  height?: number;
}) {
  const {
    coordinate,
    x,
    y,
    tileX = 0,
    tileY = 0,
    tileBounds = [-10, -10, 10, 10],
    raw = new Float32Array([1, 2, 3, 4]),
    width = 2,
    height = 2,
  } = opts;
  const [minX, minY, maxX, maxY] = tileBounds;
  return {
    coordinate,
    x,
    y,
    sourceTile: {
      index: { x: tileX, y: tileY, z: 0 },
      boundingBox: [
        [minX, minY],
        [maxX, maxY],
      ] as [number[], number[]],
      content: { data: { raw, width, height } },
    },
  };
}

describe("usePixelInspector categorical branch", () => {
  it("returns categorical hover info when categories provided and value matches", async () => {
    const cats = [
      { value: 1, color: "#ff0000", label: "A" },
      { value: 2, color: "#00ff00", label: "B" },
    ];
    const { result } = renderHook(() => usePixelInspector(null, cats));
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
    const { result } = renderHook(() => usePixelInspector(null, cats));
    act(() => {
      result.current.onHover(hoverInfo({ coordinate: [-5, 5], x: 0, y: 0 }));
    });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(result.current.hoverInfo).toBeNull();
  });

  it("keeps numeric behavior when categories is undefined", async () => {
    const { result } = renderHook(() => usePixelInspector(null));
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
    const { result } = renderHook(() => usePixelInspector(null));
    act(() => {
      result.current.onHover({ coordinate: [-5, 5], x: 0, y: 0 });
    });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(result.current.hoverInfo).toBeNull();
  });

  it("returns null without throwing when sourceTile has no bounds", async () => {
    const { result } = renderHook(() => usePixelInspector(null));
    act(() => {
      result.current.onHover({
        coordinate: [-5, 5],
        x: 0,
        y: 0,
        sourceTile: {
          index: { x: 0, y: 0, z: 0 },
          content: {
            data: { raw: new Float32Array([1, 2, 3, 4]), width: 2, height: 2 },
          },
        },
      });
    });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(result.current.hoverInfo).toBeNull();
  });

  it("reads extent from legacy bbox object when boundingBox is absent", async () => {
    const cats = [{ value: 1, color: "#f00", label: "One" }];
    const { result } = renderHook(() => usePixelInspector(null, cats));
    act(() => {
      result.current.onHover({
        coordinate: [-5, 5],
        x: 10,
        y: 20,
        sourceTile: {
          index: { x: 0, y: 0, z: 0 },
          bbox: { west: -10, south: -10, east: 10, north: 10 },
          content: {
            data: { raw: new Float32Array([1, 1, 1, 1]), width: 2, height: 2 },
          },
        },
      });
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({
        kind: "categorical",
        label: "One",
      });
    });
  });

  it("samples from the hovered tile's own data, not a shared cache", async () => {
    const cats = [
      { value: 1, color: "#f00", label: "One" },
      { value: 2, color: "#0f0", label: "Two" },
    ];
    const { result } = renderHook(() => usePixelInspector(null, cats));
    // Tile 1/0 has data that is entirely value 2 — inspector must read it,
    // not a stale entry keyed by a neighbouring tile.
    act(() => {
      result.current.onHover(
        hoverInfo({
          coordinate: [15, 5],
          x: 0,
          y: 0,
          tileX: 1,
          tileY: 0,
          tileBounds: [10, -10, 30, 10],
          raw: new Float32Array([2, 2, 2, 2]),
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

  it("clamps coordinates exactly on the east edge to the last pixel", async () => {
    const cats = [
      { value: 1, color: "#f00", label: "One" },
      { value: 9, color: "#0f0", label: "Nine" },
    ];
    const { result } = renderHook(() => usePixelInspector(null, cats));
    act(() => {
      // lng=10 (exactly east), lat=-10 (exactly south) → would compute px=2,
      // py=2 (out of bounds in a 2x2 tile) unless clamped. Raw[3] = 9 → Nine.
      result.current.onHover(
        hoverInfo({
          coordinate: [10, -10],
          x: 0,
          y: 0,
          raw: new Float32Array([1, 1, 1, 9]),
        })
      );
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({
        kind: "categorical",
        label: "Nine",
      });
    });
  });
});

describe("usePixelInspector projection-aware sampling", () => {
  // 2x2 raw grid, value layout in source-CRS pixel space:
  //   raw[0]=10 (col=0,row=0)  raw[1]=20 (col=1,row=0)
  //   raw[2]=30 (col=0,row=1)  raw[3]=40 (col=1,row=1)
  // The fake projector + inverse below maps the cursor to a known pixel so we
  // can assert the inspector reads through the projection-aware path, not the
  // lng/lat-linear fallback.
  function projectionAwareTile(opts: {
    raw: ArrayLike<number>;
    width: number;
    height: number;
    projectFrom4326: ProjectFn;
    inverseTransform: InverseFn;
    boundingBox?: [number[], number[]];
  }) {
    return {
      index: { x: 0, y: 0, z: 0 },
      // Wrong/loose lng/lat AABB on purpose — if the inspector falls back to
      // the linear path it will pick a different pixel and the test fails.
      boundingBox: opts.boundingBox ?? [
        [-180, -85],
        [180, 85],
      ],
      content: {
        inverseTransform: opts.inverseTransform,
        data: {
          raw: opts.raw,
          width: opts.width,
          height: opts.height,
          projectFrom4326: opts.projectFrom4326,
        },
      },
    };
  }

  type ProjectFn = (lng: number, lat: number) => [number, number];
  type InverseFn = (x: number, y: number) => [number, number];

  it("samples through projectFrom4326 + inverseTransform when both are present", async () => {
    // Mock projector: passthrough lng→x, lat→y. Inverse maps [x,y] in [-1, 1]
    // square to a 2x2 pixel grid. Cursor (lng=0.5, lat=-0.5) → src (0.5, -0.5)
    // → pixel (1.5, 1.5) → row=1, col=1 → raw[3]=40.
    const projectFrom4326: ProjectFn = (lng, lat) => [lng, lat];
    const inverseTransform: InverseFn = (x, y) => [x + 1, 1 - y];

    const { result } = renderHook(() => usePixelInspector(null));
    act(() => {
      result.current.onHover({
        coordinate: [0.5, -0.5],
        x: 0,
        y: 0,
        sourceTile: projectionAwareTile({
          raw: new Float32Array([10, 20, 30, 40]),
          width: 2,
          height: 2,
          projectFrom4326,
          inverseTransform,
        }),
      });
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({
        kind: "numeric",
        value: 40,
      });
    });
  });

  it("returns null when projectFrom4326 maps the cursor outside the tile pixel grid", async () => {
    // Cursor projects to pixel (5, 5) — well outside the 2x2 grid.
    const projectFrom4326: ProjectFn = (lng, lat) => [lng, lat];
    const inverseTransform: InverseFn = (x, y) => [x + 4, y + 4];

    const { result } = renderHook(() => usePixelInspector(null));
    act(() => {
      result.current.onHover({
        coordinate: [0, 0],
        x: 0,
        y: 0,
        sourceTile: projectionAwareTile({
          raw: new Float32Array([1, 2, 3, 4]),
          width: 2,
          height: 2,
          projectFrom4326,
          inverseTransform,
        }),
      });
    });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(result.current.hoverInfo).toBeNull();
  });

  it("returns null when projectFrom4326 yields NaN (e.g. cursor outside CRS domain)", async () => {
    const projectFrom4326: ProjectFn = () => [NaN, NaN];
    const inverseTransform: InverseFn = (x, y) => [x, y];

    const { result } = renderHook(() => usePixelInspector(null));
    act(() => {
      result.current.onHover({
        coordinate: [0, 0],
        x: 0,
        y: 0,
        sourceTile: projectionAwareTile({
          raw: new Float32Array([1, 2, 3, 4]),
          width: 2,
          height: 2,
          projectFrom4326,
          inverseTransform,
        }),
      });
    });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(result.current.hoverInfo).toBeNull();
  });

  it("falls back to lng/lat-linear when projectFrom4326 is null (server-tile path)", async () => {
    // No projector → must fall back. Tile bbox covers [-10, 10] × [-10, 10],
    // cursor at (-5, 5) → pixel (0, 0) → raw[0] = 1.
    const { result } = renderHook(() => usePixelInspector(null));
    act(() => {
      result.current.onHover({
        coordinate: [-5, 5],
        x: 0,
        y: 0,
        sourceTile: {
          index: { x: 0, y: 0, z: 0 },
          boundingBox: [
            [-10, -10],
            [10, 10],
          ] as [number[], number[]],
          content: {
            data: {
              raw: new Float32Array([1, 2, 3, 4]),
              width: 2,
              height: 2,
              projectFrom4326: null,
            },
          },
        },
      });
    });
    await waitFor(() => {
      expect(result.current.hoverInfo).toMatchObject({
        kind: "numeric",
        value: 1,
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
