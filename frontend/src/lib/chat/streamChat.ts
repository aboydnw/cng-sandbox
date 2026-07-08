import { config } from "../../config";
import type { ApiMessage, StreamEvent } from "./types";

export interface StreamChatOptions {
  storyId: string;
  messages: ApiMessage[];
  signal?: AbortSignal;
}

/**
 * POST a turn to /api/chat and parse the SSE stream from the response body,
 * yielding one StreamEvent per server event (text | tool_use | done | error).
 */
export async function* streamChat({
  storyId,
  messages,
  signal,
}: StreamChatOptions): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${config.apiBase}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ story_id: storyId, messages }),
    signal,
  });

  if (!response.ok || !response.body) {
    yield {
      type: "error",
      message: `Chat request failed (${response.status})`,
    };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseSseEvent(rawEvent);
        if (parsed) yield parsed;
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseEvent(raw: string): StreamEvent | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    data = {};
  }

  if (eventName === "text") {
    return { type: "text", text: String(data.text ?? "") };
  }
  if (eventName === "tool_use") {
    return {
      type: "tool_use",
      toolUse: {
        id: String(data.id ?? ""),
        name: String(data.name ?? ""),
        input: data.input ?? {},
      },
    };
  }
  if (eventName === "done") {
    return { type: "done" };
  }
  if (eventName === "error") {
    return { type: "error", message: String(data.message ?? "error") };
  }
  return null;
}
