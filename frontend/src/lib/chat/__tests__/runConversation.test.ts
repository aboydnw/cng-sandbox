import { describe, it, expect, vi } from "vitest";
import { runConversation } from "../runConversation";
import type { ChatTool, AgentBridge } from "../types";

describe("runConversation tool loop", () => {
  it("executes a tool_use, feeds one tool_result, and continues to end_turn", async () => {
    const calls: unknown[] = [];
    const stream = vi
      .fn()
      .mockImplementationOnce(async function* () {
        yield {
          type: "tool_use",
          toolUse: {
            id: "t1",
            name: "fly_to",
            input: { longitude: 1, latitude: 2, zoom: 5 },
          },
        };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", text: "Flew there." };
        yield { type: "done" };
      });

    const bridge = { flyTo: vi.fn() } as unknown as AgentBridge;
    const flyTo: ChatTool = {
      name: "fly_to",
      schema: { parse: (x: unknown) => x } as never,
      execute: async (input, b) => {
        (b as unknown as { flyTo: (i: unknown) => void }).flyTo(input);
        return { summary: "flew to 2.0, 1.0" };
      },
    };

    const texts: string[] = [];
    const chips: string[] = [];
    await runConversation({
      userText: "take me to the hotspot",
      history: [],
      tools: [flyTo],
      bridge,
      streamChat: stream as never,
      onText: (t) => texts.push(t),
      onToolChip: (c) => chips.push(c.summary),
      onDone: () => calls.push("done"),
    });

    expect(stream).toHaveBeenCalledTimes(2);
    const secondBody = stream.mock.calls[1][0].messages.at(-1);
    expect(secondBody.role).toBe("user");
    expect(secondBody.content).toHaveLength(1);
    expect(secondBody.content[0].type).toBe("tool_result");
    expect(chips).toContain("flew to 2.0, 1.0");
    expect(texts.join("")).toContain("Flew there.");
    expect(calls).toEqual(["done"]);
  });

  it("skips tool execution and surfaces a notice when the turn hits max_tokens", async () => {
    const stream = vi.fn().mockImplementationOnce(async function* () {
      yield { type: "text", text: "Partial answer" };
      yield {
        type: "tool_use",
        toolUse: { id: "t1", name: "fly_to", input: {} },
      };
      yield { type: "done", stopReason: "max_tokens" };
    });
    const execute = vi.fn();
    const truncatedTool: ChatTool = {
      name: "fly_to",
      schema: { parse: (x: unknown) => x } as never,
      execute,
    };
    const errors: string[] = [];
    const chips: string[] = [];
    let done = false;
    await runConversation({
      userText: "long question",
      history: [],
      tools: [truncatedTool],
      bridge: {} as never,
      streamChat: stream as never,
      onText: () => {},
      onToolChip: (c) => chips.push(c.summary),
      onDone: () => {
        done = true;
      },
      onError: (m) => errors.push(m),
    });
    expect(execute).not.toHaveBeenCalled();
    expect(chips).toEqual([]);
    expect(stream).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("cut short");
    expect(done).toBe(true);
  });

  it("returns is_error tool_result when a tool throws, letting the model recover", async () => {
    const stream = vi
      .fn()
      .mockImplementationOnce(async function* () {
        yield {
          type: "tool_use",
          toolUse: {
            id: "t1",
            name: "set_layer_visibility",
            input: { layer_id: "nope", visible: true },
          },
        };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", text: "That layer doesn't exist." };
        yield { type: "done" };
      });
    const failing: ChatTool = {
      name: "set_layer_visibility",
      schema: { parse: (x: unknown) => x } as never,
      execute: async () => {
        throw new Error("unknown layer");
      },
    };
    let errored = false;
    await runConversation({
      userText: "show layer nope",
      history: [],
      tools: [failing],
      bridge: {} as never,
      streamChat: stream as never,
      onText: () => {},
      onToolChip: (c) => {
        errored = Boolean(c.isError);
      },
      onDone: () => {},
    });
    const secondBody = stream.mock.calls[1][0].messages.at(-1);
    expect(secondBody.content[0].is_error).toBe(true);
    expect(errored).toBe(true);
  });
});
