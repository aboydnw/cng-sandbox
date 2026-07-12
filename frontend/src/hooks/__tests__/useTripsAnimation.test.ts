import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTripsAnimation } from "../useTripsAnimation";

describe("useTripsAnimation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts paused at tMin", () => {
    const { result } = renderHook(() => useTripsAnimation(0, 1000, true));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
  });

  it("scrub sets time and pauses", () => {
    const { result } = renderHook(() => useTripsAnimation(0, 1000, true));
    act(() => result.current.togglePlay());
    act(() => result.current.scrub(500));
    expect(result.current.currentTime).toBe(500);
    expect(result.current.isPlaying).toBe(false);
  });

  it("advances currentTime while playing", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      return window.setTimeout(
        () => cb(performance.now()),
        16
      ) as unknown as number;
    });
    const { result } = renderHook(() => useTripsAnimation(0, 1000, true));
    act(() => result.current.togglePlay());
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.currentTime).toBeGreaterThan(0);
  });
});
