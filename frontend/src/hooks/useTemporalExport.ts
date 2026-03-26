import { useState, useCallback, useRef } from "react";
import type { Timestep } from "../types";

interface ExportState {
  isExporting: boolean;
  format: "gif" | "mp4" | null;
  progress: { current: number; total: number } | null;
}

export function useTemporalExport(
  deckRef: React.RefObject<{ deck?: { canvas?: HTMLCanvasElement } } | null>,
  timesteps: Timestep[],
  gapIndices: Set<number>,
  speedMs: number
) {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    format: null,
    progress: null,
  });
  const setActiveIndexRef = useRef<((i: number) => void) | null>(null);

  const captureFrame = useCallback(
    async (index: number): Promise<HTMLCanvasElement | null> => {
      if (setActiveIndexRef.current) setActiveIndexRef.current(index);
      await new Promise((r) => setTimeout(r, 200));
      const canvas = deckRef.current?.deck?.canvas;
      if (!canvas) return null;
      const clone = document.createElement("canvas");
      clone.width = canvas.width;
      clone.height = canvas.height;
      const ctx = clone.getContext("2d");
      ctx?.drawImage(canvas, 0, 0);
      return clone;
    },
    [deckRef]
  );

  const exportGif = useCallback(
    async (setActiveIndex: (i: number) => void) => {
      const reset = () =>
        setState({ isExporting: false, format: null, progress: null });
      try {
        const GIF = (await import("gif.js")).default;
        setActiveIndexRef.current = setActiveIndex;
        const validTimesteps = timesteps.filter((_, i) => !gapIndices.has(i));
        setState({
          isExporting: true,
          format: "gif",
          progress: { current: 0, total: validTimesteps.length },
        });

        const gif = new GIF({
          workers: 2,
          quality: 10,
          workerScript: "/gif.worker.js",
        });
        for (let i = 0; i < validTimesteps.length; i++) {
          const canvas = await captureFrame(validTimesteps[i].index);
          if (canvas) gif.addFrame(canvas, { delay: speedMs });
          setState((prev) => ({
            ...prev,
            progress: { current: i + 1, total: validTimesteps.length },
          }));
        }

        gif.on("finished", (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "animation.gif";
          a.click();
          URL.revokeObjectURL(url);
          reset();
        });
        gif.on("error", reset);
        gif.render();
      } catch {
        reset();
      }
    },
    [timesteps, gapIndices, speedMs, captureFrame]
  );

  const exportMp4 = useCallback(
    async (setActiveIndex: (i: number) => void) => {
      const reset = () =>
        setState({ isExporting: false, format: null, progress: null });
      try {
        const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
        setActiveIndexRef.current = setActiveIndex;
        const validTimesteps = timesteps.filter((_, i) => !gapIndices.has(i));
        setState({
          isExporting: true,
          format: "mp4",
          progress: { current: 0, total: validTimesteps.length },
        });

        const canvas = deckRef.current?.deck?.canvas;
        if (!canvas) {
          reset();
          return;
        }

        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: { codec: "avc", width: canvas.width, height: canvas.height },
          fastStart: "in-memory",
        });

        const encoder = new VideoEncoder({
          output: (chunk, meta) =>
            muxer.addVideoChunk(chunk, meta ?? undefined),
          error: console.error,
        });
        encoder.configure({
          codec: "avc1.42001f",
          width: canvas.width,
          height: canvas.height,
          bitrate: 2_000_000,
          framerate: 1000 / speedMs,
        });

        for (let i = 0; i < validTimesteps.length; i++) {
          const frame = await captureFrame(validTimesteps[i].index);
          if (frame) {
            const videoFrame = new VideoFrame(frame, {
              timestamp: i * speedMs * 1000,
            });
            encoder.encode(videoFrame);
            videoFrame.close();
          }
          setState((prev) => ({
            ...prev,
            progress: { current: i + 1, total: validTimesteps.length },
          }));
        }

        await encoder.flush();
        encoder.close();
        muxer.finalize();

        const buffer = (muxer.target as InstanceType<typeof ArrayBufferTarget>)
          .buffer;
        const blob = new Blob([buffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "animation.mp4";
        a.click();
        URL.revokeObjectURL(url);
        reset();
      } catch {
        reset();
      }
    },
    [timesteps, gapIndices, speedMs, deckRef, captureFrame]
  );

  return { ...state, exportGif, exportMp4 };
}
