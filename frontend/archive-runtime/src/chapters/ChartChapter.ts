import * as echarts from "echarts";
import type { ChartChapterEntry } from "../types";

interface ChartOptionLike {
  xAxis?: { type?: string; data?: unknown[] };
  series?: Array<{ data?: unknown[] }>;
  [k: string]: unknown;
}

function reinjectIntegerXAxisFormatter(opt: ChartOptionLike): void {
  const xAxis = opt.xAxis;
  if (!xAxis || xAxis.type !== "value") return;

  const xValues: unknown[] = [];
  for (const s of opt.series ?? []) {
    for (const row of s.data ?? []) {
      if (Array.isArray(row)) xValues.push(row[0]);
    }
  }
  const allIntegers =
    xValues.length > 0 && xValues.every((v) => typeof v === "number" && Number.isInteger(v));
  if (!allIntegers) return;

  (xAxis as Record<string, unknown>).axisLabel = {
    formatter: (v: number) => String(Math.round(v)),
  };
}

export async function renderChartChapter(
  chapter: ChartChapterEntry,
  host: HTMLElement,
  basePath: string,
): Promise<void> {
  const section = document.createElement("section");
  section.className = "chapter chart";

  if (chapter.title) {
    const h2 = document.createElement("h2");
    h2.textContent = chapter.title;
    section.appendChild(h2);
  }

  const container = document.createElement("div");
  container.className = "chart-container";
  section.appendChild(container);

  host.appendChild(section);

  const resp = await fetch(`${basePath}/chapters/${chapter.id}/${chapter.chart_src}`);
  if (!resp.ok) {
    container.textContent = `Failed to load chart (${resp.status})`;
    return;
  }
  const opt = (await resp.json()) as ChartOptionLike;
  reinjectIntegerXAxisFormatter(opt);

  const instance = echarts.init(container);
  instance.setOption(opt as echarts.EChartsOption);

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(container);
  }

  if (chapter.narrative) {
    const body = document.createElement("div");
    body.className = "chapter-body";
    body.innerHTML = chapter.narrative;
    section.appendChild(body);
  }
}
