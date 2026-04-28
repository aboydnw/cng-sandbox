import { Suspense, lazy, useEffect, useState } from "react";
import { Box, Heading, Spinner, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import type { ChartChapter } from "../lib/story";
import {
  buildBarOptionFromHistogram,
  buildLineOptionFromTimeseries,
  buildOptionFromCsvRows,
  fetchCsvRows,
  fetchHistogram,
  fetchTimeseries,
} from "../lib/story/charts";

const ReactECharts = lazy(() => import("echarts-for-react"));

interface ChartChapterRendererProps {
  chapter: ChartChapter;
  chapterIndex: number;
}

export function ChartChapterRenderer({
  chapter,
  chapterIndex,
}: ChartChapterRendererProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [option, setOption] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setOption(null);

    async function load() {
      try {
        const { source, viz } = chapter.chart;
        if (source.kind === "csv") {
          if (!source.url) return;
          const rows = await fetchCsvRows(source.url);
          if (cancelled) return;
          setOption(buildOptionFromCsvRows(rows, viz));
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
  }, [chapter.chart]);

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
              option={option}
              style={{ height: 400, width: "100%" }}
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
