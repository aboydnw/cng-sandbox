import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ChartChapterEditor } from "../ChartChapterEditor";
import { createChartChapter } from "../../../lib/story/types";

function wrap(node: React.ReactNode) {
  return <ChakraProvider value={defaultSystem}>{node}</ChakraProvider>;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

describe("ChartChapterEditor", () => {
  it("renders without crashing for a default csv chart chapter", () => {
    const ch = createChartChapter();
    render(
      wrap(
        <ChartChapterEditor
          chapter={ch}
          onChange={() => {}}
          onChapterTypeChange={() => {}}
        />,
      ),
    );
    expect(screen.getByText("Upload CSV")).toBeInTheDocument();
    expect(screen.getByText("From dataset")).toBeInTheDocument();
  });

  it("does not crash when source is dataset-typed (CsvBranch is still mounted)", () => {
    const ch = createChartChapter();
    ch.chart = {
      source: { kind: "dataset_histogram", dataset_id: "", bins: 20 },
      viz: {
        kind: "bar",
        x_field: "bin",
        y_fields: ["count"],
        y_scale: "linear",
      },
    };
    expect(() =>
      render(
        wrap(
          <ChartChapterEditor
            chapter={ch}
            onChange={() => {}}
            onChapterTypeChange={() => {}}
          />,
        ),
      ),
    ).not.toThrow();
  });

});
