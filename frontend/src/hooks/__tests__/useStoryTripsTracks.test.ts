import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStoryTripsTracks } from "../useStoryTripsTracks";
import type { Dataset } from "../../types";

const TRACKS = [
  {
    trajectory_id: "a",
    path: [
      [0, 0],
      [1, 1],
    ],
    timestamps: [100, 900],
    speeds: [1, 2],
  },
];

function makeTrajectory(id: string, trips_url: string | null): Dataset {
  return {
    id,
    dataset_type: "trajectory",
    trips_url,
  } as unknown as Dataset;
}

function makeRaster(id: string): Dataset {
  return { id, dataset_type: "raster", trips_url: null } as unknown as Dataset;
}

describe("useStoryTripsTracks", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => TRACKS }))
    );
  });

  it("fetches only trajectory datasets with a trips_url", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const { result } = renderHook(() =>
      useStoryTripsTracks([
        makeTrajectory("t1", "/storage/t1/trips.json"),
        makeRaster("r1"),
        makeTrajectory("t2", null),
      ])
    );
    await waitFor(() => expect(result.current.tracksByDatasetId.size).toBe(1));
    expect(result.current.tracksByDatasetId.has("t1")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes [min, max] bounds across track timestamps", async () => {
    const { result } = renderHook(() =>
      useStoryTripsTracks([makeTrajectory("t1", "/storage/t1/trips.json")])
    );
    await waitFor(() => expect(result.current.boundsByDatasetId.size).toBe(1));
    expect(result.current.boundsByDatasetId.get("t1")).toEqual([100, 900]);
  });

  it("dedupes repeated dataset ids into a single fetch", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const ds = makeTrajectory("t1", "/storage/t1/trips.json");
    const { result } = renderHook(() => useStoryTripsTracks([ds, ds]));
    await waitFor(() => expect(result.current.tracksByDatasetId.size).toBe(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sets error on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );
    const { result } = renderHook(() =>
      useStoryTripsTracks([makeTrajectory("t1", "/storage/t1/trips.json")])
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("returns empty maps when there are no trajectory datasets", () => {
    const { result } = renderHook(() =>
      useStoryTripsTracks([makeRaster("r1")])
    );
    expect(result.current.tracksByDatasetId.size).toBe(0);
    expect(result.current.loading).toBe(false);
  });
});
