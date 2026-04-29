import type { ChartViz } from "./types";
import { workspaceFetch } from "../api";

export interface TimeseriesPoint {
  datetime: string;
  value: number | null;
}

export type HistogramBin =
  | { class: number; label: string; count: number }
  | { bin_min: number; bin_max: number; count: number };

interface EChartsOption {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

const COMMON_TOOLBOX = {
  feature: {
    dataZoom: { yAxisIndex: "none" },
    restore: {},
    saveAsImage: {},
    dataView: { readOnly: true },
  },
};

export function buildLineOptionFromTimeseries(
  points: TimeseriesPoint[],
  opts: Pick<ChartViz, "x_label" | "y_label" | "y_scale">
): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    toolbox: COMMON_TOOLBOX,
    grid: { left: 50, right: 30, top: 30, bottom: 60 },
    xAxis: { type: "time", name: opts.x_label ?? "" },
    yAxis: {
      type: opts.y_scale === "log" ? "log" : "value",
      name: opts.y_label ?? "",
    },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 20, bottom: 10 }],
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        data: points.map((p) => [p.datetime, p.value]),
      },
    ],
  };
}

export function buildBarOptionFromHistogram(
  bins: HistogramBin[]
): EChartsOption {
  const labels = bins.map((b) =>
    "label" in b ? b.label : `${b.bin_min}–${b.bin_max}`
  );
  const counts = bins.map((b) => b.count);
  return {
    tooltip: { trigger: "axis" },
    toolbox: COMMON_TOOLBOX,
    grid: { left: 50, right: 30, top: 30, bottom: 60 },
    xAxis: { type: "category", data: labels },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: counts }],
  };
}

function inferXAxisType(
  rows: Record<string, unknown>[],
  xField: string
): "category" | "value" | "time" {
  const values = rows.map((r) => r[xField]);
  if (values.length === 0) return "category";
  const allNumeric = values.every(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (allNumeric) return "value";
  const allStrings = values.every((v) => typeof v === "string");
  if (allStrings) {
    const allDates = values.every(
      (v) => !Number.isNaN(Date.parse(v as string))
    );
    if (allDates) return "time";
  }
  return "category";
}

export function buildOptionFromCsvRows(
  rows: Record<string, unknown>[],
  viz: Pick<
    ChartViz,
    | "kind"
    | "x_field"
    | "y_fields"
    | "series_field"
    | "x_label"
    | "y_label"
    | "y_scale"
  >
): EChartsOption {
  const seriesField = viz.series_field || null;
  const yField = viz.y_fields[0];

  let series: { name: string; type: string; data: unknown[][] }[];
  if (seriesField && yField) {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
      const key = String(r[seriesField] ?? "");
      const bucket = groups.get(key);
      if (bucket) bucket.push(r);
      else groups.set(key, [r]);
    }
    series = Array.from(groups.entries()).map(([name, groupRows]) => ({
      name,
      type: viz.kind,
      smooth: viz.kind === "line",
      showSymbol: false,
      data: groupRows.map((r) => [r[viz.x_field], r[yField]]),
    }));
  } else {
    series = viz.y_fields.map((f) => ({
      name: f,
      type: viz.kind,
      smooth: viz.kind === "line",
      showSymbol: false,
      data: rows.map((r) => [r[viz.x_field], r[f]]),
    }));
  }

  const showLegend = series.length > 1;
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    toolbox: COMMON_TOOLBOX,
    legend: showLegend ? { top: 0 } : undefined,
    grid: {
      left: 50,
      right: 30,
      top: showLegend ? 50 : 30,
      bottom: 60,
    },
    xAxis: { type: inferXAxisType(rows, viz.x_field), name: viz.x_label ?? "" },
    yAxis: {
      type: viz.y_scale === "log" ? "log" : "value",
      name: viz.y_label ?? "",
    },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 20, bottom: 10 }],
    series,
  };
}

export async function fetchTimeseries(
  datasetId: string,
  lon: number,
  lat: number
): Promise<TimeseriesPoint[]> {
  const resp = await workspaceFetch(
    `/api/datasets/${datasetId}/timeseries?lon=${lon}&lat=${lat}`
  );
  if (!resp.ok) throw new Error(`timeseries failed: ${resp.status}`);
  return resp.json();
}

export async function fetchHistogram(
  datasetId: string,
  bins?: number
): Promise<HistogramBin[]> {
  const url = new URL(
    `/api/datasets/${datasetId}/histogram`,
    window.location.origin
  );
  if (bins !== undefined) url.searchParams.set("bins", String(bins));
  const resp = await workspaceFetch(url.toString());
  if (!resp.ok) throw new Error(`histogram failed: ${resp.status}`);
  return resp.json();
}

export async function fetchCsvRows(
  url: string
): Promise<Record<string, unknown>[]> {
  const Papa = (await import("papaparse")).default;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`csv fetch failed: ${resp.status}`);
  const text = await resp.text();
  const parsed = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return parsed.data as Record<string, unknown>[];
}

export async function fetchCsvRowsByAssetId(
  assetId: string
): Promise<Record<string, unknown>[]> {
  const Papa = (await import("papaparse")).default;
  const resp = await workspaceFetch(
    `/api/story-assets/${encodeURIComponent(assetId)}/data`
  );
  if (!resp.ok) throw new Error(`csv fetch failed: ${resp.status}`);
  const text = await resp.text();
  const parsed = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return parsed.data as Record<string, unknown>[];
}
