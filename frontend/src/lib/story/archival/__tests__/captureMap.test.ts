import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureMapToDataUrl } from "../captureMap";

beforeEach(() => {
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () =>
      "data:image/png;base64," +
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  ) as unknown as HTMLCanvasElement["toDataURL"];

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("captureMapToDataUrl", () => {
  it("returns a base64 PNG data URL", async () => {
    const fakeCanvas = document.createElement("canvas");
    fakeCanvas.width = 800;
    fakeCanvas.height = 600;
    const ctx = fakeCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 800, 600);
    }

    const dataUrl = await captureMapToDataUrl({
      canvas: fakeCanvas,
      width: 800,
      height: 600,
    });

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("preserves the requested dimensions", async () => {
    const fakeCanvas = document.createElement("canvas");
    fakeCanvas.width = 1200;
    fakeCanvas.height = 800;

    const dataUrl = await captureMapToDataUrl({
      canvas: fakeCanvas,
      width: 1200,
      height: 800,
    });

    expect(dataUrl.length).toBeGreaterThan(100);
  });
});
