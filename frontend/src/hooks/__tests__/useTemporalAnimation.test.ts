import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useTemporalAnimation } from "../useTemporalAnimation";

describe("useTemporalAnimation", () => {
  it("starts in browse mode", () => {
    const { result } = renderHook(() =>
      useTemporalAnimation(10, new Set(), true, 0)
    );
    expect(result.current.isAnimateMode).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });

  it("enters animate mode and starts playing", () => {
    const { result } = renderHook(() =>
      useTemporalAnimation(10, new Set(), true, 0)
    );
    act(() => result.current.enterAnimateMode());
    expect(result.current.isAnimateMode).toBe(true);
    expect(result.current.isPlaying).toBe(true);
  });

  it("exits animate mode and stops playing", () => {
    const { result } = renderHook(() =>
      useTemporalAnimation(10, new Set(), true, 0)
    );
    act(() => result.current.enterAnimateMode());
    act(() => result.current.setActiveIndex(5));
    act(() => result.current.exitAnimateMode());
    expect(result.current.isAnimateMode).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.activeIndex).toBe(5);
  });
});
