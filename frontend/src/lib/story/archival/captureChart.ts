import type { ChartChapter } from "../types";

/**
 * Render a chart chapter to an off-screen echarts instance and return a PNG
 * data URL via `instance.getDataURL({ type: 'png', pixelRatio: 2, ... })`.
 * Real implementation lands in Task 2.
 */
export async function captureChartToDataUrl(
  _chapter: ChartChapter
): Promise<string> {
  throw new Error("Not yet implemented");
}
