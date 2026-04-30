import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Box, Heading, Spinner, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import type { ChartChapter } from "../lib/story";
import {
  buildBarOptionFromHistogram,
  buildLineOptionFromTimeseries,
  buildOptionFromCsvRows,
  fetchCsvRows,
  fetchCsvRowsByAssetId,
  fetchHistogram,
  fetchTimeseries,
} from "../lib/story/charts";

const ReactECharts = lazy(() => import("echarts-for-react"));

function filterRowsByRange(
  rows: Record<string, unknown>[],
  xField: string,
  xMin: number | string | null | undefined,
  xMax: number | string | null | undefined
): Record<string, unknown>[] {
  if (xMin == null && xMax == null) return rows;

  const isNumeric = typeof xMin === "number" || typeof xMax === "number";
  const isDateString =
    typeof xMin === "string" &&
    typeof xMax === "string" &&
    !Number.isNaN(Date.parse(xMin)) &&
    !Number.isNaN(Date.parse(xMax));

  let filtered: Record<string, unknown>[];
  if (isNumeric) {
    const lo = typeof xMin === "number" ? xMin : -Infinity;
    const hi = typeof xMax === "number" ? xMax : Infinity;
    filtered = rows.filter((r) => {
      const v = r[xField];
      return typeof v === "number" && v >= lo && v <= hi;
    });
  } else if (isDateString) {
    const lo = Date.parse(xMin as string);
    const hi = Date.parse(xMax as string);
    filtered = rows.filter((r) => {
      const v = r[xField];
      if (typeof v !== "string") return false;
      const t = Date.parse(v);
      return Number.isFinite(t) && t >= lo && t <= hi;
    });
  } else {
    // Category axis: keep rows whose label appears between the saved labels in source order.
    const labels = rows.map((r) => String(r[xField]));
    const startIdx = xMin == null ? 0 : labels.indexOf(String(xMin));
    const endIdx = xMax == null ? labels.length - 1 : labels.lastIndexOf(String(xMax));
    if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return rows;
    const allowed = new Set(labels.slice(startIdx, endIdx + 1));
    filtered = rows.filter((r) => allowed.has(String(r[xField])));
  }

  if (filtered.length === 0) return rows;
  return filtered;
}

interface ChartChapterRendererProps {
  chapter: ChartChapter;
  chapterIndex: number;
  onRangeChange?: (range: {
    x_min: number | string | null;
    x_max: number | string | null;
  }) => void;
}

export function ChartChapterRenderer({
  chapter,
  chapterIndex,
  onRangeChange,
}: ChartChapterRendererProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [option, setOption] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditor = !!onRangeChange;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setOption(null);

    async function load() {
      try {
        const { source, viz } = chapter.chart;
        if (source.kind === "csv") {
          if (!source.url && !source.asset_id) {
            throw new Error(
              "chart csv source is missing both url and asset_id"
            );
          }
          const rows = source.asset_id
            ? await fetchCsvRowsByAssetId(source.asset_id)
            : await fetchCsvRows(source.url);
          if (cancelled) return;
          const rowsForOption = isEditor
            ? rows
            : filterRowsByRange(rows, viz.x_field, viz.x_min, viz.x_max);
          const built = buildOptionFromCsvRows(rowsForOption, viz, {
            interactive: isEditor,
          });
          if (isEditor && viz.x_min != null && viz.x_max != null) {
            built.dataZoom = built.dataZoom.map((dz: { type: string }) =>
              dz.type === "slider" || dz.type === "inside"
                ? { ...dz, startValue: viz.x_min, endValue: viz.x_max }
                : dz
            );
          }
          setOption(built);
        } else if (source.kind === "dataset_timeseries") {
          const points = await fetchTimeseries(
            source.dataset_id,
            source.point[0],
            source.point[1]
          );
          if (cancelled) return;
          setOption(
            buildLineOptionFromTimeseries(points, {
              x_label: viz.x_label,
              y_label: viz.y_label,
              y_scale: viz.y_scale,
            })
          );
        } else {
          const bins = await fetchHistogram(source.dataset_id, source.bins);
          if (cancelled) return;
          setOption(buildBarOptionFromHistogram(bins));
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "load failed");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [chapter.chart, isEditor]);

  function handleDataZoom() {
    if (!onRangeChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const inst = chartRef.current?.getEchartsInstance();
      if (!inst) return;
      const dz = inst.getOption().dataZoom?.[0];
      if (!dz) return;

      const { source, viz } = chapter.chart;
      if (source.kind !== "csv") return;

      const startValue = dz.startValue;
      const endValue = dz.endValue;
      const startPct = typeof dz.start === "number" ? dz.start : 0;
      const endPct = typeof dz.end === "number" ? dz.end : 100;

      const isFullRange = startPct <= 0.01 && endPct >= 99.99;
      if (isFullRange) {
        onRangeChange({ x_min: null, x_max: null });
        return;
      }

      if (startValue != null && endValue != null) {
        onRangeChange({
          x_min: startValue as number | string,
          x_max: endValue as number | string,
        });
        return;
      }
      // Fallback for category axis: derive labels from data and percent slice.
      const labels = source.columns.includes(viz.x_field)
        ? // pull labels from the chart's xAxis data:
          (inst.getOption().xAxis?.[0]?.data as (string | number)[]) ?? []
        : [];
      if (labels.length > 0) {
        const lo = Math.floor((startPct / 100) * (labels.length - 1));
        const hi = Math.ceil((endPct / 100) * (labels.length - 1));
        onRangeChange({
          x_min: String(labels[Math.max(0, lo)]),
          x_max: String(labels[Math.min(labels.length - 1, hi)]),
        });
      }
    }, 300);
  }

  return (
    <Box maxW="800px" mx="auto" py={12} px={6}>
      <Text
        fontSize="10px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.orange"
        fontWeight={600}
        mb={2}
      >
        Chapter {chapterIndex + 1}
      </Text>
      <Heading size="lg" mb={4} color="gray.800">
        {chapter.title}
      </Heading>
      <Box height="400px" mb={4}>
        {error ? (
          <Text color="red.600">{error}</Text>
        ) : option ? (
          <Suspense fallback={<Spinner />}>
            <ReactECharts
              ref={chartRef}
              option={option}
              style={{ height: 400, width: "100%" }}
              onEvents={isEditor ? { datazoom: handleDataZoom } : undefined}
              notMerge={true}
            />
          </Suspense>
        ) : (
          <Spinner />
        )}
      </Box>
      {chapter.narrative.trim() && (
        <Box
          mt={6}
          fontSize="sm"
          color="gray.700"
          lineHeight="1.7"
          css={{
            "& p": { marginBottom: "1em" },
            "& h1, & h2, & h3": {
              fontWeight: 600,
              marginBottom: "0.5em",
            },
          }}
        >
          <Markdown>{chapter.narrative}</Markdown>
        </Box>
      )}
    </Box>
  );
}
