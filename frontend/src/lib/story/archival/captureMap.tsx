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

    const camera = {
      longitude: chapter.map_state.center[0],
      latitude: chapter.map_state.center[1],
      zoom: chapter.map_state.zoom,
      bearing: chapter.map_state.bearing,
      pitch: chapter.map_state.pitch,
    };

    const refs: { map: MapInstance | null; deck: DeckInstance | null } = {
      map: null,
      deck: null,
    };
    let lastRenderAt = 0;
    let mapIdle = false;
    let resolveReady: (() => void) | null = null;

    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    const mapRef = (ref: unknown) => {
      const maybeMap = ref as { getMap?: () => MapInstance } | null;
      refs.map = maybeMap?.getMap?.() ?? (maybeMap as MapInstance | null);
      refs.map?.once?.("idle", () => {
        mapIdle = true;
        lastRenderAt = performance.now();
      });
    };

    const deckRef = (ref: unknown) => {
      const maybeDeck = ref as { deck?: DeckInstance } | null;
      refs.deck = maybeDeck?.deck ?? null;
    };

    const onAfterRender = () => {
      lastRenderAt = performance.now();
      const allLoaded = layers.every(
        (l) => (l as unknown as { isLoaded?: boolean }).isLoaded
      );
      if (mapIdle && allLoaded && resolveReady) {
        const observed = lastRenderAt;
        setTimeout(() => {
          if (observed === lastRenderAt && resolveReady) {
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
          reject(
            new Error(`Chapter snapshot timed out after ${TIMEOUT_MS / 1000}s`)
          );
        }, TIMEOUT_MS);
      }),
    ]);

    const basemapCanvas = refs.map?.getCanvas?.();
    const deckCanvas = refs.deck?.canvas;
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
