import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { MapItem, Connection } from "../../types";
import { useZarrNode } from "../useZarrNode";

// Mock zarrita: open() resolves to a stand-in group; withMaybeConsolidatedMetadata
// passes through.
vi.mock("zarrita", () => ({
  open: vi.fn(),
  withMaybeConsolidatedMetadata: vi.fn(async (s: unknown) => s),
}));

// Mock createZarrStore so we don't hit the network.
vi.mock("../../lib/zarr/zarrFetch", () => ({
  createZarrStore: vi.fn((url: string) => ({ url })),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importMocks(): Promise<{ open: any; createZarrStore: any }> {
  const zarrita = await import("zarrita");
  const fetchMod = await import("../../lib/zarr/zarrFetch");
  return {
    open: zarrita.open as unknown as ReturnType<typeof vi.fn>,
    createZarrStore: fetchMod.createZarrStore as unknown as ReturnType<
      typeof vi.fn
    >,
  };
}

function makeZarrItem(url: string): MapItem {
  const conn = {
    id: "c1",
    name: "test zarr",
    url,
    connection_type: "zarr",
    bounds: null,
    min_zoom: null,
    max_zoom: null,
    tile_type: "raster",
    band_count: 1,
    rescale: null,
    workspace_id: null,
    is_categorical: false,
    categories: null,
    tile_url: null,
    render_path: "client",
    conversion_status: null,
    conversion_error: null,
    feature_count: null,
    file_size: null,
    is_shared: false,
    config: null,
    created_at: "2026-01-01T00:00:00Z",
  } as unknown as Connection;
  return {
    id: "c1",
    name: "test zarr",
    source: "connection",
    dataType: "raster",
    tileUrl: "",
    bounds: null,
    minZoom: null,
    maxZoom: null,
    bandCount: 1,
    bandNames: null,
    colorInterpretation: null,
    dtype: null,
    rasterMin: null,
    rasterMax: null,
    isCategorical: false,
    categories: null,
    cogUrl: null,
    crs: null,
    rescale: null,
    parquetUrl: null,
    isTemporal: false,
    timesteps: [],
    renderMode: "client",
    preferredColormap: null,
    preferredColormapReversed: null,
    dataset: null,
    connection: conn,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useZarrNode", () => {
  it("returns { node: null, isLoading: false, error: null } for a null item", async () => {
    const { result } = renderHook(() => useZarrNode(null));
    expect(result.current.node).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns { node: null, isLoading: false, error: null } for non-zarr connections", async () => {
    const item = makeZarrItem("https://example.com/z.zarr");
    item.connection!.connection_type = "cog";
    const { result } = renderHook(() => useZarrNode(item));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.node).toBeNull();
  });

  it("opens the store and returns the node on success", async () => {
    const { open } = await importMocks();
    const fakeNode = { __isGroup: true };
    open.mockResolvedValueOnce(fakeNode);

    const item = makeZarrItem("https://example.com/a.zarr");
    const { result } = renderHook(() => useZarrNode(item));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.node).toBe(fakeNode);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error message when zarrita throws", async () => {
    const { open } = await importMocks();
    open.mockRejectedValueOnce(new Error("boom"));

    const item = makeZarrItem("https://example.com/b.zarr");
    const { result } = renderHook(() => useZarrNode(item));

    await waitFor(() => {
      expect(result.current.error).toBe("boom");
    });
    expect(result.current.node).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("re-opens on URL change", async () => {
    const { open } = await importMocks();
    const a = { __id: "a" };
    const b = { __id: "b" };
    open.mockResolvedValueOnce(a).mockResolvedValueOnce(b);

    const itemA = makeZarrItem("https://example.com/a.zarr");
    const itemB = makeZarrItem("https://example.com/b.zarr");
    const { result, rerender } = renderHook(({ item }) => useZarrNode(item), {
      initialProps: { item: itemA },
    });
    await waitFor(() => expect(result.current.node).toBe(a));

    act(() => {
      rerender({ item: itemB });
    });
    await waitFor(() => expect(result.current.node).toBe(b));
  });

  it("ignores stale results when a new URL supersedes an in-flight open", async () => {
    const { open } = await importMocks();
    let resolveA: (v: unknown) => void = () => {};
    const a = { __id: "a" };
    const b = { __id: "b" };
    open.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveA = res;
        })
    );
    open.mockResolvedValueOnce(b);

    const itemA = makeZarrItem("https://example.com/a.zarr");
    const itemB = makeZarrItem("https://example.com/b.zarr");
    const { result, rerender } = renderHook(({ item }) => useZarrNode(item), {
      initialProps: { item: itemA },
    });

    rerender({ item: itemB });
    await waitFor(() => expect(result.current.node).toBe(b));

    // Now late-resolve the stale A. We expect b to remain.
    resolveA(a);
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.node).toBe(b);
  });
});
