import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderChartChapter } from "../chapters/ChartChapter";
import type { ChartChapterEntry } from "../types";

const initSpy = vi.fn();
const setOptionSpy = vi.fn();
const resizeSpy = vi.fn();

vi.mock("echarts", () => ({
  init: (...args: unknown[]) => {
    initSpy(...args);
    return { setOption: setOptionSpy, resize: resizeSpy };
  },
}));

describe("ChartChapter", () => {
  beforeEach(() => {
    initSpy.mockClear();
    setOptionSpy.mockClear();
    resizeSpy.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          series: [
            {
              type: "line",
              data: [
                [2020, 1],
                [2021, 2],
              ],
            },
          ],
          xAxis: { type: "value", name: "" },
          yAxis: { type: "value", name: "" },
        }),
      })
    );
  });

  it("fetches chart.json and calls echarts.init + setOption on the host", async () => {
    const host = document.createElement("div");
    const chapter: ChartChapterEntry = {
      id: "c1",
      type: "chart",
      title: "Yield",
      narrative: "",
      chart_src: "chart.json",
    };
    await renderChartChapter(chapter, host, "/exported");
    expect(global.fetch).toHaveBeenCalledWith(
      "/exported/chapters/c1/chart.json"
    );
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(setOptionSpy).toHaveBeenCalledTimes(1);
  });

  it("re-injects an integer axisLabel formatter when xAxis is value-typed and all-integer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          series: [
            {
              type: "line",
              data: [
                [2020, 1],
                [2021, 2],
              ],
            },
          ],
          xAxis: { type: "value", name: "" },
          yAxis: { type: "value", name: "" },
        }),
      })
    );
    const host = document.createElement("div");
    const chapter: ChartChapterEntry = {
      id: "c1",
      type: "chart",
      title: "",
      narrative: "",
      chart_src: "chart.json",
    };
    await renderChartChapter(chapter, host, ".");
    const opt = setOptionSpy.mock.calls[0][0] as {
      xAxis: { axisLabel?: { formatter: (v: number) => string } };
    };
    expect(opt.xAxis.axisLabel).toBeDefined();
    expect(opt.xAxis.axisLabel!.formatter(2020.4)).toBe("2020");
  });
});
