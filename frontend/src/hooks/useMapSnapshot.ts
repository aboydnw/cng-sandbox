import { useCallback, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapRef = React.RefObject<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeckRef = React.RefObject<any>;
type ContainerRef = React.RefObject<HTMLDivElement | null>;

interface UseMapSnapshotArgs {
  mapRef: MapRef;
  deckRef: DeckRef;
  containerRef: ContainerRef;
  filename: string;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useMapSnapshot({
  mapRef,
  deckRef,
  containerRef,
  filename,
}: UseMapSnapshotArgs) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState(false);
  const errorTimeoutRef = useRef<number | null>(null);

  const flashError = useCallback(() => {
    setError(true);
    if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = window.setTimeout(() => setError(false), 2000);
  }, []);

  const snap = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setError(false);

    try {
      const container = containerRef.current;
      const mapInstance = mapRef.current?.getMap?.() ?? mapRef.current;
      const basemapCanvas: HTMLCanvasElement | undefined =
        mapInstance?.getCanvas?.();
      const deckCanvas: HTMLCanvasElement | undefined =
        deckRef.current?.deck?.canvas;

      if (!container || !basemapCanvas || !deckCanvas) {
        throw new Error("map not ready");
      }

      mapInstance?.triggerRepaint?.();
      deckRef.current?.deck?.redraw?.("snapshot");
      await nextFrame();

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const output = document.createElement("canvas");
      output.width = Math.round(rect.width * dpr);
      output.height = Math.round(rect.height * dpr);
      const ctx = output.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable");

      ctx.drawImage(basemapCanvas, 0, 0, output.width, output.height);
      ctx.drawImage(deckCanvas, 0, 0, output.width, output.height);

      const overlays = Array.from(
        container.querySelectorAll<HTMLElement>("[data-snapshot-overlay]")
      );
      for (const overlay of overlays) {
        try {
          const overlayCanvas = await htmlToImage.toCanvas(overlay, {
            pixelRatio: dpr,
          });
          const overlayRect = overlay.getBoundingClientRect();
          const x = (overlayRect.left - rect.left) * dpr;
          const y = (overlayRect.top - rect.top) * dpr;
          ctx.drawImage(overlayCanvas, x, y);
        } catch (err) {
          console.error("snapshot overlay failed", err);
        }
      }

      const blob: Blob | null = await new Promise((resolve) => {
        output.toBlob((b) => resolve(b), "image/png");
      });
      if (!blob) throw new Error("toBlob returned null");

      downloadBlob(blob, filename);
    } catch (err) {
      console.error("map snapshot failed", err);
      flashError();
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, containerRef, mapRef, deckRef, filename, flashError]);

  return { snap, isCapturing, error };
}
