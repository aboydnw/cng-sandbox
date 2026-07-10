import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { render } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { createFlyoverChapter } from "../../lib/story/types";

const fakeMap = { jumpTo: vi.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedProps: any = null;

vi.mock("../UnifiedMap", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UnifiedMap: (props: any) => {
    capturedProps = props;
    useEffect(() => {
      if (props.mapRef && typeof props.mapRef === "object") {
        props.mapRef.current = { getMap: () => fakeMap };
      }
    }, [props]);
    return <div data-testid="unified-map" />;
  },
}));

import { FlyoverBlock } from "../FlyoverBlock";

let rafQueue: FrameRequestCallback[] = [];
function pumpFrame() {
  const cbs = rafQueue;
  rafQueue = [];
  cbs.forEach((cb) => cb(performance.now()));
}

const chapter = createFlyoverChapter({
  title: "Around the peak",
  keyframes: [
    { center: [86.9, 27.9], zoom: 10, bearing: 0, pitch: 60, caption: "Start" },
    { center: [86.95, 28.0], zoom: 12, bearing: 90, pitch: 60 },
  ],
  map_state: {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    basemap: "streets",
    terrain: { enabled: true, exaggeration: 1.5 },
  },
});

const originalGetRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  rafQueue = [];
  capturedProps = null;
  vi.clearAllMocks();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("innerHeight", 1000);
  // jsdom returns an all-zero rect; give the sticky container a real height
  // so rawProgress(top=0, height=3000, vh=1000) → t=0 (the entry keyframe).
  Element.prototype.getBoundingClientRect = () =>
    ({ top: 0, height: 3000 }) as DOMRect;
});

afterEach(() => {
  vi.unstubAllGlobals();
  Element.prototype.getBoundingClientRect = originalGetRect;
});

function renderBlock() {
  return render(
    <ChakraProvider value={system}>
      <FlyoverBlock
        chapter={chapter}
        chapterIndex={1}
        datasetMap={new Map()}
        connectionMap={new Map()}
      />
    </ChakraProvider>
  );
}

describe("FlyoverBlock", () => {
  it("mounts UnifiedMap with scrubbing, fadeDuration 0, terrain and the entry camera", () => {
    renderBlock();
    expect(capturedProps.scrubbing).toBe(true);
    expect(capturedProps.fadeDuration).toBe(0);
    expect(capturedProps.interactive).toBe(false);
    expect(capturedProps.allowTerrain).toBe(true); // no layer_config
    expect(capturedProps.terrain).toEqual({ enabled: true, exaggeration: 1.5 });
    expect(capturedProps.camera.longitude).toBeCloseTo(86.9, 6);
    expect(capturedProps.camera.zoom).toBe(10);
  });

  it("drives map.jumpTo with the interpolated pose on scroll frames", () => {
    renderBlock();
    pumpFrame(); // rAF tick: rect.top defaults to 0 → t = 0 → keyframe 0 pose
    expect(fakeMap.jumpTo).toHaveBeenCalled();
    const pose = fakeMap.jumpTo.mock.calls[0][0];
    expect(pose.zoom).toBeCloseTo(10, 4);
    expect(pose.pitch).toBeCloseTo(60, 4);
  });

  it("sizes the scroll container to scroll_length × keyframes × 100vh", () => {
    const { container } = renderBlock();
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.height).toBe("200vh"); // 1 × 2 keyframes
  });
});
