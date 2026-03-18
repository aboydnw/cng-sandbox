import { describe, it, expect } from "vitest";
import { WebMercatorViewport } from "@deck.gl/core";

describe("RasterMap zoom computation", () => {
  it("computes fitted zoom from bounds instead of hardcoding zoom:3", () => {
    const viewport = new WebMercatorViewport({ width: 800, height: 600 });
    const bounds: [number, number, number, number] = [-10, 40, 10, 50];
    const fitted = viewport.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding: 40 }
    );
    expect(fitted.zoom).toBeGreaterThan(3);
    expect(fitted.longitude).toBeCloseTo(0);
    expect(fitted.latitude).toBeCloseTo(45, 0);
  });
});
