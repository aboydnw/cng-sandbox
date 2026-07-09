import { useEffect, useState } from "react";
import { config } from "../../config";

export interface ChatConfigState {
  enabled: boolean;
  loading: boolean;
}

/** Fetch /api/chat/config once on mount to gate the trigger button. */
export function useChatConfig(): ChatConfigState {
  const [state, setState] = useState<ChatConfigState>({
    enabled: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${config.apiBase}/api/chat/config`);
        const data = resp.ok ? await resp.json() : { enabled: false };
        if (!cancelled) {
          setState({ enabled: Boolean(data.enabled), loading: false });
        }
      } catch {
        if (!cancelled) setState({ enabled: false, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
