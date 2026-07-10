import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFlyoverScroll } from "../useScrollProgress";

let rafQueue: FrameRequestCallback[] = [];
let rect = { top: 0, height: 3000 };

function pumpFrame() {
  const cbs = rafQueue;
  rafQueue = [];
  cbs.forEach((cb) => cb(performance.now()));
}

function makeContainer(): React.RefObject<HTMLElement | null> {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ top: rect.top, height: rect.height }) as DOMRect;
  return { current: el };
}

beforeEach(() => {
  rafQueue = [];
  rect = { top: 0, height: 3000 };
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("innerHeight", 1000);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFlyoverScroll (continuous)", () => {
  it("emits the raw progress on the first frame (no lerp-in from 0)", () => {
    rect.top = -1000; // halfway through the 2000px span
    const onFrame = vi.fn();
    renderHook(() =>
      useFlyoverScroll(makeContainer(), 4, { onFrame, onStep: vi.fn() })
    );
    pumpFrame();
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls[0][0]).toBeCloseTo(0.5, 6);
  });

  it("damps toward a new target over subsequent frames", () => {
    rect.top = 0;
    const onFrame = vi.fn();
    renderHook(() =>
      useFlyoverScroll(makeContainer(), 4, { onFrame, onStep: vi.fn() })
    );
    pumpFrame(); // settles at 0
    rect.top = -2000; // jump to target 1
    pumpFrame();
    pumpFrame();
    const values = onFrame.mock.calls.map((c) => c[0]);
    const last = values[values.length - 1];
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(1); // damped, not snapped
  });

  it("goes quiescent once converged (no onFrame spam)", () => {
    rect.top = 0;
    const onFrame = vi.fn();
    renderHook(() =>
      useFlyoverScroll(makeContainer(), 4, { onFrame, onStep: vi.fn() })
    );
    pumpFrame();
    const callsAfterSettle = onFrame.mock.calls.length;
    pumpFrame();
    pumpFrame();
    expect(onFrame.mock.calls.length).toBe(callsAfterSettle);
  });
});

describe("useFlyoverScroll (reduced motion)", () => {
  it("returns stepped mode and emits keyframe indices, not progress", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    rect.top = -1000; // t=0.5 of 5 keyframes → index 2
    const onFrame = vi.fn();
    const onStep = vi.fn();
    const { result } = renderHook(() =>
      useFlyoverScroll(makeContainer(), 5, { onFrame, onStep })
    );
    pumpFrame();
    expect(result.current).toBe("stepped");
    expect(onFrame).not.toHaveBeenCalled();
    expect(onStep).toHaveBeenCalledWith(2);
    pumpFrame();
    expect(onStep).toHaveBeenCalledTimes(1); // only on index change
  });
});
