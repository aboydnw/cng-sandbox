import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useConnectionConversion } from "../useConnectionConversion";

class FakeEventSource {
  listeners: Record<string, (e: MessageEvent) => void> = {};
  closed = false;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: (e: MessageEvent) => void) {
    this.listeners[name] = fn;
  }
  close() {
    this.closed = true;
  }
  static instances: FakeEventSource[] = [];
  emit(name: string, data: unknown) {
    this.listeners[name]?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  emitRaw(name: string, raw: string) {
    this.listeners[name]?.({ data: raw } as MessageEvent);
  }
}

const OriginalEventSource = globalThis.EventSource;

beforeEach(() => {
  FakeEventSource.instances = [];
  // @ts-expect-error override
  globalThis.EventSource = FakeEventSource;
});

afterEach(() => {
  globalThis.EventSource = OriginalEventSource;
});

describe("useConnectionConversion", () => {
  it("reports ready status with tile_url and closes the stream", async () => {
    const { result } = renderHook(() => useConnectionConversion("c1", true));
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.emit("status", {
        status: "ready",
        tile_url: "/pmtiles/connections/c1/data.pmtiles",
        error: null,
        feature_count: 42,
      });
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.tileUrl).toBe("/pmtiles/connections/c1/data.pmtiles");
    expect(result.current.featureCount).toBe(42);
    expect(es.closed).toBe(true);
  });

  it("does not open a stream when disabled", () => {
    renderHook(() => useConnectionConversion("c1", false));
    expect(FakeEventSource.instances.length).toBe(0);
  });

  it("closes stream on failed status and reports error", async () => {
    const { result } = renderHook(() => useConnectionConversion("c2", true));
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.emit("status", {
        status: "failed",
        tile_url: null,
        error: "tippecanoe failed",
        feature_count: null,
      });
    });
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toBe("tippecanoe failed");
    expect(es.closed).toBe(true);
  });

  it("ignores malformed payloads without crashing", async () => {
    const { result } = renderHook(() => useConnectionConversion("c3", true));
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    const es = FakeEventSource.instances[0];
    act(() => {
      es.emitRaw("status", "not json{");
    });
    expect(result.current.status).toBe("pending");
    expect(es.closed).toBe(false);
  });

  it("reconnects on stream errors and fails after retries are exhausted", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useConnectionConversion("c4", true));
      expect(FakeEventSource.instances.length).toBe(1);

      for (let retry = 1; retry <= 3; retry++) {
        const es = FakeEventSource.instances[retry - 1];
        act(() => {
          es.onerror?.();
        });
        expect(es.closed).toBe(true);
        expect(result.current.status).toBe("pending");
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000 * retry);
        });
        expect(FakeEventSource.instances.length).toBe(retry + 1);
      }

      act(() => {
        FakeEventSource.instances[3].onerror?.();
      });
      expect(result.current.status).toBe("failed");
      expect(result.current.error).toBe(
        "Connection lost. Please refresh the page."
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reconnect after unmount", async () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderHook(() => useConnectionConversion("c5", true));
      expect(FakeEventSource.instances.length).toBe(1);
      const es = FakeEventSource.instances[0];
      unmount();
      act(() => {
        es.onerror?.();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(FakeEventSource.instances.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
