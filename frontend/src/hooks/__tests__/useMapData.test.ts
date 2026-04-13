import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMapData } from "../useMapData";

const mockWorkspaceFetch = vi.fn();

vi.mock("../../lib/api", () => ({
  workspaceFetch: (...args: unknown[]) => mockWorkspaceFetch(...args),
  connectionsApi: {
    get: vi.fn(),
  },
}));

import { connectionsApi } from "../../lib/api";
const mockConnectionsGet = vi.mocked(connectionsApi.get);

const MOCK_DATASET = {
  id: "ds-1",
  filename: "test.tif",
  dataset_type: "raster" as const,
  format_pair: "geotiff/cog",
  tile_url: "/raster/tiles/{z}/{x}/{y}",
  bounds: [-180, -90, 180, 90] as [number, number, number, number],
  band_count: 1,
  band_names: ["band1"],
  color_interpretation: ["gray"],
  raster_min: 0,
  raster_max: 255,
  cog_url: "https://r2.example.com/test.tif",
  parquet_url: null,
  min_zoom: null,
  max_zoom: null,
  is_temporal: false,
  timesteps: [],
  created_at: "2026-03-28T00:00:00Z",
  dtype: null,
  original_file_size: null,
  converted_file_size: null,
  geoparquet_file_size: null,
  feature_count: null,
  geometry_types: null,
  stac_collection_id: null,
  pg_table: null,
  validation_results: [],
  credits: [],
  crs: null,
  crs_name: null,
  pixel_width: null,
  pixel_height: null,
  resolution: null,
  compression: null,
};

const MOCK_CONNECTION = {
  id: "conn-1",
  name: "Sentinel-2",
  url: "https://example.com/scene.tif",
  connection_type: "cog" as const,
  bounds: [-10, -10, 10, 10] as [number, number, number, number],
  min_zoom: 0,
  max_zoom: 14,
  tile_type: "raster" as const,
  band_count: 1,
  rescale: "0,10000",
  workspace_id: "w1",
  created_at: "2026-03-28T00:00:00Z",
  is_categorical: false,
  categories: null,
};

beforeEach(() => {
  mockWorkspaceFetch.mockReset();
  mockConnectionsGet.mockReset();
});

describe("useMapData", () => {
  it("fetches and normalizes a dataset", async () => {
    mockWorkspaceFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_DATASET),
    });

    const { result } = renderHook(() => useMapData("ds-1", false));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.source).toBe("dataset");
    expect(result.current.data!.dataType).toBe("raster");
    expect(result.current.data!.name).toBe("test.tif");
    expect(result.current.data!.cogUrl).toBe("https://r2.example.com/test.tif");
    expect(result.current.data!.dataset).toEqual(MOCK_DATASET);
    expect(result.current.data!.connection).toBeNull();
  });

  it("fetches and normalizes a connection", async () => {
    mockConnectionsGet.mockResolvedValue(MOCK_CONNECTION);

    const { result } = renderHook(() => useMapData("conn-1", true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.source).toBe("connection");
    expect(result.current.data!.dataType).toBe("raster");
    expect(result.current.data!.name).toBe("Sentinel-2");
    expect(result.current.data!.connection).toEqual(MOCK_CONNECTION);
    expect(result.current.data!.dataset).toBeNull();
  });

  it("determines vector dataType for vector connections", async () => {
    mockConnectionsGet.mockResolvedValue({
      ...MOCK_CONNECTION,
      connection_type: "xyz_vector",
      tile_type: "vector",
    });

    const { result } = renderHook(() => useMapData("conn-2", true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data!.dataType).toBe("vector");
  });

  it("never marks a connection as expired", async () => {
    mockConnectionsGet.mockResolvedValue(MOCK_CONNECTION);
    const { result } = renderHook(() => useMapData("conn-1", true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isExpired).toBe(false);
  });

  it("determines vector dataType for pmtiles vector connections", async () => {
    mockConnectionsGet.mockResolvedValue({
      ...MOCK_CONNECTION,
      connection_type: "pmtiles",
      tile_type: "vector",
    });
    const { result } = renderHook(() => useMapData("conn-3", true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data!.dataType).toBe("vector");
  });

  it("defaults pmtiles with null tile_type to vector", async () => {
    mockConnectionsGet.mockResolvedValue({
      ...MOCK_CONNECTION,
      connection_type: "pmtiles",
      tile_type: null,
    });
    const { result } = renderHook(() => useMapData("conn-4", true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data!.dataType).toBe("vector");
  });

  it("returns error on fetch failure", async () => {
    mockWorkspaceFetch.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useMapData("ds-bad", false));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeNull();
  });

  it("refetches when id changes", async () => {
    mockWorkspaceFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_DATASET),
    });

    const { result, rerender } = renderHook(
      ({ id, isConn }) => useMapData(id, isConn),
      { initialProps: { id: "ds-1", isConn: false } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockWorkspaceFetch).toHaveBeenCalledTimes(1);

    rerender({ id: "ds-2", isConn: false });
    await waitFor(() => expect(mockWorkspaceFetch).toHaveBeenCalledTimes(2));
  });

  it("marks dataset as expired when fetch returns 404", async () => {
    mockWorkspaceFetch.mockResolvedValue({
      status: 404,
      ok: false,
    });

    const { result } = renderHook(() => useMapData("ds-expired", false));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isExpired).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("marks dataset as expired when created_at is older than 30 days", async () => {
    const sixtyDaysAgo = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000
    ).toISOString();

    mockWorkspaceFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...MOCK_DATASET,
          created_at: sixtyDaysAgo,
        }),
    });

    const { result } = renderHook(() => useMapData("ds-old", false));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isExpired).toBe(true);
    expect(result.current.data).toBeNull();
  });
});
