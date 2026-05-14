import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rootMocks = vi.hoisted(
  () =>
    [] as Array<{
      render: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }>
);

vi.mock("../../../../components/UnifiedMap", () => ({
  UnifiedMap: vi.fn(() => null),
}));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => {
    const root = { render: vi.fn(), unmount: vi.fn() };
    rootMocks.push(root);
    return root;
  }),
}));

vi.mock("../../rendering", () => ({
  buildLayersForChapter: vi.fn(() => ({ layers: [] })),
}));

vi.mock("../compositeMapCanvases", () => ({
  compositeMapCanvases: vi.fn(() => {
    const canvas = document.createElement("canvas");
    canvas.toBlob = ((cb: BlobCallback) => {
      cb(new Blob(["x"], { type: "image/png" }));
    }) as HTMLCanvasElement["toBlob"];
    return canvas;
  }),
}));

import { captureChapterMap } from "../captureMap";
import { createScrollytellingChapter } from "../../types";
import type { Connection } from "../../../../types";

const mockChapter = createScrollytellingChapter({
  id: "ch1",
  title: "Test",
  narrative: "",
  order: 0,
  map_state: {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    basemap: "positron",
  },
  layer_config: {
    dataset_id: "",
    connection_id: "portable-x",
    colormap: "viridis",
    opacity: 1,
    basemap: "positron",
  },
});

const mockConnection: Connection = {
  id: "portable-x",
  name: "x",
  url: "https://example.com/cog.tif",
  connection_type: "cog",
  tile_type: "raster",
  bounds: null,
  min_zoom: null,
  max_zoom: null,
  band_count: null,
  rescale: null,
  workspace_id: null,
  is_categorical: false,
  categories: null,
  tile_url: null,
  render_path: "client",
  conversion_status: "ready",
  conversion_error: null,
  feature_count: null,
  file_size: null,
  is_shared: false,
  preferred_colormap: null,
  preferred_colormap_reversed: null,
  config: null,
  geozarr_attrs: null,
  created_at: "",
};

