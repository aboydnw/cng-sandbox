import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { UnifiedMap } from "../../../components/UnifiedMap";
import { buildLayersForChapter } from "../rendering";
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
      new Map()
    );

    const tag = `[archival-capture ${chapter.id?.slice(0, 8) ?? "?"} ${chapter.type}]`;
    const t0 = performance.now();
    const tlog = (msg: string, data?: unknown) => {
      const elapsed = (performance.now() - t0).toFixed(0).padStart(5, " ");
      if (data === undefined) console.log(`${tag} +${elapsed}ms ${msg}`);
      else console.log(`${tag} +${elapsed}ms ${msg}`, data);
    };
    tlog(`init layers=${layers.length} basemap=${chapter.map_state.basemap}`);

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
    let renderCount = 0;
    let mapRefFireCount = 0;
    let deckRefFireCount = 0;
    let resolveReady: (() => void) | null = null;

    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    const mapRef = (ref: unknown) => {
      mapRefFireCount++;
      const maybeMap = ref as {
        getMap?: () => MapInstance;
        loaded?: () => boolean;
      } | null;
      const fromGetMap = maybeMap?.getMap?.();
      refs.map = fromGetMap ?? (maybeMap as MapInstance | null);
      const hasOnce = typeof refs.map?.once === "function";
      const alreadyLoaded =
        (refs.map as { loaded?: () => boolean } | null)?.loaded?.() ?? null;
      tlog(`mapRef fire #${mapRefFireCount}`, {
        hasRef: !!ref,
        hasGetMap: !!maybeMap?.getMap,
        getMapReturnedSomething: !!fromGetMap,
        unwrappedHasOnce: hasOnce,
        mapAlreadyLoaded: alreadyLoaded,
      });
      if (hasOnce) {
        refs.map?.once?.("idle", () => {
          tlog("maplibre 'idle' fired → mapIdle=true");
          mapIdle = true;
          lastRenderAt = performance.now();
        });
      }
    };

    // Hold the @deck.gl/react imperative handle itself rather than eagerly
    // unwrapping `.deck`. The handle exposes `deck` via a live getter, but
    // the underlying Deck instance is created inside DeckGLWithRef's
    // useEffect — which runs *after* the ref callback fires. Capturing
    // `.deck` here would freeze the value at `undefined` and never update.
    const deckRef = (ref: unknown) => {
      deckRefFireCount++;
      refs.deckHandle = ref as DeckHandle | null;
      tlog(`deckRef fire #${deckRefFireCount}`, {
        hasRef: !!ref,
        hasDeckProp:
          typeof (ref as { deck?: unknown })?.deck !== "undefined" ||
          Object.prototype.hasOwnProperty.call(ref ?? {}, "deck"),
      });
    };

    const onAfterRender = () => {
      renderCount++;
      lastRenderAt = performance.now();
      const loadedStates = layers.map(
        (l) => (l as unknown as { isLoaded?: boolean }).isLoaded
      );
      const allLoaded = layers.every(
        (l) => (l as unknown as { isLoaded?: boolean }).isLoaded
      );
      // Log first 5 renders, then every 20th, plus any render that flips a gate.
      if (renderCount <= 5 || renderCount % 20 === 0) {
        tlog(`onAfterRender #${renderCount}`, {
          mapIdle,
          allLoaded,
          loadedStates,
        });
      }
      if (mapIdle && allLoaded && resolveReady) {
        tlog(`gate satisfied (render #${renderCount}); scheduling quiet check`);
        const observed = lastRenderAt;
        setTimeout(() => {
          if (observed === lastRenderAt && resolveReady) {
            tlog("quiet period elapsed → resolving ready");
            resolveReady();
            resolveReady = null;
          }
        }, QUIET_MS);
      }
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
          const loadedStates = layers.map(
            (l) => (l as unknown as { isLoaded?: boolean }).isLoaded
          );
          tlog("TIMEOUT — final state", {
            renderCount,
            mapRefFireCount,
            deckRefFireCount,
            mapIdle,
            allLoaded: layers.every(
              (l) => (l as unknown as { isLoaded?: boolean }).isLoaded
            ),
            loadedStates,
            hasMap: !!refs.map,
            hasDeckHandle: !!refs.deckHandle,
            hasDeck: !!refs.deckHandle?.deck,
          });
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
