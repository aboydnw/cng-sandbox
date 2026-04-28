import { describe, it, expect } from "vitest";
import {
  buildLineOptionFromTimeseries,
  buildBarOptionFromHistogram,
  buildOptionFromCsvRows,
} from "../charts";

describe("buildLineOptionFromTimeseries", () => {
  it("produces an ECharts option with series and dataZoom", () => {
    const opt = buildLineOptionFromTimeseries(
      [
        { datetime: "2020-01-01T00:00:00Z", value: 1 },
        { datetime: "2020-02-01T00:00:00Z", value: 2 },
      ],
      { x_label: "Time", y_label: "Value", y_scale: "linear" }
    );
    expect(opt.series[0].type).toBe("line");
    expect(opt.series[0].data).toEqual([
      ["2020-01-01T00:00:00Z", 1],
      ["2020-02-01T00:00:00Z", 2],
    ]);
    expect(opt.xAxis.type).toBe("time");
    expect(opt.yAxis.type).toBe("value");
    expect(opt.dataZoom).toBeDefined();
  });
});

describe("buildBarOptionFromHistogram", () => {
  it("renders categorical histogram with class labels", () => {
    const opt = buildBarOptionFromHistogram([
      { class: 1, label: "forest", count: 100 },
      { class: 2, label: "water", count: 50 },
    ]);
    expect(opt.xAxis.data).toEqual(["forest", "water"]);
    expect(opt.series[0].data).toEqual([100, 50]);
  });

  it("renders continuous histogram with bin range labels", () => {
    const opt = buildBarOptionFromHistogram([
      { bin_min: 0, bin_max: 5, count: 10 },
      { bin_min: 5, bin_max: 10, count: 20 },
    ]);
    expect(opt.xAxis.data).toEqual(["0–5", "5–10"]);
    expect(opt.series[0].data).toEqual([10, 20]);
  });
});

describe("buildOptionFromCsvRows", () => {
  it("renders a line chart with a single y-series", () => {
    const rows = [
      { date: "2020-01-01", value: 1 },
      { date: "2020-02-01", value: 2 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "date",
      y_fields: ["value"],
    });
    expect(opt.series).toHaveLength(1);
    expect(opt.series[0].name).toBe("value");
    expect(opt.series[0].data).toEqual([
      ["2020-01-01", 1],
      ["2020-02-01", 2],
    ]);
  });

  it("renders multiple y-series", () => {
    const rows = [{ x: 1, a: 10, b: 20 }];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "bar",
      x_field: "x",
      y_fields: ["a", "b"],
    });
    expect(opt.series).toHaveLength(2);
  });
});
