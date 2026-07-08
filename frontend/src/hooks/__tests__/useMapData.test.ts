import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useMapData,
  datasetToMapItem,
  connectionToMapItem,
} from "../useMapData";
import type { Dataset, Connection } from "../../types";

const mockWorkspaceFetch = vi.fn();

vi.mock("../../lib/api", () => ({
  workspaceFetch: (...args: unknown[]) => mockWorkspaceFetch(...args),
  connectionsApi: {
    get: vi.fn(),
  },
}));

import { connectionsApi } from "../../lib/api";
const mockConnectionsGet = vi.mocked(connectionsApi.get);

const MOCK_DATASET: Dataset = {
  id: "ds-1",
  filename: "test.tif",
  dataset_type: "raster",
  format_pair: "geotiff/cog",
  tile_url: "/raster/tiles/{z}/{x}/{y}",
  bounds: [-180, -90, 180, 90],
  band_count: 1,
  band_names: ["band1"],
  color_interpretation: ["gray"],
  raster_min: 0,
  raster_max: 255,
  cog_url: "https://r2.example.com/test.tif",
  copc_url: null,
  point_count: null,
  parquet_url: null,
  min_zoom: null,
  max_zoom: null,
  is_temporal: false,
  timesteps: [],
  created_at: new Date().toISOString(),
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
  is_categorical: false,
  categories: null,
  is_mosaic: false,
  is_zero_copy: false,
  is_shared: false,
  render_mode: null,
  source_url: null,
  expires_at: null,
  preferred_colormap: null,
  preferred_colormap_reversed: null,
};

const MOCK_CONNECTION: Connection = {
  id: "conn-1",
  name: "Sentinel-2",
  url: "https://example.com/scene.tif",
  connection_type: "cog",
  bounds: [-10, -10, 10, 10],
  min_zoom: 0,
  max_zoom: 14,
  tile_type: "raster",
  band_count: 1,
  rescale: "0,10000",
  workspace_id: "w1",
  created_at: new Date().toISOString(),
  is_categorical: false,
  categories: null,
  tile_url: null,
  render_path: null,
  conversion_status: null,
  conversion_error: null,
  feature_count: null,
  file_size: null,
  is_shared: false,
  render_mode: null,
  preferred_colormap: null,
  preferred_colormap_reversed: null,
  config: null,
  geozarr_attrs: null,
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

  it("treats geoparquet connections as vector data", async () => {
    mockConnectionsGet.mockResolvedValue({
      ...MOCK_CONNECTION,
      id: "conn-gp",
      name: "Parcels",
      url: "https://example.com/parcels.parquet",
      connection_type: "geoparquet",
      tile_type: null,
    });

    const { result } = renderHook(() => useMapData("conn-gp", true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data!.dataType).toBe("vector");
  });

  it("propagates dataset.dtype onto MapItem.dtype", async () => {
    mockWorkspaceFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...MOCK_DATASET,
          dtype: "uint8",
        }),
    });

    const { result } = renderHook(() => useMapData("ds-1", false));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.dtype).toBe("uint8");
  });
});

describe("datasetToMapItem", () => {
  it("coerces undefined render_mode to null", () => {
    expect(
      datasetToMapItem({ ...MOCK_DATASET, render_mode: undefined }).renderMode
    ).toBeNull();
  });
  it("propagates null render_mode", () => {
    expect(datasetToMapItem(MOCK_DATASET).renderMode).toBeNull();
  });
  it("propagates server render_mode", () => {
    expect(
      datasetToMapItem({ ...MOCK_DATASET, render_mode: "server" }).renderMode
    ).toBe("server");
  });
  it("propagates client render_mode", () => {
    expect(
      datasetToMapItem({ ...MOCK_DATASET, render_mode: "client" }).renderMode
    ).toBe("client");
  });
  it("copies preferred_colormap and preferred_colormap_reversed when set", () => {
    const item = datasetToMapItem({
      ...MOCK_DATASET,
      preferred_colormap: "terrain",
      preferred_colormap_reversed: false,
    });
    expect(item.preferredColormap).toBe("terrain");
    expect(item.preferredColormapReversed).toBe(false);
  });
  it("passes preferred_colormap nulls through", () => {
    const item = datasetToMapItem({
      ...MOCK_DATASET,
      preferred_colormap: null,
      preferred_colormap_reversed: null,
    });
    expect(item.preferredColormap).toBeNull();
    expect(item.preferredColormapReversed).toBeNull();
  });
});

