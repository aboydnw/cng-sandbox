/**
 * Render a chart spec to a canvas and return its data URL.
 *
 * Currently a stub. Chart chapters render via recharts (SVG) — see
 * `ChartChapterRenderer.tsx`. A real implementation needs to serialize
 * the rendered SVG to a Blob, draw it onto a canvas, and call toDataURL.
 * Task 4 emits a placeholder for chart chapters; this fills in afterwards.
 */
export async function captureChartToDataUrl(): Promise<string> {
  throw new Error(
    "Not yet implemented — recharts SVG-to-canvas capture is a follow-up"
  );
}
