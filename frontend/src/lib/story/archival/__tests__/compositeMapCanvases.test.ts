import { afterEach, describe, it, expect, vi } from "vitest";
import { compositeMapCanvases } from "../compositeMapCanvases";

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function stubGetContext(): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        drawImage: () => {},
      }) as unknown as CanvasRenderingContext2D
  );
}

describe("compositeMapCanvases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws basemap then deck onto an output canvas of the requested size", () => {
    stubGetContext();
    const basemap = makeCanvas(200, 100);
    const deck = makeCanvas(200, 100);

    const out = compositeMapCanvases({
      basemapCanvas: basemap,
      deckCanvas: deck,
      width: 1200,
      height: 675,
    });

    expect(out.width).toBe(1200);
    expect(out.height).toBe(675);
  });

  it("draws basemap first then deck on top", () => {
    const basemap = makeCanvas(10, 10);
    const deck = makeCanvas(10, 10);
    const drawCalls: HTMLCanvasElement[] = [];

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        return {
          drawImage: (img: CanvasImageSource) => {
            drawCalls.push(img as HTMLCanvasElement);
          },
        } as unknown as CanvasRenderingContext2D;
      }
    );

    compositeMapCanvases({
      basemapCanvas: basemap,
      deckCanvas: deck,
      width: 100,
      height: 100,
    });

    expect(drawCalls[0]).toBe(basemap);
    expect(drawCalls[1]).toBe(deck);
  });

  it("throws if a 2d context cannot be acquired", () => {
    const basemap = makeCanvas(10, 10);
    const deck = makeCanvas(10, 10);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(() =>
      compositeMapCanvases({
        basemapCanvas: basemap,
        deckCanvas: deck,
        width: 100,
        height: 100,
      })
    ).toThrow(/2d context/i);
  });
});
