import type {
  AgentBridge,
  ApiMessage,
  ChatTool,
  ContentBlock,
  StreamChatFn,
  ToolChip,
  ToolUse,
} from "./types";

export interface RunConversationArgs {
  userText: string;
  history: ApiMessage[];
  tools: ChatTool[];
  bridge: AgentBridge;
  streamChat: StreamChatFn;
  onText: (text: string) => void;
  onToolChip: (chip: ToolChip) => void;
  onDone: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
  maxIterations?: number;
}

function coalesceText(blocks: ContentBlock[]): ContentBlock[] {
  const out: ContentBlock[] = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    if (block.type === "text" && last && last.type === "text") {
      last.text += block.text;
    } else {
      out.push({ ...block });
    }
  }
  return out;
}

/**
 * Drive the client-side tool loop: stream a turn, execute any tool_use blocks
 * locally against the bridge, append all tool_results in one user message, and
 * re-stream until the model ends a turn with no tool call. Tool throws become
 * is_error tool_results so the model can recover.
 */
export async function runConversation(
  args: RunConversationArgs
): Promise<ApiMessage[]> {
  const {
    userText,
    history,
    tools,
    bridge,
    streamChat,
    onText,
    onToolChip,
    onDone,
    onError,
    signal,
  } = args;
  const maxIterations = args.maxIterations ?? 8;

  const messages: ApiMessage[] = [
    ...history,
    { role: "user", content: userText },
  ];
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const assistantBlocks: ContentBlock[] = [];
    const toolUses: ToolUse[] = [];

    for await (const event of streamChat({ messages, signal })) {
      if (event.type === "text") {
        onText(event.text);
        assistantBlocks.push({ type: "text", text: event.text });
      } else if (event.type === "tool_use") {
        toolUses.push(event.toolUse);
        assistantBlocks.push({
          type: "tool_use",
          id: event.toolUse.id,
          name: event.toolUse.name,
          input: event.toolUse.input,
        });
      } else if (event.type === "error") {
        onError?.(event.message ?? "The assistant hit an error.");
        onDone();
        return messages;
      }
    }

    if (toolUses.length === 0) {
      onDone();
      return messages;
    }

    messages.push({
      role: "assistant",
      content: coalesceText(assistantBlocks),
    });

    const toolResults: ContentBlock[] = [];
    for (const toolUse of toolUses) {
      const tool = toolByName.get(toolUse.name);
      let summary: string;
      let isError = false;
      if (!tool) {
        summary = `Unknown tool: ${toolUse.name}`;
        isError = true;
      } else {
        try {
          const parsed = tool.schema.parse(toolUse.input);
          const result = await tool.execute(parsed, bridge);
          summary = result.summary;
          isError = Boolean(result.isError);
        } catch (error) {
          summary = error instanceof Error ? error.message : "Tool failed";
          isError = true;
        }
      }
      onToolChip({ name: toolUse.name, summary, isError });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: summary,
        ...(isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Exhausted maxIterations while the model was still calling tools — the turn
  // was cut off, not completed. Tell the caller so it isn't shown as a clean end.
  onError?.(
    "Reached the tool-call limit for this turn — try a narrower question."
  );
  onDone();
  return messages;
}
