import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { UnifiedMap } from "../../../components/UnifiedMap";
import { buildLayersForChapter, type StoryTripsContext } from "../rendering";
import { compositeMapCanvases } from "./compositeMapCanvases";
import type { Chapter } from "../types";
import type { Connection, Dataset } from "../../../types";

const CAPTURE_WIDTH = 1200;
const CAPTURE_HEIGHT = 675;
const TIMEOUT_MS = 30_000;
const QUIET_MS = 250;

export interface CaptureChapterMapArgs {
  chapter: Chapter;
  datasetMap: Map<string, Dataset | null>;
  connectionMap: Map<string, Connection>;
  tripsContext?: StoryTripsContext;
}

interface MapInstance {
  getCanvas?: () => HTMLCanvasElement;
  once?: (event: string, cb: () => void) => void;
}

interface DeckInstance {
  canvas?: HTMLCanvasElement;
}

interface DeckHandle {
  deck?: DeckInstance;
}

export async function captureChapterMap({
  chapter,
  datasetMap,
  connectionMap,
  tripsContext,
}: CaptureChapterMapArgs): Promise<string> {
  const host = document.createElement("div");
  host.setAttribute("data-archival-capture", "");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${CAPTURE_WIDTH}px;height:${CAPTURE_HEIGHT}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    if (chapter.type !== "map" && chapter.type !== "scrollytelling") {
      throw new Error(
        `captureChapterMap called with non-map chapter type: ${chapter.type}`
      );
    }

    const connectionId = chapter.layer_config?.connection_id;
    if (connectionId) {
      const conn = connectionMap.get(connectionId);
      if (conn?.connection_type === "zarr") {
        throw new Error(
          "Zarr chapters are not yet supported in archival export"
        );
      }
    }

    const { layers } = buildLayersForChapter(
      chapter,
      datasetMap,
      connectionMap,
      new Map(),
      tripsContext
    );

    const camera = {
      longitude: chapter.map_state.center[0],
      latitude: chapter.map_state.center[1],
      zoom: chapter.map_state.zoom,
      bearing: chapter.map_state.bearing,
      pitch: chapter.map_state.pitch,
    };

    const refs: { map: MapInstance | null; deckHandle: DeckHandle | null } = {
      map: null,
      deckHandle: null,
    };
    let lastRenderAt = 0;
    let mapIdle = false;
    let mapIdleSubscribed = false;
    let resolveReady: (() => void) | null = null;

    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    // Evaluate the readiness gate. Must be callable from both `onAfterRender`
    // (deck.gl draws) and the maplibre `'idle'` callback, because the latter
    // can fire *after* deck.gl has finished drawing — if the gate is only
    // re-checked inside `onAfterRender`, `mapIdle` can flip true with no
    // further render to observe it, and the capture sits at the 30s timeout
    // even though both inputs are satisfied.
    const checkReady = () => {
      if (!resolveReady) return;
      const allLoaded = layers.every(
        (l) => (l as unknown as { isLoaded?: boolean }).isLoaded
      );
      if (!(mapIdle && allLoaded)) return;
      const observed = lastRenderAt;
      setTimeout(() => {
        if (observed === lastRenderAt && resolveReady) {
          resolveReady();
          resolveReady = null;
        }
      }, QUIET_MS);
    };

    const mapRef = (ref: unknown) => {
      const maybeMap = ref as { getMap?: () => MapInstance } | null;
      refs.map = maybeMap?.getMap?.() ?? (maybeMap as MapInstance | null);
      if (!refs.map || mapIdleSubscribed) return;

      // Defensive: if the map is already loaded by the time we subscribe
      // (cached basemap style, etc.), `once('idle')` would never fire.
      // Treat already-loaded as already-idle.
      const loadedFn = (refs.map as { loaded?: () => boolean }).loaded;
      if (typeof loadedFn === "function" && loadedFn.call(refs.map)) {
        mapIdleSubscribed = true;
        mapIdle = true;
        lastRenderAt = performance.now();
        checkReady();
        return;
      }

      if (typeof refs.map.once !== "function") return;
      mapIdleSubscribed = true;
      refs.map.once("idle", () => {
        mapIdle = true;
        lastRenderAt = performance.now();
        checkReady();
      });
    };

    // Hold the @deck.gl/react imperative handle itself rather than eagerly
    // unwrapping `.deck`. The handle exposes `deck` via a live getter, but
    // the underlying Deck instance is created inside DeckGLWithRef's
    // useEffect — which runs *after* the ref callback fires. Capturing
    // `.deck` here would freeze the value at `undefined` and never update.
    const deckRef = (ref: unknown) => {
      refs.deckHandle = ref as DeckHandle | null;
    };

    const onAfterRender = () => {
      lastRenderAt = performance.now();
      checkReady();
    };

    const tree: ReactNode = createElement(UnifiedMap, {
      camera,
      onCameraChange: () => {},
      layers,
      basemap: chapter.map_state.basemap,
      onBasemapChange: () => {},
      interactive: false,
      enableSnapshot: true,
      hideBasemapPicker: true,
      mapRef,
      ref: deckRef,
      onAfterRender,
    });
    root.render(tree);

    await Promise.race([
      readyPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Chapter snapshot timed out after ${TIMEOUT_MS / 1000}s`)
          );
        }, TIMEOUT_MS);
      }),
    ]);

    const basemapCanvas = refs.map?.getCanvas?.();
    const deckCanvas = refs.deckHandle?.deck?.canvas;
    if (!basemapCanvas || !deckCanvas) {
      throw new Error("Capture canvases not available after map ready");
    }

    const output = compositeMapCanvases({
      basemapCanvas,
      deckCanvas,
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      output.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) throw new Error("toBlob returned null");

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  } finally {
    root.unmount();
    host.remove();
  }
}
