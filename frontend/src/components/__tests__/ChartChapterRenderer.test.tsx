import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ChartChapterRenderer } from "../ChartChapterRenderer";
import type { ChartChapter } from "../../lib/story";

vi.mock("echarts-for-react", () => ({
  default: ({ option }: { option: unknown }) => (
    <div data-testid="echarts" data-option={JSON.stringify(option)} />
  ),
}));

vi.mock("../../lib/story/charts", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/story/charts")
  >("../../lib/story/charts");
  return {
    ...actual,
    fetchCsvRows: vi.fn(),
    fetchCsvRowsByAssetId: vi.fn(),
  };
});

import * as charts from "../../lib/story/charts";

function makeChapter(
  overrides: Partial<ChartChapter["chart"]["viz"]> = {}
): ChartChapter {
  return {
    id: "c1",
    type: "chart",
    order: 0,
    title: "Test chart",
    narrative: "",
    chart: {
      source: {
        kind: "csv",
        asset_id: "a1",
        url: "http://x/y.csv",
        columns: ["Year", "v"],
      },
      viz: {
        kind: "line",
        x_field: "Year",
        y_fields: ["v"],
        ...overrides,
      },
    },
  };
}

const ROWS = [
  { Year: 2010, v: 1 },
  { Year: 2015, v: 5 },
  { Year: 2020, v: 9 },
  { Year: 2025, v: 12 },
];

function renderChart(chapter: ChartChapter) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <ChartChapterRenderer chapter={chapter} chapterIndex={0} />
    </ChakraProvider>
  );
}

describe("ChartChapterRenderer (reader mode)", () => {
  beforeEach(() => {
    vi.mocked(charts.fetchCsvRows).mockResolvedValue(ROWS);
    vi.mocked(charts.fetchCsvRowsByAssetId).mockResolvedValue(ROWS);
  });

  it("filters rows to [x_min, x_max] when set", async () => {
    renderChart(makeChapter({ x_min: 2015, x_max: 2020 }));
    const el = await waitFor(() => screen.getByTestId("echarts"));
    const opt = JSON.parse(el.getAttribute("data-option")!);
    const yearData = opt.series[0].data.map((d: [number, number]) => d[0]);
    expect(yearData).toEqual([2015, 2020]);
  });

  it("renders all rows when no range is saved", async () => {
    renderChart(makeChapter());
    const el = await waitFor(() => screen.getByTestId("echarts"));
    const opt = JSON.parse(el.getAttribute("data-option")!);
    expect(opt.series[0].data).toHaveLength(4);
  });

  it("falls back to full data when saved range yields zero rows", async () => {
    renderChart(makeChapter({ x_min: 3000, x_max: 4000 }));
    const el = await waitFor(() => screen.getByTestId("echarts"));
    const opt = JSON.parse(el.getAttribute("data-option")!);
    expect(opt.series[0].data).toHaveLength(4);
  });

  it("omits the slider dataZoom in reader mode", async () => {
    renderChart(makeChapter());
    const el = await waitFor(() => screen.getByTestId("echarts"));
    const opt = JSON.parse(el.getAttribute("data-option")!);
    const types = opt.dataZoom.map((d: { type: string }) => d.type);
    expect(types).not.toContain("slider");
  });
});

describe("ChartChapterRenderer (editor mode)", () => {
  beforeEach(() => {
    vi.mocked(charts.fetchCsvRows).mockResolvedValue(ROWS);
    vi.mocked(charts.fetchCsvRowsByAssetId).mockResolvedValue(ROWS);
  });

  it("does not filter rows when onRangeChange is provided", async () => {
    const onRangeChange = vi.fn();
    render(
      <ChakraProvider value={defaultSystem}>
        <ChartChapterRenderer
          chapter={makeChapter({ x_min: 2015, x_max: 2020 })}
          chapterIndex={0}
          onRangeChange={onRangeChange}
        />
      </ChakraProvider>
    );
    const el = await waitFor(() => screen.getByTestId("echarts"));
    const opt = JSON.parse(el.getAttribute("data-option")!);
    expect(opt.series[0].data).toHaveLength(4);
  });

  it("includes the slider dataZoom in editor mode", async () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <ChartChapterRenderer
          chapter={makeChapter()}
          chapterIndex={0}
          onRangeChange={() => {}}
        />
      </ChakraProvider>
    );
    const el = await waitFor(() => screen.getByTestId("echarts"));
    const opt = JSON.parse(el.getAttribute("data-option")!);
    const types = opt.dataZoom.map((d: { type: string }) => d.type);
    expect(types).toContain("slider");
  });
});
