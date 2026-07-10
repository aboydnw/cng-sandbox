import { useEffect, useRef, useState } from "react";
import {
  damp,
  prefersReducedMotion,
  rawProgress,
  steppedIndex,
} from "./progress";

export interface FlyoverScrollHandlers {
  /** Continuous mode: smoothed progress t∈[0,1], called only when it changes. */
  onFrame: (t: number) => void;
  /** Stepped (reduced-motion) mode: nearest keyframe index, on change only. */
  onStep: (index: number) => void;
}

/**
 * rAF-driven scroll progress for a flyover container. Continuous mode damps
 * raw scroll progress with a lerp factor (default 0.12) to hide discrete
 * wheel steps; `prefers-reduced-motion` switches to discrete keyframe steps.
 */
export function useFlyoverScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  keyframeCount: number,
  handlers: FlyoverScrollHandlers,
  dampingFactor = 0.12
): "continuous" | "stepped" {
  const [mode] = useState<"continuous" | "stepped">(() =>
    prefersReducedMotion() ? "stepped" : "continuous"
  );
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    let current: number | null = null;
    let lastStep = -1;

    const tick = () => {
      const r = el.getBoundingClientRect();
      const target = rawProgress(r.top, r.height, window.innerHeight);
      if (mode === "stepped") {
        const idx = steppedIndex(target, keyframeCount);
        if (idx !== lastStep) {
          lastStep = idx;
          handlersRef.current.onStep(idx);
        }
      } else {
        const next =
          current === null ? target : damp(current, target, dampingFactor);
        if (next !== current) {
          current = next;
          handlersRef.current.onFrame(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [containerRef, keyframeCount, mode, dampingFactor]);

  return mode;
}
