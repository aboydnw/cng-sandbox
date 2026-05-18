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
 */
export async function captureChartToDataUrl(
  chapter: ChartChapter
): Promise<string> {
  const host = document.createElement("div");
  host.setAttribute("data-archival-chart-capture", "");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${CAPTURE_WIDTH}px;height:${CAPTURE_HEIGHT}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    const tree: ReactNode = createElement(
      ChakraProvider,
      { value: defaultSystem },
      createElement(ChartChapterRenderer, { chapter, chapterIndex: 0 })
    );
    root.render(tree);

    const ready = (async () => {
      const instance = await waitForChartInstance(host);
      await waitForFinishedQuiet(instance);
      return instance.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#fff",
      });
    })();

    return await Promise.race([
      ready,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Chart snapshot timed out after ${TIMEOUT_MS / 1000}s`)
          );
        }, TIMEOUT_MS);
      }),
    ]);
  } finally {
    root.unmount();
    host.remove();
  }
}

async function waitForChartInstance(
  host: HTMLElement
): Promise<EchartsInstance> {
  while (true) {
    const el = host.querySelector<HTMLElement>("[_echarts_instance_]");
    if (el) {
      const inst = echarts.getInstanceByDom(el) as EchartsInstance | undefined;
      if (inst) return inst;
    }
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function waitForFinishedQuiet(instance: EchartsInstance): Promise<void> {
  return new Promise<void>((resolve) => {
    let lastFinishedAt = 0;
    let everFinished = false;

    const onFinished = () => {
      everFinished = true;
      lastFinishedAt = performance.now();
    };
    instance.on("finished", onFinished);

    const tick = () => {
      if (everFinished && performance.now() - lastFinishedAt >= QUIET_MS) {
        instance.off("finished", onFinished);
        resolve();
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  });
}
