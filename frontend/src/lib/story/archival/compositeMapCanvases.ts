export interface CompositeMapCanvasesArgs {
  basemapCanvas: HTMLCanvasElement;
  deckCanvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export function compositeMapCanvases({
  basemapCanvas,
  deckCanvas,
  width,
  height,
}: CompositeMapCanvasesArgs): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(basemapCanvas, 0, 0, width, height);
  ctx.drawImage(deckCanvas, 0, 0, width, height);
  return output;
}
