import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTripsLayer } from "../useTripsLayer";

const TRACKS = [
  {
    trajectory_id: "a",
    path: [
      [0, 0],
      [1, 1],
    ],
    timestamps: [0, 10],
    speeds: [0, 5],
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => TRACKS }))
  );
});

describe("useTripsLayer", () => {
  it("fetches tracks and builds a layer", async () => {
    const { result, rerender } = renderHook(
      ({ t }) => useTripsLayer("/storage/trips.json", t),
      { initialProps: { t: 0 } }
    );
    await waitFor(() => expect(result.current.tracks).not.toBeNull());
    expect(result.current.layer).not.toBeNull();
    act(() => rerender({ t: 8 }));
    expect(result.current.layer?.props.currentTime).toBe(8);
  });

  it("returns null layer and no crash when url is null", () => {
    const { result } = renderHook(() => useTripsLayer(null, 0));
    expect(result.current.layer).toBeNull();
  });
});
