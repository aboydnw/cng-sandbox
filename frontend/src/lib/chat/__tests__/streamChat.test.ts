import { describe, it, expect, vi, afterEach } from "vitest";
import { streamChat } from "../streamChat";
import type { StreamEvent } from "../types";

function responseFromChunks(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

async function collect(chunks: string[]): Promise<StreamEvent[]> {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFromChunks(chunks)));
  const events: StreamEvent[] = [];
  for await (const event of streamChat({ storyId: "s1", messages: [] })) {
    events.push(event);
  }
  return events;
}

afterEach(() => vi.unstubAllGlobals());

describe("streamChat SSE parsing", () => {
  it("parses sse-starlette CRLF-framed events", async () => {
    const events = await collect([
      'event: text\r\ndata: {"text":"hi"}\r\n\r\n',
      'event: done\r\ndata: {"stop_reason":"end_turn"}\r\n\r\n',
    ]);
    expect(events).toEqual([
      { type: "text", text: "hi" },
      { type: "done", stopReason: "end_turn" },
    ]);
  });

  it("parses an event split across two chunks", async () => {
    const events = await collect([
      'event: text\r\ndata: {"te',
      'xt":"split"}\r\n\r\nevent: done\r\ndata: {"stop_reason":"end_turn"}\r\n\r\n',
    ]);
    expect(events[0]).toEqual({ type: "text", text: "split" });
    expect(events[1]).toEqual(expect.objectContaining({ type: "done" }));
  });

  it("parses tool_use events with CRLF framing", async () => {
    const events = await collect([
      'event: tool_use\r\ndata: {"id":"t1","name":"fly_to","input":{"zoom":3}}\r\n\r\n',
    ]);
    expect(events).toEqual([
      {
        type: "tool_use",
        toolUse: { id: "t1", name: "fly_to", input: { zoom: 3 } },
      },
    ]);
  });

  it("still parses LF-framed and CR-framed events", async () => {
    const lf = await collect(['event: text\ndata: {"text":"lf"}\n\n']);
    expect(lf).toEqual([{ type: "text", text: "lf" }]);
    const cr = await collect(['event: text\rdata: {"text":"cr"}\r\r']);
    expect(cr).toEqual([{ type: "text", text: "cr" }]);
  });

  it("flushes a final event that lacks a trailing boundary", async () => {
    const events = await collect(['event: text\r\ndata: {"text":"tail"}']);
    expect(events).toEqual([{ type: "text", text: "tail" }]);
  });
});
