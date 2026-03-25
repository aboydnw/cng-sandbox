import { useState } from "react";

const STORAGE_KEY = "story-editor-tooltips-seen";

function getSeenKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function useTooltipDismiss() {
  const [seen, setSeen] = useState<Set<string>>(getSeenKeys);

  function shouldShow(key: string): boolean {
    return !seen.has(key);
  }

  function dismiss(key: string) {
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return { shouldShow, dismiss };
}
