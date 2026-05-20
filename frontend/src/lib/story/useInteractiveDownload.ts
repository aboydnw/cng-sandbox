import { useEffect, useRef, useState } from "react";
import { downloadInteractiveExport } from "./interactive/downloadInteractive";
import { toaster } from "../toaster";

interface InteractiveProgressState {
  open: boolean;
  current: number;
  total: number;
}

export function useInteractiveDownload(storyId: string, storyTitle: string) {
  const [progress, setProgress] = useState<InteractiveProgressState>({
    open: false,
    current: 0,
    total: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function handleInteractive() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ open: true, current: 0, total: 1 });
    try {
      await downloadInteractiveExport(
        storyId,
        storyTitle,
        (current, total) => {
          if (controller.signal.aborted) return;
          setProgress({ open: true, current, total });
        },
        controller.signal
      );
      if (!controller.signal.aborted) {
        toaster.create({
          title: "Interactive bundle downloaded",
          type: "success",
        });
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        console.error("Failed to download interactive bundle", err);
        toaster.create({
          title: "Interactive export failed",
          description: (err as Error)?.message ?? "Unknown error",
          type: "error",
        });
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setProgress({ open: false, current: 0, total: 0 });
      }
    }
  }

  function handleCancelInteractive() {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress({ open: false, current: 0, total: 0 });
  }

  return { progress, handleInteractive, handleCancelInteractive };
}
