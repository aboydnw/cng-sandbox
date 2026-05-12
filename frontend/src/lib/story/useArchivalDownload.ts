import { useRef, useState } from "react";
import { downloadArchivalHtml } from "./archival/downloadArchival";

interface ArchivalProgressState {
  open: boolean;
  current: number;
  total: number;
}

export function useArchivalDownload(storyId: string, storyTitle: string) {
  const [progress, setProgress] = useState<ArchivalProgressState>({
    open: false,
    current: 0,
    total: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  async function handleArchival() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ open: true, current: 0, total: 1 });
    try {
      await downloadArchivalHtml(
        storyId,
        storyTitle,
        (current, total) => {
          if (controller.signal.aborted) return;
          setProgress({ open: true, current, total });
        },
        controller.signal
      );
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        console.error("Failed to download archival HTML", err);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setProgress({ open: false, current: 0, total: 0 });
      }
    }
  }

  function handleCancelArchival() {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress({ open: false, current: 0, total: 0 });
  }

  return { progress, handleArchival, handleCancelArchival };
}
