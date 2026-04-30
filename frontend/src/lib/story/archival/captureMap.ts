export interface CaptureMapOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Captures the contents of a canvas element as a PNG data URL.
 * Waits one animation frame for any pending renders to flush before capturing.
 */
export async function captureMapToDataUrl(
  opts: CaptureMapOptions
): Promise<string> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return opts.canvas.toDataURL("image/png");
}

/**
 * Higher-level helper: given a chapter's map state + layer config, render it
 * offscreen, wait for the render to settle, capture, and dispose.
 *
 * Not yet implemented — see Task 4+ of the story archival plan.
 */
export async function captureChapterMap(): Promise<string> {
  throw new Error("Not yet implemented — see implementer note");
}
