import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fetchWithRetry } from "./useConversionJob";
import { useConversionJob } from "./useConversionJob";
import { setWorkspaceId } from "../lib/api";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  vi.useFakeTimers();
  setWorkspaceId("test1234");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchWithRetry", () => {
  it("returns response on first success", async () => {
    const resp = new Response("ok", { status: 200 });
    mockFetch.mockResolvedValueOnce(resp);

    const result = await fetchWithRetry("/api/test");
    expect(result).toBe(resp);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx and returns final response", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("error", { status: 502 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = fetchWithRetry("/api/test", undefined, 2);

    // Advance past the 1s delay for first retry
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns 5xx response after exhausting retries", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("error", { status: 500 }));

    const promise = fetchWithRetry("/api/test", undefined, 2);

    await vi.advanceTimersByTimeAsync(5000);

    const result = await promise;
    expect(result.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on network error and throws after exhausting retries", async () => {
    vi.useRealTimers();
    mockFetch.mockRejectedValue(new Error("network error"));

    await expect(fetchWithRetry("/api/test", undefined, 0)).rejects.toThrow(
      "network error"
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry 4xx errors", async () => {
    mockFetch.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const result = await fetchWithRetry("/api/test");
    expect(result.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("passes init options through to fetch", async () => {
    mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const init = { method: "POST", body: "data" };
    await fetchWithRetry("/api/test", init);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ method: "POST", body: "data" })
    );
  });
});

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

describe("useConversionJob", () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.stubGlobal("EventSource", MockEventSource);
  });

  it("sets error state on upload failure", async () => {
    vi.useRealTimers();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "File too large" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" })
      );
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.error).toBe("File too large");
    expect(result.current.state.isUploading).toBe(false);
  });

  it("reconnects SSE on error up to 3 times", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" })
      );
    });

    expect(MockEventSource.instances).toHaveLength(1);

    // Trigger first SSE error
    act(() => {
      MockEventSource.instances[0].onerror?.();
    });
    expect(MockEventSource.instances[0].close).toHaveBeenCalled();

    // Advance timer for first reconnect (1s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // Trigger second SSE error
    act(() => {
      MockEventSource.instances[1].onerror?.();
    });

    // Advance timer for second reconnect (2s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(MockEventSource.instances).toHaveLength(3);

    // Trigger third SSE error
    act(() => {
      MockEventSource.instances[2].onerror?.();
    });

    // Advance timer for third reconnect (3s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(MockEventSource.instances).toHaveLength(4);

    // Trigger fourth SSE error -- should give up
    act(() => {
      MockEventSource.instances[3].onerror?.();
    });

    expect(result.current.state.error).toBe(
      "Connection lost. Please refresh the page."
    );
    expect(result.current.state.status).toBe("failed");
  });

  it("resets SSE retry count on successful message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: "j1", dataset_id: "d1" }),
    });

    const { result } = renderHook(() => useConversionJob());

    await act(async () => {
      await result.current.startUpload(
        new File(["data"], "test.tif", { type: "image/tiff" })
      );
    });

    // Trigger SSE error and reconnect
    act(() => {
      MockEventSource.instances[0].onerror?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // Receive a successful status message -- should reset retry count
    act(() => {
      MockEventSource.instances[1].emit(
        "status",
        new MessageEvent("status", {
          data: JSON.stringify({ status: "scanning" }),
        })
      );
    });

    expect(result.current.state.status).toBe("scanning");

    // Now trigger 3 more errors -- should still reconnect since counter was reset
    act(() => {
      MockEventSource.instances[1].onerror?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(MockEventSource.instances).toHaveLength(3);
  });
});
