import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapSnapshot } from "../useMapSnapshot";
import type {
  SnapshotMapRefValue,
  SnapshotDeckRefValue,
} from "../useMapSnapshot";

vi.mock("html-to-image", () => ({
  toCanvas: vi.fn(async () => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 40;
    return c;
  }),
}));

function makeCanvas(width = 800, height = 600): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

const cleanups: Array<() => void> = [];

function makeRefs() {
  const basemapCanvas = makeCanvas();
  const deckCanvas = makeCanvas();

  const triggerRepaint = vi.fn();
  const redraw = vi.fn();

  const mapRef = {
    current: {
      getMap: () => ({
        getCanvas: () => basemapCanvas,
        triggerRepaint,
      }),
    },
  } as unknown as React.RefObject<SnapshotMapRefValue | null>;

  const deckRef = {
    current: {
      deck: { canvas: deckCanvas, redraw },
    },
  } as unknown as React.RefObject<SnapshotDeckRefValue | null>;

  const containerDiv = document.createElement("div");
  Object.defineProperty(containerDiv, "getBoundingClientRect", {
    value: () => ({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
    }),
  });
  document.body.appendChild(containerDiv);
  const containerRef = {
    current: containerDiv,
  } as unknown as React.RefObject<HTMLDivElement>;

  const cleanup = () => {
    if (containerDiv.parentNode === document.body) {
      document.body.removeChild(containerDiv);
    }
  };
  cleanups.push(cleanup);

  return {
    mapRef,
    deckRef,
    containerRef,
    triggerRepaint,
    redraw,
    basemapCanvas,
    deckCanvas,
  };
}

describe("useMapSnapshot", () => {
  let anchorClick: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    anchorClick = vi.fn();
    createObjectURL = vi.fn(() => "blob:stub");
    revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = anchorClick as () => void;
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });

    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(["x"], { type: "image/png" }));
    };

    // Stub getContext to return a drawable object
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as HTMLCanvasElement["getContext"];

    // Force one raf tick for await rAF
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    while (cleanups.length) {
      cleanups.pop()!();
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts with isCapturing false", () => {
    const refs = makeRefs();
    const { result } = renderHook(() =>
      useMapSnapshot({ ...refs, filename: "x.png" })
    );
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("calls triggerRepaint and deck.redraw before composing canvases", async () => {
    const refs = makeRefs();
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage,
    })) as unknown as HTMLCanvasElement["getContext"];

    const { result } = renderHook(() =>
      useMapSnapshot({ ...refs, filename: "x.png" })
    );
    await act(async () => {
      await result.current.snap();
    });

    expect(refs.triggerRepaint).toHaveBeenCalled();
    expect(refs.redraw).toHaveBeenCalled();
    // first two drawImage calls are basemap, then deck
    expect(drawImage.mock.calls[0][0]).toBe(refs.basemapCanvas);
    expect(drawImage.mock.calls[1][0]).toBe(refs.deckCanvas);
  });

  it("triggers an anchor download with the configured filename", async () => {
    const refs = makeRefs();
    const { result } = renderHook(() =>
      useMapSnapshot({ ...refs, filename: "my-map.png" })
    );
    const appended: HTMLAnchorElement[] = [];
    const origAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => {
      if (el instanceof HTMLAnchorElement) appended.push(el);
      return origAppend(el);
    });

    await act(async () => {
      await result.current.snap();
    });

    expect(anchorClick).toHaveBeenCalled();
    expect(appended[0].download).toBe("my-map.png");
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("sets error state when toBlob fails", async () => {
    const refs = makeRefs();
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(null);
    };
    const { result } = renderHook(() =>
      useMapSnapshot({ ...refs, filename: "x.png" })
    );

    await act(async () => {
      await result.current.snap();
    });

    expect(result.current.error).toBe(true);
    expect(result.current.isCapturing).toBe(false);
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it("continues compositing when an overlay rasterization throws", async () => {
    const refs = makeRefs();
    const mod = await import("html-to-image");
    (mod.toCanvas as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("rasterize fail")
    );
    // add an overlay node so the hook tries to process it
    const overlay = document.createElement("div");
    overlay.setAttribute("data-snapshot-overlay", "true");
    Object.defineProperty(overlay, "getBoundingClientRect", {
      value: () => ({
        width: 100,
        height: 40,
        left: 10,
        top: 10,
        right: 110,
        bottom: 50,
      }),
    });
    refs.containerRef.current!.appendChild(overlay);

    const { result } = renderHook(() =>
      useMapSnapshot({ ...refs, filename: "x.png" })
    );
    await act(async () => {
      await result.current.snap();
    });

    expect(anchorClick).toHaveBeenCalled();
    expect(result.current.error).toBe(false);
  });
});
