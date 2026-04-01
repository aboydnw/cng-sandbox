import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConversionJob } from "../src/hooks/useConversionJob";
import { setWorkspaceId } from "../src/lib/api";

class MockEventSource {
  onerror: (() => void) | null = null;
  close = vi.fn();
  private listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }
  emit(type: string, event: MessageEvent) {
    for (const fn of this.listeners[type] || []) fn(event);
  }
  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
}

const mockFetch = vi.fn();

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  setWorkspaceId("test1234");
});

describe("useConversionJob", () => {
  it("starts with idle state", () => {
    const { result } = renderHook(() => useConversionJob());
    expect(result.current.state.jobId).toBeNull();
    expect(result.current.state.status).toBe("pending");
    expect(result.current.state.stages).toHaveLength(5);
    expect(
      result.current.state.stages.every((s) => s.status === "pending"),
    ).toBe(true);
  });

  it("uploads file and transitions to scanning", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/upload"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.state.jobId).toBe("j1");
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain("/api/jobs/j1/stream");
  });

  it("updates stages from SSE events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.emit(
        "status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "scanning" }),
        }),
      );
    });
    expect(result.current.state.status).toBe("scanning");
    expect(result.current.state.stages[0]).toMatchObject({
      name: "Uploading",
      status: "done",
    });
    expect(result.current.state.stages[1]).toMatchObject({
      name: "Scanning",
      status: "active",
    });

    act(() => {
      es.emit(
        "status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "converting" }),
        }),
      );
    });
    expect(result.current.state.status).toBe("converting");
    expect(result.current.state.stages[1]).toMatchObject({
      name: "Scanning",
      status: "done",
    });
    expect(result.current.state.stages[2]).toMatchObject({
      name: "Converting",
      status: "active",
    });
  });

  it("sets datasetId on ready", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
    });

    act(() => {
      MockEventSource.instances[0].emit(
        "status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "ready" }),
        }),
      );
    });

    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.datasetId).toBe("d1");
  });

  it("sets error on failed status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
    });

    act(() => {
      MockEventSource.instances[0].emit(
        "status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "failed", error: "Bad CRS" }),
        }),
      );
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.error).toBe("Bad CRS");
  });

  it("starts URL fetch with JSON body to /api/convert-url", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j2", dataset_id: "d2" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUrlFetch("https://example.com/data.tif");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/convert-url"),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.current.state.jobId).toBe("j2");
  });
});
