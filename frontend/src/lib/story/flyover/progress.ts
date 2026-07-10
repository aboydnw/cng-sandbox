function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Scroll progress of a tall container through the viewport. rectTop is the
 * container's viewport-relative top (getBoundingClientRect().top), so this
 * is agnostic to whether the window or an overflow ancestor scrolls.
 */
export function rawProgress(
  rectTop: number,
  rectHeight: number,
  viewportHeight: number
): number {
  const span = rectHeight - viewportHeight;
  if (span <= 0) return 1;
  return clamp01(-rectTop / span);
}

/** Damped lerp toward target; snaps once within 0.0005 so rAF goes quiet. */
export function damp(current: number, target: number, factor = 0.12): number {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) < 0.0005 ? target : next;
}

/** Nearest keyframe index for reduced-motion stepped mode. */
export function steppedIndex(t: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(clamp01(t) * (count - 1));
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}
