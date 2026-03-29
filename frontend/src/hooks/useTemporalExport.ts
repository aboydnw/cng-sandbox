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

  const runExport = useCallback(
    async (
      format: "gif" | "mp4",
      setActiveIndex: (i: number) => void,
      renderFrames: (
        validTimesteps: Timestep[],
        captureFrame: (index: number) => Promise<HTMLCanvasElement | null>,
        onProgress: (current: number, total: number) => void
      ) => Promise<void>
    ) => {
      const reset = () =>
        setState({ isExporting: false, format: null, progress: null });
      try {
        setActiveIndexRef.current = setActiveIndex;
        const validTimesteps = timesteps.filter((_, i) => !gapIndices.has(i));
        setState({
          isExporting: true,
          format,
          progress: { current: 0, total: validTimesteps.length },
        });
        const onProgress = (current: number, total: number) =>
          setState((prev) => ({ ...prev, progress: { current, total } }));

        await renderFrames(validTimesteps, captureFrame, onProgress);
        reset();
      } catch {
        reset();
      }
    },
    [timesteps, gapIndices, captureFrame]
  );

  const exportGif = useCallback(
    async (setActiveIndex: (i: number) => void) => {
      await runExport("gif", setActiveIndex, async (validTimesteps, capture, onProgress) => {
        const GIF = (await import("gif.js")).default;
        const gif = new GIF({
          workers: 2,
          quality: 10,
          workerScript: "/gif.worker.js",
        });

        for (let i = 0; i < validTimesteps.length; i++) {
          const canvas = await capture(validTimesteps[i].index);
          if (canvas) gif.addFrame(canvas, { delay: speedMs });
          onProgress(i + 1, validTimesteps.length);
        }

        await new Promise<void>((resolve, reject) => {
          gif.on("finished", (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "animation.gif";
            a.click();
            URL.revokeObjectURL(url);
            resolve();
          });
          gif.on("error", reject);
          gif.render();
        });
      });
    },
    [runExport, speedMs]
  );

  const exportMp4 = useCallback(
    async (setActiveIndex: (i: number) => void) => {
      await runExport("mp4", setActiveIndex, async (validTimesteps, capture, onProgress) => {
        const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
        const canvas = deckRef.current?.deck?.canvas;
        if (!canvas) return;

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
          const frame = await capture(validTimesteps[i].index);
          if (frame) {
            const videoFrame = new VideoFrame(frame, {
              timestamp: i * speedMs * 1000,
            });
            encoder.encode(videoFrame);
            videoFrame.close();
          }
          onProgress(i + 1, validTimesteps.length);
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
      });
    },
    [runExport, speedMs, deckRef]
  );

  return { ...state, exportGif, exportMp4 };
}
