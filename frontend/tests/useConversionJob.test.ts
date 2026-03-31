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

class MockXHR {
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 200;
  responseText = "";
  private _headers: Record<string, string> = {};
  open = vi.fn();
  setRequestHeader = vi.fn((k: string, v: string) => {
    this._headers[k] = v;
  });
  send = vi.fn();
  resolve(responseBody: unknown) {
    this.status = 200;
    this.responseText = JSON.stringify(responseBody);
    this.onload?.();
  }
  reject(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
  static instances: MockXHR[] = [];
  static reset() {
    MockXHR.instances = [];
  }
}

const mockFetch = vi.fn();

beforeEach(() => {
  MockEventSource.reset();
  MockXHR.reset();
  vi.stubGlobal("EventSource", MockEventSource);
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("XMLHttpRequest", function () {
    const instance = new MockXHR();
    MockXHR.instances.push(instance);
    return instance;
  });
  mockFetch.mockReset();
  setWorkspaceId("test1234");
});

describe("useConversionJob", () => {
  it("starts with idle state", () => {
    const { result } = renderHook(() => useConversionJob());
    expect(result.current.state.jobId).toBeNull();
    expect(result.current.state.status).toBe("pending");
    expect(result.current.state.stages).toHaveLength(5);
    expect(result.current.state.stages.every(s => s.status === "pending")).toBe(true);
  });

  it("uploads file and transitions to scanning", async () => {
    const { result } = renderHook(() => useConversionJob());

    const file = new File(["data"], "test.tif", { type: "image/tiff" });
    await act(async () => {
      const uploadPromise = result.current.startUpload(file);
      // Resolve the XHR after it's been created
      await Promise.resolve();
      MockXHR.instances[0].resolve({ job_id: "j1", dataset_id: "d1" });
      await uploadPromise;
    });

    expect(MockXHR.instances).toHaveLength(1);
    expect(MockXHR.instances[0].open).toHaveBeenCalledWith("POST", expect.stringContaining("/api/upload"));
    expect(result.current.state.jobId).toBe("j1");
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain("/api/jobs/j1/stream");
  });

  it("updates stages from SSE events", async () => {
    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      const uploadPromise = result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
      await Promise.resolve();
      MockXHR.instances[0].resolve({ job_id: "j1", dataset_id: "d1" });
      await uploadPromise;
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "scanning" }),
        }),
      );
    });
    expect(result.current.state.status).toBe("scanning");
    // stages[0] is "Uploading" (done), stages[1] is "Scanning" (active)
    expect(result.current.state.stages[0]).toMatchObject({ name: "Uploading", status: "done" });
    expect(result.current.state.stages[1]).toMatchObject({ name: "Scanning", status: "active" });

    act(() => {
      es.emit("status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "converting" }),
        }),
      );
    });
    expect(result.current.state.status).toBe("converting");
    expect(result.current.state.stages[1]).toMatchObject({ name: "Scanning", status: "done" });
    expect(result.current.state.stages[2]).toMatchObject({ name: "Converting", status: "active" });
  });

  it("sets datasetId on ready", async () => {
    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      const uploadPromise = result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
      await Promise.resolve();
      MockXHR.instances[0].resolve({ job_id: "j1", dataset_id: "d1" });
      await uploadPromise;
    });

    act(() => {
      MockEventSource.instances[0].emit("status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "ready" }),
        }),
      );
    });

    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.datasetId).toBe("d1");
  });

  it("sets error on failed status", async () => {
    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      const uploadPromise = result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" }),
      );
      await Promise.resolve();
      MockXHR.instances[0].resolve({ job_id: "j1", dataset_id: "d1" });
      await uploadPromise;
    });

    act(() => {
      MockEventSource.instances[0].emit("status",
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
      "/api/convert-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://example.com/data.tif" }),
      }),
    );
    expect(result.current.state.jobId).toBe("j2");
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
