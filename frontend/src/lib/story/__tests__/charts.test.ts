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

  it("groups by series_field for long-format CSVs", () => {
    const rows = [
      { Year: 2005, Type: "A", Emissions: 10 },
      { Year: 2006, Type: "A", Emissions: 11 },
      { Year: 2005, Type: "B", Emissions: 20 },
      { Year: 2006, Type: "B", Emissions: 22 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "Year",
      y_fields: ["Emissions"],
      series_field: "Type",
    });
    expect(opt.series).toHaveLength(2);
    expect(opt.series.map((s: { name: string }) => s.name).sort()).toEqual([
      "A",
      "B",
    ]);
    const a = opt.series.find((s: { name: string }) => s.name === "A");
    expect(a.data).toEqual([
      [2005, 10],
      [2006, 11],
    ]);
    expect(opt.legend).toBeDefined();
  });

  it("throws when y_fields is empty so the renderer can show an error", () => {
    expect(() =>
      buildOptionFromCsvRows([{ x: 1, y: 2 }], {
        kind: "line",
        x_field: "x",
        y_fields: [],
      })
    ).toThrow(/Y column/);
  });

  it("preserves series_field group order based on first appearance", () => {
    const rows = [
      { x: 1, g: "second", y: 1 },
      { x: 1, g: "first", y: 5 },
      { x: 2, g: "second", y: 2 },
      { x: 2, g: "first", y: 6 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "x",
      y_fields: ["y"],
      series_field: "g",
    });
    expect(opt.series.map((s: { name: string }) => s.name)).toEqual([
      "second",
      "first",
    ]);
  });

  it("uses tight axis bounds for numeric x columns (no padding to round numbers)", () => {
    const rows = [
      { Year: 2010, v: 1 },
      { Year: 2015, v: 5 },
      { Year: 2020, v: 9 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "Year",
      y_fields: ["v"],
    });
    expect(opt.xAxis.type).toBe("value");
    expect(opt.xAxis.min).toBe("dataMin");
    expect(opt.xAxis.max).toBe("dataMax");
  });

  it("uses tight axis bounds for date-string x columns", () => {
    const rows = [
      { date: "2020-01-01", v: 1 },
      { date: "2020-12-01", v: 2 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "date",
      y_fields: ["v"],
    });
    expect(opt.xAxis.type).toBe("time");
    expect(opt.xAxis.min).toBe("dataMin");
    expect(opt.xAxis.max).toBe("dataMax");
  });

  it("does not set min/max on category x axes", () => {
    const rows = [
      { name: "alpha", v: 1 },
      { name: "beta", v: 2 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "bar",
      x_field: "name",
      y_fields: ["v"],
    });
    expect(opt.xAxis.type).toBe("category");
    expect(opt.xAxis.min).toBeUndefined();
    expect(opt.xAxis.max).toBeUndefined();
  });

  it("formats integer x values without thousand separators", () => {
    const rows = [
      { Year: 2010, v: 1 },
      { Year: 2015, v: 2 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "Year",
      y_fields: ["v"],
    });
    expect(opt.xAxis.axisLabel.formatter(2015)).toBe("2015");
    expect(opt.xAxis.axisLabel.formatter(2015.5)).toBe("2016");
  });

  it("does not add an integer formatter for non-integer numeric x values", () => {
    const rows = [
      { x: 0.1, v: 1 },
      { x: 0.5, v: 2 },
    ];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "x",
      y_fields: ["v"],
    });
    expect(opt.xAxis.axisLabel).toBeUndefined();
  });

  it("includes the slider dataZoom by default (editor mode)", () => {
    const rows = [{ x: 1, v: 1 }];
    const opt = buildOptionFromCsvRows(rows, {
      kind: "line",
      x_field: "x",
      y_fields: ["v"],
    });
    const types = opt.dataZoom.map((d: { type: string }) => d.type);
    expect(types).toContain("slider");
    expect(types).toContain("inside");
  });

  it("omits the slider dataZoom when interactive=false (reader mode)", () => {
    const rows = [{ x: 1, v: 1 }];
    const opt = buildOptionFromCsvRows(
      rows,
      { kind: "line", x_field: "x", y_fields: ["v"] },
      { interactive: false }
    );
    const types = opt.dataZoom.map((d: { type: string }) => d.type);
    expect(types).not.toContain("slider");
    expect(types).toContain("inside");
  });
});
