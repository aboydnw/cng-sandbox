export type StoryPerformanceMark =
  | "story-prose-visible"
  | "story-map-runtime-requested"
  | "story-map-runtime-loaded"
  | "story-map-hydration-start"
  | "story-map-engine-ready"
  | "story-first-data-frame";

const observedMarks = new Set<StoryPerformanceMark>();

export function markStoryPerformance(name: StoryPerformanceMark): void {
  if (observedMarks.has(name)) return;
  observedMarks.add(name);

  try {
    performance.mark(name);
  } catch {
    // Performance instrumentation must never block story rendering.
  }
}

export function resetStoryPerformanceMarksForTests(): void {
  observedMarks.clear();
}
