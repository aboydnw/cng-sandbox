import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTemporalExport } from "../useTemporalExport";

describe("useTemporalExport", () => {
  it("exposes the export API and reads the deck overlay canvas from the handle", () => {
    const deckCanvas = document.createElement("canvas");
    deckCanvas.width = 4;
    deckCanvas.height = 4;
    const deckRef = { current: { deck: { canvas: deckCanvas } } };
    const timesteps = [
      { datetime: "2020-01-01", index: 0 },
      { datetime: "2020-01-02", index: 1 },
    ];

    const { result } = renderHook(() =>
      useTemporalExport(deckRef, timesteps, new Set<number>(), 100)
    );

    expect(typeof result.current.exportGif).toBe("function");
    expect(typeof result.current.exportMp4).toBe("function");
    expect(deckRef.current.deck.canvas).toBe(deckCanvas);
  });
});
