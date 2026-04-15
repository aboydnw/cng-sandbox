import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useConnectionConversion } from "../useConnectionConversion";

class FakeEventSource {
  listeners: Record<string, (e: MessageEvent) => void> = {};
  closed = false;
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
}

beforeEach(() => {
  FakeEventSource.instances = [];
  // @ts-expect-error override
  globalThis.EventSource = FakeEventSource;
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
});