describe("connectionToMapItem", () => {
  it("coerces undefined render_mode to null", () => {
    expect(
      connectionToMapItem({ ...MOCK_CONNECTION, render_mode: undefined })
        .renderMode
    ).toBeNull();
  });
  it("propagates null render_mode", () => {
    expect(connectionToMapItem(MOCK_CONNECTION).renderMode).toBeNull();
  });
  it("propagates server render_mode", () => {
    expect(
      connectionToMapItem({ ...MOCK_CONNECTION, render_mode: "server" })
        .renderMode
    ).toBe("server");
  });
  it("propagates client render_mode", () => {
    expect(
      connectionToMapItem({ ...MOCK_CONNECTION, render_mode: "client" })
        .renderMode
    ).toBe("client");
  });
  it("copies preferred_colormap and preferred_colormap_reversed when set", () => {
    const item = connectionToMapItem({
      ...MOCK_CONNECTION,
      preferred_colormap: "plasma",
      preferred_colormap_reversed: true,
    });
    expect(item.preferredColormap).toBe("plasma");
    expect(item.preferredColormapReversed).toBe(true);
  });

  it("propagates a well-formed geozarr_attrs override", () => {
    const attrs = {
      "spatial:dimensions": ["latitude", "longitude"] as [string, string],
      "spatial:transform": [0.1, 0, -180, 0, 0.1, -90] as [
        number,
        number,
        number,
        number,
        number,
        number,
      ],
      "spatial:shape": [1800, 3600] as [number, number],
      "proj:code": "EPSG:4326",
    };
    const item = connectionToMapItem({
      ...MOCK_CONNECTION,
      connection_type: "zarr",
      geozarr_attrs: attrs,
    });
    expect(item.geozarrAttrs).toEqual(attrs);
  });

  it("normalizes a malformed geozarr_attrs to null", () => {
    const item = connectionToMapItem({
      ...MOCK_CONNECTION,
      connection_type: "zarr",
      geozarr_attrs: {
        "spatial:dimensions": ["latitude"],
        "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
        "spatial:shape": [1800, 3600],
        "proj:code": "EPSG:4326",
      } as never,
    });
    expect(item.geozarrAttrs).toBeNull();
  });

  describe("connectionToMapItem zarr handling", () => {
    function makeZarrConn(config: unknown): import("../../types").Connection {
      return {
        id: "z1",
        name: "test zarr",
        url: "https://example.com/x.zarr",
        connection_type: "zarr",
        bounds: null,
        min_zoom: null,
        max_zoom: null,
        tile_type: "raster",
        band_count: null,
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
        preferred_colormap: null,
        preferred_colormap_reversed: null,
        config: config as Record<string, unknown> | null,
        created_at: "2026-01-01T00:00:00Z",
      } as import("../../types").Connection;
    }

    it("sets bandCount=1 so the colormap picker UI shows", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "t2m",
          rescaleMin: 200,
          rescaleMax: 320,
        })
      );
      expect(item.bandCount).toBe(1);
      expect(item.dataType).toBe("raster");
    });

    it("populates rasterMin and rasterMax from config rescale fields", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "t2m",
          rescaleMin: 200,
          rescaleMax: 320,
        })
      );
      expect(item.rasterMin).toBe(200);
      expect(item.rasterMax).toBe(320);
    });

    it("flags isTemporal=true and builds timesteps when timesteps are present", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "t2m",
          timeDim: "time",
          timesteps: [
            { datetime: "2024-01-01T00:00:00Z", index: 0 },
            { datetime: "2024-01-02T00:00:00Z", index: 1 },
          ],
          rescaleMin: 200,
          rescaleMax: 320,
        })
      );
      expect(item.isTemporal).toBe(true);
      expect(item.timesteps).toEqual([
        { datetime: "2024-01-01T00:00:00Z", index: 0 },
        { datetime: "2024-01-02T00:00:00Z", index: 1 },
      ]);
    });

    it("uses zarr indices from decimated timesteps as the temporal slot indices", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "rain",
          timeDim: "time",
          timesteps: [
            { datetime: "2020-01-01T00:00:00.000Z", index: 0 },
            { datetime: "2020-01-08T00:00:00.000Z", index: 7 },
            { datetime: "2020-01-15T00:00:00.000Z", index: 14 },
          ],
          rescaleMin: 0,
          rescaleMax: 100,
        })
      );
      expect(item.isTemporal).toBe(true);
      expect(item.timesteps).toEqual([
        { datetime: "2020-01-01T00:00:00.000Z", index: 0 },
        { datetime: "2020-01-08T00:00:00.000Z", index: 7 },
        { datetime: "2020-01-15T00:00:00.000Z", index: 14 },
      ]);
    });

    it("leaves isTemporal=false when timeDim is absent", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "elev",
          rescaleMin: 0,
          rescaleMax: 1000,
        })
      );
      expect(item.isTemporal).toBe(false);
      expect(item.timesteps).toEqual([]);
    });

    it("handles a null config gracefully (defaults to non-temporal, null rescale)", () => {
      const item = connectionToMapItem(makeZarrConn(null));
      expect(item.isTemporal).toBe(false);
      expect(item.timesteps).toEqual([]);
      expect(item.rasterMin).toBeNull();
      expect(item.rasterMax).toBeNull();
    });

    it("falls back to legacy timeValues when timesteps are absent", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "t2m",
          timeDim: "time",
          timeValues: ["2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z"],
          rescaleMin: 200,
          rescaleMax: 320,
        })
      );
      expect(item.isTemporal).toBe(true);
      expect(item.timesteps).toEqual([
        { datetime: "2024-01-01T00:00:00Z", index: 0 },
        { datetime: "2024-01-02T00:00:00Z", index: 1 },
      ]);
    });

    it("preserves original positions when legacy timeValues contain non-string holes", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "t2m",
          timeDim: "time",
          timeValues: [
            "2024-01-01T00:00:00Z",
            null as unknown as string,
            "2024-01-03T00:00:00Z",
          ],
          rescaleMin: 200,
          rescaleMax: 320,
        })
      );
      expect(item.timesteps).toEqual([
        { datetime: "2024-01-01T00:00:00Z", index: 0 },
        { datetime: "2024-01-03T00:00:00Z", index: 2 },
      ]);
    });

    it("rejects timestep entries with non-integer or negative indices", () => {
      const item = connectionToMapItem(
        makeZarrConn({
          variable: "rain",
          timeDim: "time",
          timesteps: [
            { datetime: "2020-01-01T00:00:00.000Z", index: 0 },
            { datetime: "bad-float", index: 1.5 },
            { datetime: "bad-negative", index: -1 },
            { datetime: "2020-01-15T00:00:00.000Z", index: 14 },
          ],
          rescaleMin: 0,
          rescaleMax: 100,
        })
      );
      expect(item.timesteps).toEqual([
        { datetime: "2020-01-01T00:00:00.000Z", index: 0 },
        { datetime: "2020-01-15T00:00:00.000Z", index: 14 },
      ]);
    });
  });
});
