import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTileTransferSize } from "./useTileTransferSize";

function makeEntry(
  name: string,
  transferSize: number
): PerformanceResourceTiming {
  return {
    name,
    transferSize,
    entryType: "resource",
  } as unknown as PerformanceResourceTiming;
}

describe("useTileTransferSize", () => {
  let observerCallback: PerformanceObserverCallback;
  let mockDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // jsdom sets window.location.origin to "http://localhost" by default.
    // Entry URLs in these tests use that prefix, so the hook's prefix filter works
    // without any explicit stub.
    mockDisconnect = vi.fn();
    vi.stubGlobal(
      "PerformanceObserver",
      vi.fn().mockImplementation(function MockPerformanceObserver(
        cb: PerformanceObserverCallback
      ) {
        observerCallback = cb;
        return { observe: vi.fn(), disconnect: mockDisconnect };
      })
    );
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when no matching entries exist yet", () => {
    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    expect(result.current).toBeNull();
  });

  it("sums transferSize for unique entries matching the prefix", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      makeEntry("http://localhost/pmtiles/datasets/abc/tile-a", 1024),
      makeEntry("http://localhost/pmtiles/datasets/abc/tile-b", 512),
      makeEntry("http://localhost/raster/tiles/0/0/0.png", 2048),
    ]);
    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    expect(result.current).toBe(1536);
  });

  it("updates when the observer fires with new entries", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      makeEntry("http://localhost/pmtiles/tile-a", 100),
    ]);

    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    expect(result.current).toBe(100);

    act(() => {
      observerCallback(
        {
          getEntries: () => [makeEntry("http://localhost/pmtiles/tile-b", 200)],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver
      );
    });
    expect(result.current).toBe(300);
  });

  it("deduplicates repeated fetches of the same tile URL", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      makeEntry("http://localhost/pmtiles/tile-a", 100),
    ]);

    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    expect(result.current).toBe(100);

    act(() => {
      observerCallback(
        {
          getEntries: () => [
            makeEntry("http://localhost/pmtiles/tile-a", 100),
            makeEntry("http://localhost/pmtiles/tile-b", 200),
          ],
        } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver
      );
    });
    // tile-a was already counted, only tile-b is new
    expect(result.current).toBe(300);
  });

  it("returns 0 (not null) when entries exist but all have transferSize 0 (Timing-Allow-Origin not set)", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      makeEntry("http://localhost/pmtiles/x", 0),
    ]);
    const { result } = renderHook(() => useTileTransferSize("/pmtiles/"));
    // entries exist but report 0 bytes → 0, not null (null = no entries at all)
    expect(result.current).toBe(0);
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = renderHook(() => useTileTransferSize("/pmtiles/"));
    unmount();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });
});