beforeEach(() => {
  document.body.innerHTML = "";
  rootMocks.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("captureChapterMap", () => {
  it("rejects with a timeout error after 30s if the map never settles", async () => {
    vi.useFakeTimers();
    const promise = captureChapterMap({
      chapter: mockChapter,
      datasetMap: new Map(),
      connectionMap: new Map([["portable-x", mockConnection]]),
    });
    const failure = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
  });

  it("appends a hidden host to document.body and removes it on completion", async () => {
    vi.useFakeTimers();
    const promise = captureChapterMap({
      chapter: mockChapter,
      datasetMap: new Map(),
      connectionMap: new Map([["portable-x", mockConnection]]),
    });
    expect(
      document.body.querySelector("[data-archival-capture]")
    ).not.toBeNull();

    const failure = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
    expect(document.body.querySelector("[data-archival-capture]")).toBeNull();
  });

  // Regression: @deck.gl/react's imperative handle exposes `deck` via a live
  // getter, and the underlying Deck instance is created inside a useEffect
  // that runs *after* the parent's ref callback fires. If captureChapterMap
  // unwraps `.deck` at ref-callback time it freezes the value at undefined
  // and throws "Capture canvases not available after map ready" even though
  // the deck eventually renders. The handle itself must be stored and `.deck`
  // dereferenced lazily at canvas-read time.
  it("dereferences the deck handle's .deck getter lazily, so a Deck created after the ref callback is still read", async () => {
    vi.useFakeTimers();

    const promise = captureChapterMap({
      chapter: mockChapter,
      datasetMap: new Map(),
      connectionMap: new Map([["portable-x", mockConnection]]),
    });

    // captureChapterMap synchronously created a root and called render(tree)
    // with the UnifiedMap element. Extract its props so we can drive the
    // map/deck ref lifecycle ourselves.
    expect(rootMocks).toHaveLength(1);
    const tree = rootMocks[0].render.mock.calls[0][0] as {
      ref?: unknown;
      props: {
        mapRef?: (ref: unknown) => void;
        ref?: (ref: unknown) => void;
        onAfterRender?: () => void;
      };
    };
    const deckRef = (tree.ref ?? tree.props.ref) as (ref: unknown) => void;
    const mapRef = tree.props.mapRef!;
    const onAfterRender = tree.props.onAfterRender!;

    // Mock maplibre handle: getCanvas + once('idle')
    const idle: { fire: (() => void) | null } = { fire: null };
    const basemapCanvas = document.createElement("canvas");
    const mapInstance = {
      getCanvas: () => basemapCanvas,
      once: (event: string, cb: () => void) => {
        if (event === "idle") idle.fire = cb;
      },
    };
    mapRef({ getMap: () => mapInstance });

    // Mock the @deck.gl/react handle: `deck` is a live getter that returns
    // undefined at ref-callback time (deck instance not yet created), then
    // returns a real Deck instance once useEffect runs.
    const deckCanvas = document.createElement("canvas");
    const deckState: { instance: { canvas: HTMLCanvasElement } | undefined } = {
      instance: undefined,
    };
    const deckHandle = {
      get deck() {
        return deckState.instance;
      },
    };
    deckRef(deckHandle);

    // At this moment the buggy code would have captured `refs.deck =
    // handle.deck ?? null` → null, and would later throw.
    expect(deckState.instance).toBeUndefined();

    // Simulate deck.gl's useEffect creating the Deck instance.
    deckState.instance = { canvas: deckCanvas };

    // Fire maplibre 'idle' and one deck.gl render, then wait the quiet period.
    idle.fire?.();
    onAfterRender();
    await vi.advanceTimersByTimeAsync(300);

    const result = await promise;
    expect(result).toMatch(/^data:image\/png/);
    expect(document.body.querySelector("[data-archival-capture]")).toBeNull();
  });

  // Regression: in real exports, deck.gl finishes drawing (last `onAfterRender`
  // fires) *before* maplibre emits its first `'idle'` event. The readiness
  // gate `mapIdle && allLoaded` was only evaluated inside `onAfterRender`, so
  // when `'idle'` flipped `mapIdle = true` *after* the last `onAfterRender`,
  // nobody re-checked the gate and the capture sat for the full 30 s
  // timeout. The fix re-evaluates the gate from both `onAfterRender` *and*
  // the `'idle'` callback. (Diagnostic logs from a real production export
  // showed this exact sequence: render #5 at +249 ms with mapIdle=false,
  // then `'idle'` at +415 ms with no further renders → timeout at +30 s
  // even though both gate inputs were true the whole time.)
  it("resolves when maplibre 'idle' fires after deck.gl's last onAfterRender (gate re-check)", async () => {
    const { buildLayersForChapter } = await import("../../rendering");
    const mockLayer: { isLoaded: boolean } = { isLoaded: false };
    (buildLayersForChapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      layers: [mockLayer],
    });
    vi.useFakeTimers();

    const promise = captureChapterMap({
      chapter: mockChapter,
      datasetMap: new Map(),
      connectionMap: new Map([["portable-x", mockConnection]]),
    });

    expect(rootMocks).toHaveLength(1);
    const tree = rootMocks[0].render.mock.calls[0][0] as {
      ref?: unknown;
      props: {
        mapRef: (ref: unknown) => void;
        ref?: (ref: unknown) => void;
        onAfterRender: () => void;
      };
    };
    const deckRef = (tree.ref ?? tree.props.ref) as (ref: unknown) => void;
    const { mapRef, onAfterRender } = tree.props;

    const idle: { fire: (() => void) | null } = { fire: null };
    const basemapCanvas = document.createElement("canvas");
    const mapInstance = {
      getCanvas: () => basemapCanvas,
      loaded: () => false,
      once: (event: string, cb: () => void) => {
        if (event === "idle") idle.fire = cb;
      },
    };
    mapRef({ getMap: () => mapInstance });

    const deckCanvas = document.createElement("canvas");
    deckRef({ deck: { canvas: deckCanvas } });

    // Render once with the layer still loading.
    onAfterRender();

    // Layer finishes; deck.gl emits its final render. mapIdle is still false.
    mockLayer.isLoaded = true;
    onAfterRender();

    // deck.gl now has nothing left to draw — no more onAfterRender calls.
    // Sometime later, maplibre emits idle.
    idle.fire?.();

    // The 250ms quiet period elapses. Without the fix, nobody is checking
    // the gate at this point and we sit until the 30s timeout.
    await vi.advanceTimersByTimeAsync(300);

    const result = await promise;
    expect(result).toMatch(/^data:image\/png/);
    expect(document.body.querySelector("[data-archival-capture]")).toBeNull();
  });

  // If the map happens to already be loaded by the time the mapRef callback
  // attaches the `'idle'` listener (cached basemap style, etc.),
  // `once('idle')` would never fire. The fix short-circuits this by checking
  // `map.loaded()` at subscribe time and treating an already-loaded map as
  // having already gone idle.
  it("treats an already-loaded map as idle and still resolves", async () => {
    const { buildLayersForChapter } = await import("../../rendering");
    (buildLayersForChapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      layers: [],
    });
    vi.useFakeTimers();

    const promise = captureChapterMap({
      chapter: mockChapter,
      datasetMap: new Map(),
      connectionMap: new Map([["portable-x", mockConnection]]),
    });

    expect(rootMocks).toHaveLength(1);
    const tree = rootMocks[0].render.mock.calls[0][0] as {
      ref?: unknown;
      props: {
        mapRef: (ref: unknown) => void;
        ref?: (ref: unknown) => void;
        onAfterRender: () => void;
      };
    };
    const deckRef = (tree.ref ?? tree.props.ref) as (ref: unknown) => void;
    const { mapRef, onAfterRender } = tree.props;

    const basemapCanvas = document.createElement("canvas");
    const mapInstance = {
      getCanvas: () => basemapCanvas,
      loaded: () => true,
      // 'idle' will never be invoked — map is already loaded.
      once: () => {},
    };
    mapRef({ getMap: () => mapInstance });

    const deckCanvas = document.createElement("canvas");
    deckRef({ deck: { canvas: deckCanvas } });

    onAfterRender();
    await vi.advanceTimersByTimeAsync(300);

    const result = await promise;
    expect(result).toMatch(/^data:image\/png/);
  });
});
