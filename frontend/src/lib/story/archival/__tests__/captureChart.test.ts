import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createChartChapter } from "../../types";
import type { ChartChapter } from "../../types";

const rootMocks = vi.hoisted(
  () =>
    [] as Array<{
      render: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }>
);

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => {
    const root = { render: vi.fn(), unmount: vi.fn() };
    rootMocks.push(root);
    return root;
  }),
}));

vi.mock("../../../../components/ChartChapterRenderer", () => ({
  ChartChapterRenderer: vi.fn(() => null),
}));

const getInstanceByDom = vi.hoisted(() => vi.fn());
vi.mock("echarts", () => ({
  getInstanceByDom,
}));

import { captureChartToDataUrl } from "../captureChart";

function makeChapter(): ChartChapter {
  return createChartChapter({
    id: "c1",
    title: "Test chart",
    order: 0,
    narrative: "",
    chart: {
      source: {
        kind: "csv",
        asset_id: "a1",
        url: "http://x/y.csv",
        columns: ["Year", "v"],
      },
      viz: { kind: "line", x_field: "Year", y_fields: ["v"] },
    },
  });
}

function placeTaggedDiv() {
  const host = document.querySelector(
    "[data-archival-chart-capture]"
  ) as HTMLElement | null;
  if (!host) throw new Error("capture host not yet mounted");
  const div = document.createElement("div");
  div.setAttribute("_echarts_instance_", "fake");
  host.appendChild(div);
  return div;
}

interface FakeInstance {
  getOption: ReturnType<typeof vi.fn>;
  getDataURL: ReturnType<typeof vi.fn>;
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
  _fireFinished: () => void;
}

function makeInstance(): FakeInstance {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    getOption: vi.fn(() => ({ series: [{ data: [] }] })),
    getDataURL: vi.fn(() => "data:image/png;base64,FAKE"),
    on: (event, cb) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(cb);
    },
    off: (event, cb) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    },
    _fireFinished: () => {
      (handlers["finished"] ?? []).forEach((h) => h());
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  rootMocks.length = 0;
  getInstanceByDom.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("captureChartToDataUrl", () => {
  it("appends a hidden host to document.body during capture and removes it on success", async () => {
    vi.useFakeTimers();
    const instance = makeInstance();
    getInstanceByDom.mockImplementation(() => instance);

    const promise = captureChartToDataUrl(makeChapter());

    // Polling loop runs setTimeout(50). Advance once so the renderer mock has
    // mounted in the DOM and the polling loop can find the host.
    await vi.advanceTimersByTimeAsync(0);
    placeTaggedDiv();
    await vi.advanceTimersByTimeAsync(60);

    expect(
      document.body.querySelector("[data-archival-chart-capture]")
    ).not.toBeNull();

    instance._fireFinished();
    await vi.advanceTimersByTimeAsync(300);

    const result = await promise;
    expect(result).toBe("data:image/png;base64,FAKE");
    expect(
      document.body.querySelector("[data-archival-chart-capture]")
    ).toBeNull();
  });

  it("calls getDataURL with type=png, pixelRatio=2, backgroundColor=#fff", async () => {
    vi.useFakeTimers();
    const instance = makeInstance();
    getInstanceByDom.mockImplementation(() => instance);

    const promise = captureChartToDataUrl(makeChapter());
    await vi.advanceTimersByTimeAsync(0);
    placeTaggedDiv();
    await vi.advanceTimersByTimeAsync(60);
    instance._fireFinished();
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(instance.getDataURL).toHaveBeenCalledWith({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fff",
    });
  });

  it("rejects with a timeout error after 30s if the chart never reports finished", async () => {
    vi.useFakeTimers();
    const instance = makeInstance();
    getInstanceByDom.mockImplementation(() => instance);

    const promise = captureChartToDataUrl(makeChapter());
    await vi.advanceTimersByTimeAsync(0);
    placeTaggedDiv();
    await vi.advanceTimersByTimeAsync(60);

    const failure = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
  });

  it("removes the offscreen host even when capture fails", async () => {
    vi.useFakeTimers();
    getInstanceByDom.mockImplementation(() => undefined);

    const promise = captureChartToDataUrl(makeChapter());
    await vi.advanceTimersByTimeAsync(0);
    placeTaggedDiv();
    await vi.advanceTimersByTimeAsync(60);

    const failure = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;

    expect(
      document.body.querySelector("[data-archival-chart-capture]")
    ).toBeNull();
  });
});
