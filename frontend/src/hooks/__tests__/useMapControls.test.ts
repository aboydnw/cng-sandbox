import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapControls } from "../useMapControls";
import type { MapItem } from "../../types";

function makeItem(overrides: Partial<MapItem> = {}): MapItem {
  return {
    id: "test-1",
    name: "test",
    source: "dataset",
    dataType: "raster",
    tileUrl: "/tiles/{z}/{x}/{y}",
    bounds: null,
    minZoom: null,
    maxZoom: null,
    bandCount: 1,
    bandNames: ["band1"],
    colorInterpretation: ["gray"],
    dtype: null,
    rasterMin: 0,
    rasterMax: 255,
    isCategorical: false,
    categories: null,
    cogUrl: null,
    crs: null,
    rescale: null,
    parquetUrl: null,
    isTemporal: false,
    timesteps: [],
    renderMode: null,
    dataset: null,
    connection: null,
    ...overrides,
  };
}

describe("useMapControls", () => {
  it("initializes with default values", () => {
    const { result } = renderHook(() => useMapControls(makeItem()));
    expect(result.current.opacity).toBe(0.8);
    expect(result.current.colormapName).toBe("viridis");
    expect(result.current.selectedBand).toBe("rgb");
    expect(result.current.renderMode).toBe("server");
  });

  it("initializes renderMode to vector-tiles for vector data", () => {
    const { result } = renderHook(() =>
      useMapControls(makeItem({ dataType: "vector" }))
    );
    expect(result.current.renderMode).toBe("vector-tiles");
  });

  it("resets state when item id changes", () => {
    const item1 = makeItem({ id: "a" });
    const item2 = makeItem({ id: "b" });
    const { result, rerender } = renderHook(
      ({ item }) => useMapControls(item),
      { initialProps: { item: item1 } }
    );
    act(() => result.current.setOpacity(0.5));
    expect(result.current.opacity).toBe(0.5);
    rerender({ item: item2 });
    expect(result.current.opacity).toBe(0.8);
  });

  it("updates opacity via setter", () => {
    const { result } = renderHook(() => useMapControls(makeItem()));
    act(() => result.current.setOpacity(0.3));
    expect(result.current.opacity).toBe(0.3);
  });

  it("updates colormap via setter", () => {
    const { result } = renderHook(() => useMapControls(makeItem()));
    act(() => result.current.setColormapName("plasma"));
    expect(result.current.colormapName).toBe("plasma");
  });

  it("computes canClientRender correctly", () => {
    const withCog = makeItem({
      cogUrl: "https://example.com/file.tif",
      bounds: [-10, -10, 10, 10],
      isTemporal: false,
    });
    const { result } = renderHook(() => useMapControls(withCog));
    expect(result.current.canClientRender).toBe(true);
  });

  it("disables client render for temporal datasets", () => {
    const temporal = makeItem({
      cogUrl: "https://example.com/file.tif",
      bounds: [-10, -10, 10, 10],
      isTemporal: true,
    });
    const { result } = renderHook(() => useMapControls(temporal));
    expect(result.current.canClientRender).toBe(false);
  });

  it("computes band-related derived values", () => {
    const multiBand = makeItem({
      bandCount: 3,
      bandNames: ["red", "green", "blue"],
      colorInterpretation: ["red", "green", "blue"],
    });
    const { result } = renderHook(() => useMapControls(multiBand));
    expect(result.current.isMultiBand).toBe(true);
    expect(result.current.isSingleBand).toBe(false);
    expect(result.current.hasRgb).toBe(true);
    expect(result.current.selectableBands).toHaveLength(3);
  });

  it("detects categorical datasets", () => {
    const item = makeItem({
      isCategorical: true,
      categories: [
        { value: 1, color: "#FF0000", label: "Class 1" },
        { value: 2, color: "#00FF00", label: "Class 2" },
      ],
    });
    const { result } = renderHook(() => useMapControls(item));
    expect(result.current.isCategorical).toBe(true);
    expect(result.current.showingColormap).toBe(false);
  });

  it("allows overriding categorical to continuous", () => {
    const item = makeItem({
      isCategorical: true,
      categories: [{ value: 1, color: "#FF0000", label: "Class 1" }],
    });
    const { result } = renderHook(() => useMapControls(item));
    expect(result.current.isCategorical).toBe(true);
    act(() => result.current.setCategoricalOverride(false));
    expect(result.current.isCategorical).toBe(false);
    expect(result.current.showingColormap).toBe(true);
  });

  it("resets categorical override on item change", () => {
    const item1 = makeItem({
      id: "cat-a",
      isCategorical: true,
      categories: [{ value: 1, color: "#FF0000", label: "Class 1" }],
    });
    const item2 = makeItem({ id: "cont-b", isCategorical: false });
    const { result, rerender } = renderHook(
      ({ item }) => useMapControls(item),
      { initialProps: { item: item1 } }
    );
    act(() => result.current.setCategoricalOverride(false));
    expect(result.current.isCategorical).toBe(false);
    rerender({ item: item2 });
    expect(result.current.isCategorical).toBe(false);
  });

  it("defaults rescale overrides to null and colormapReversed to false", () => {
    const { result } = renderHook(() => useMapControls(makeItem()));
    expect(result.current.rescaleMin).toBeNull();
    expect(result.current.rescaleMax).toBeNull();
    expect(result.current.colormapReversed).toBe(false);
  });

  it("updates rescale overrides via setter", () => {
    const { result } = renderHook(() => useMapControls(makeItem()));
    act(() => result.current.setRescale(10, 200));
    expect(result.current.rescaleMin).toBe(10);
    expect(result.current.rescaleMax).toBe(200);
    act(() => result.current.setRescale(null, null));
    expect(result.current.rescaleMin).toBeNull();
    expect(result.current.rescaleMax).toBeNull();
  });

  it("toggles colormapReversed", () => {
    const { result } = renderHook(() => useMapControls(makeItem()));
    act(() => result.current.setColormapReversed(true));
    expect(result.current.colormapReversed).toBe(true);
  });

  it("resets overrides when item id changes", () => {
    const { result, rerender } = renderHook(
      ({ item }) => useMapControls(item),
      { initialProps: { item: makeItem({ id: "a" }) } }
    );
    act(() => result.current.setRescale(1, 2));
    act(() => result.current.setColormapReversed(true));
    rerender({ item: makeItem({ id: "b" }) });
    expect(result.current.rescaleMin).toBeNull();
    expect(result.current.rescaleMax).toBeNull();
    expect(result.current.colormapReversed).toBe(false);
  });

  it("seeds overrides from initialOverrides when item id matches", () => {
    const item = makeItem({ id: "a" });
    const { result } = renderHook(() =>
      useMapControls(item, {
        itemId: "a",
        rescaleMin: 5,
        rescaleMax: 50,
        colormapReversed: true,
      })
    );
    expect(result.current.rescaleMin).toBe(5);
    expect(result.current.rescaleMax).toBe(50);
    expect(result.current.colormapReversed).toBe(true);
  });

  it("enables client render for a small COG connection", () => {
    const conn = makeItem({
      source: "connection",
      cogUrl: "https://example.com/file.tif",
      bounds: [-10, -10, 10, 10],
      isTemporal: false,
      connection: {
        id: "c1",
        name: "c",
        url: "https://example.com/file.tif",
        connection_type: "cog",
        bounds: [-10, -10, 10, 10],
        min_zoom: null,
        max_zoom: null,
        tile_type: "raster",
        band_count: 1,
        rescale: "0,255",
        workspace_id: null,
        is_categorical: false,
        categories: null,
        tile_url: null,
        render_path: null,
        conversion_status: null,
        conversion_error: null,
        feature_count: null,
        file_size: 10 * 1024 * 1024, // 10 MB
        created_at: "2026-04-17T00:00:00Z",
        is_shared: false,
      },
    });
    const { result } = renderHook(() => useMapControls(conn));
    expect(result.current.canClientRender).toBe(true);
  });

  it("disables client render for an oversize COG connection", () => {
    const conn = makeItem({
      source: "connection",
      cogUrl: "https://example.com/file.tif",
      bounds: [-10, -10, 10, 10],
      isTemporal: false,
      connection: {
        id: "c2",
        name: "c",
        url: "https://example.com/file.tif",
        connection_type: "cog",
        bounds: [-10, -10, 10, 10],
        min_zoom: null,
        max_zoom: null,
        tile_type: "raster",
        band_count: 1,
        rescale: null,
        workspace_id: null,
        is_categorical: false,
        categories: null,
        tile_url: null,
        render_path: null,
        conversion_status: null,
        conversion_error: null,
        feature_count: null,
        file_size: 10 * 1024 * 1024 * 1024, // 10 GB
        created_at: "2026-04-17T00:00:00Z",
        is_shared: false,
      },
    });
    const { result } = renderHook(() => useMapControls(conn));
    expect(result.current.canClientRender).toBe(false);
    expect(result.current.clientRenderDisabledReason).toContain("exceeds");
  });

  it("disables client render for a COG connection with unknown file size", () => {
    const conn = makeItem({
      source: "connection",
      cogUrl: "https://example.com/file.tif",
      bounds: [-10, -10, 10, 10],
      isTemporal: false,
      connection: {
        id: "c3",
        name: "c",
        url: "https://example.com/file.tif",
        connection_type: "cog",
        bounds: [-10, -10, 10, 10],
        min_zoom: null,
        max_zoom: null,
        tile_type: "raster",
        band_count: 1,
        rescale: null,
        workspace_id: null,
        is_categorical: false,
        categories: null,
        tile_url: null,
        render_path: null,
        conversion_status: null,
        conversion_error: null,
        feature_count: null,
        file_size: null,
        created_at: "2026-04-17T00:00:00Z",
        is_shared: false,
      },
    });
    const { result } = renderHook(() => useMapControls(conn));
    expect(result.current.canClientRender).toBe(false);
    expect(result.current.clientRenderDisabledReason).toContain("unavailable");
  });
});

