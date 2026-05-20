import { describe, it, expect } from "vitest";
import { renderLegend } from "../Legend";
import type { Legend } from "../types";

describe("renderLegend", () => {
  it("returns null when legend is missing", () => {
    expect(renderLegend(null)).toBeNull();
    expect(renderLegend(undefined)).toBeNull();
  });

  it("renders a categorical legend with one li per stop", () => {
    const legend: Legend = {
      title: "Class",
      kind: "categorical",
      stops: [
        { value: "forest", color: "#2a7", label: "Forest" },
        { value: "water", color: [40, 100, 200, 255], label: "Water" },
      ],
    };
    const el = renderLegend(legend)!;
    expect(el.querySelectorAll("li").length).toBe(2);
    expect(el.textContent).toContain("Forest");
    expect(el.textContent).toContain("Water");
    const swatches = el.querySelectorAll<HTMLElement>(".swatch");
    expect(swatches[0].style.background).toBe("rgb(34, 170, 119)");
  });

  it("renders a continuous legend with a gradient bar + min/max labels", () => {
    const legend: Legend = {
      title: "Elevation",
      kind: "continuous",
      stops: [
        { value: 0, color: [0, 0, 0, 255], label: "0" },
        { value: 1000, color: [255, 255, 255, 255], label: "1000" },
      ],
    };
    const el = renderLegend(legend)!;
    const bar = el.querySelector<HTMLElement>(".bar")!;
    expect(bar.style.background).toContain("linear-gradient");
    expect(el.textContent).toContain("0");
    expect(el.textContent).toContain("1000");
  });
});
