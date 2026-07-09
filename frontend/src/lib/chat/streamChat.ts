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
      if (done) {
        buffer += decoder.decode();
        const parsed = parseSseEvent(buffer);
        if (parsed) yield parsed;
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let boundary = EVENT_BOUNDARY.exec(buffer);
      while (boundary !== null) {
        const rawEvent = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const parsed = parseSseEvent(rawEvent);
        if (parsed) yield parsed;
        boundary = EVENT_BOUNDARY.exec(buffer);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Per the SSE spec, events end at a blank line and lines may be terminated by
// CRLF, LF, or CR. sse-starlette (the server) emits CRLF.
const EVENT_BOUNDARY = /\r\n\r\n|\n\n|\r\r/;
const LINE_BREAK = /\r\n|\n|\r/;

function parseSseEvent(raw: string): StreamEvent | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of raw.split(LINE_BREAK)) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;

  let data: Record<string, unknown>;
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
    return {
      type: "done",
      stopReason:
        typeof data.stop_reason === "string" ? data.stop_reason : undefined,
    };
  }
  if (eventName === "error") {
    return { type: "error", message: String(data.message ?? "error") };
  }
  return null;
}