describe("client render size caps", () => {
  function itemWithSize(
    size: number,
    overrides: Partial<MapItem> = {}
  ): MapItem {
    return {
      id: "test-1",
      name: "test",
      source: "dataset",
      dataType: "raster",
      tileUrl: "/tiles/{z}/{x}/{y}",
      bounds: [-125, 24, -66, 49],
      minZoom: null,
      maxZoom: null,
      bandCount: 1,
      bandNames: ["band1"],
      colorInterpretation: ["gray"],
      dtype: "uint8",
      rasterMin: 0,
      rasterMax: 255,
      isCategorical: true,
      categories: null,
      cogUrl: "/cog/large.tif",
      crs: null,
      rescale: null,
      parquetUrl: null,
      isTemporal: false,
      timesteps: [],
      renderMode: null,
      dataset: {
        id: "ds-1",
        filename: "large.tif",
        data_type: "raster",
        status: "ready",
        tile_url: "/tiles/{z}/{x}/{y}",
        cog_url: "/cog/large.tif",
        parquet_url: null,
        bounds: [-125, 24, -66, 49],
        converted_file_size: size,
      } as unknown as MapItem["dataset"],
      connection: null,
      ...overrides,
    };
  }

  it("allows 1.5 GB for uint8 paletted COGs", () => {
    const item = itemWithSize(1_500 * 1024 * 1024);
    const { result } = renderHook(() => useMapControls(item));
    expect(result.current.canClientRender).toBe(true);
    expect(result.current.clientRenderDisabledReason).toBeNull();
  });

  it("blocks above 2 GB for uint8 paletted COGs with a size-specific message", () => {
    const item = itemWithSize(2_500 * 1024 * 1024);
    const { result } = renderHook(() => useMapControls(item));
    expect(result.current.canClientRender).toBe(false);
    expect(result.current.clientRenderDisabledReason).toMatch(/2\.0 GB/);
  });

  it("allows 400 MB for float32 COGs", () => {
    const item = itemWithSize(400 * 1024 * 1024, {
      dtype: "float32",
      isCategorical: false,
    });
    const { result } = renderHook(() => useMapControls(item));
    expect(result.current.canClientRender).toBe(true);
  });

  it("blocks above 500 MB for float32 COGs with a size-specific message", () => {
    const item = itemWithSize(600 * 1024 * 1024, {
      dtype: "float32",
      isCategorical: false,
    });
    const { result } = renderHook(() => useMapControls(item));
    expect(result.current.canClientRender).toBe(false);
    expect(result.current.clientRenderDisabledReason).toMatch(/500\.0 MB/);
  });

  it("treats null dtype as continuous (500 MB cap)", () => {
    const item = itemWithSize(600 * 1024 * 1024, {
      dtype: null,
      isCategorical: false,
    });
    const { result } = renderHook(() => useMapControls(item));
    expect(result.current.canClientRender).toBe(false);
    expect(result.current.clientRenderDisabledReason).toMatch(/500\.0 MB/);
  });
});
