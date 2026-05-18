import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import * as echarts from "echarts";
import { ChartChapterRenderer } from "../../../components/ChartChapterRenderer";
import type { ChartChapter } from "../types";

const CAPTURE_WIDTH = 1200;
const CAPTURE_HEIGHT = 675;
const TIMEOUT_MS = 30_000;
const QUIET_MS = 250;
const POLL_INTERVAL_MS = 50;

interface EchartsInstance {
  getOption: () => unknown;
  getWidth: () => number;
  getHeight: () => number;
  getDataURL: (opts: {
    type: "png";
    pixelRatio: number;
    backgroundColor: string;
  }) => string;
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
}

/**
 * Render a chart chapter into an offscreen Chakra-wrapped ChartChapterRenderer,
 * wait for echarts to finish its first render (plus a quiet period), and
 * return a PNG data URL via `instance.getDataURL`. Mirrors captureChapterMap's
 * offscreen-mount + 30s timeout discipline. Errors propagate so callers can
 * fail the whole archival export loudly rather than shipping a chart-less
 * document.
 *
 * A single AbortController gates both the instance-discovery polling loop and
 * the 'finished' quiet-period wait, so when the 30 s timeout fires the inner
 * timers and the 'finished' listener are cleaned up immediately rather than
 * left dangling on the disposed instance.
 */
export async function captureChartToDataUrl(
  chapter: ChartChapter
): Promise<string> {
  const host = document.createElement("div");
  host.setAttribute("data-archival-chart-capture", "");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${CAPTURE_WIDTH}px;height:${CAPTURE_HEIGHT}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);

  const controller = new AbortController();
  let timeoutTripped = false;
  const timeoutId = setTimeout(() => {
    timeoutTripped = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const tree: ReactNode = createElement(ChakraProvider, {
      value: defaultSystem,
      children: createElement(ChartChapterRenderer, {
        chapter,
        chapterIndex: 0,
      }),
    });
    root.render(tree);

    try {
      const instance = await waitForChartInstance(host, controller.signal);
      await waitForFinishedQuiet(instance, controller.signal);
      return instance.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#fff",
      });
    } catch (err) {
      if (timeoutTripped) {
        throw new Error(`Chart snapshot timed out after ${TIMEOUT_MS / 1000}s`);
      }
      throw err;
    }
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
    root.unmount();
    host.remove();
  }
}

async function waitForChartInstance(
  host: HTMLElement,
  signal: AbortSignal
): Promise<EchartsInstance> {
  while (true) {
    if (signal.aborted) throw new Error("capture aborted");
    const el = host.querySelector<HTMLElement>("[_echarts_instance_]");
    if (el) {
      const inst = echarts.getInstanceByDom(el) as EchartsInstance | undefined;
      if (inst) return inst;
    }
    await sleep(POLL_INTERVAL_MS, signal);
  }
}

async function waitForFinishedQuiet(
  instance: EchartsInstance,
  signal: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("capture aborted"));
      return;
    }

    let lastFinishedAt = 0;
    let everFinished = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onFinished = () => {
      everFinished = true;
      lastFinishedAt = performance.now();
    };
    instance.on("finished", onFinished);

    // echarts does not replay the 'finished' event for renders that completed
    // before the listener was attached. If the instance already has positive
    // dimensions by the time we subscribe, treat it as having already finished
    // and start the quiet period — otherwise a fast-rendering chart would sit
    // until the outer 30 s timeout.
    if (instance.getWidth() > 0 && instance.getHeight() > 0) {
      everFinished = true;
      lastFinishedAt = performance.now();
    }

    const cleanup = () => {
      instance.off("finished", onFinished);
      if (timer) clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new Error("capture aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    const tick = () => {
      if (signal.aborted) return;
      if (everFinished && performance.now() - lastFinishedAt >= QUIET_MS) {
        cleanup();
        resolve();
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("capture aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
