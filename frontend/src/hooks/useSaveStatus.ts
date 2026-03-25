import { useCallback, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useSaveStatus() {
  const [state, setState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaving = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("saving");
  }, []);

  const markSaved = useCallback(() => {
    setState("saved");
    timerRef.current = setTimeout(() => setState("idle"), 3000);
  }, []);

  const markError = useCallback(() => {
    setState("error");
  }, []);

  return { saveState: state, markSaving, markSaved, markError };
}
