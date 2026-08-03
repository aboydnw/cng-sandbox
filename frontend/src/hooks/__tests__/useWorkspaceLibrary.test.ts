import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectionsApi, workspaceFetch } from "../../lib/api";
import {
  useWorkspaceConnections,
  useWorkspaceDatasets,
} from "../useWorkspaceLibrary";

vi.mock("../../lib/api", () => ({
  workspaceFetch: vi.fn(),
  connectionsApi: { list: vi.fn() },
}));

const dataset = {
  id: "dataset-1",
  name: "rain.tif",
  original_filename: "rain.tif",
  dataset_type: "raster" as const,
};

describe("workspace resource hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("does not turn a failed dataset response into an empty collection", async () => {
    vi.mocked(workspaceFetch).mockResolvedValue(
      new Response("failed", { status: 503 })
    );

    const { result } = renderHook(() => useWorkspaceDatasets());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe("HTTP 503");
  });

  it("preserves dataset data when a retry fails", async () => {
    vi.mocked(workspaceFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([dataset]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));

    const { result } = renderHook(() => useWorkspaceDatasets());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.data).toEqual([dataset]);
  });

  it("reports connection failures independently", async () => {
    vi.mocked(connectionsApi.list).mockRejectedValue(
      new Error("Connections unavailable")
    );

    const { result } = renderHook(() => useWorkspaceConnections());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Connections unavailable");
  });
});
