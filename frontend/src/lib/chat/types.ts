import type { ZodType } from "zod";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface ApiMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ToolUse {
  id: string;
  name: string;
  input: unknown;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; toolUse: ToolUse }
  | { type: "done"; stopReason?: string }
  | { type: "error"; message?: string };

export interface StreamChatArgs {
  messages: ApiMessage[];
  signal?: AbortSignal;
}

export type StreamChatFn = (args: StreamChatArgs) => AsyncIterable<StreamEvent>;

export interface ToolResult {
  summary: string;
  isError?: boolean;
}

export interface ToolChip {
  name: string;
  summary: string;
  isError?: boolean;
}

export interface ChatTool {
  name: string;
  schema: ZodType;
  execute: (input: unknown, bridge: AgentBridge) => Promise<ToolResult>;
}

/** A visible layer descriptor the data tools query against. */
export interface ActiveLayer {
  layer_id: string;
  type: "raster-cog" | "vector-geoparquet" | "zarr";
  label?: string;
  cogUrl?: string;
  collectionId?: string;
  visible?: boolean;
}

/**
 * Imperative handle the tools drive. Populated by StoryRenderer via
 * useImperativeHandle so the conversation loop stays transport-agnostic.
 */
export interface AgentBridge {
  flyTo: (
    longitude: number,
    latitude: number,
    zoom: number,
    pitch?: number,
    bearing?: number
  ) => void;
  goToChapter: (index: number) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  highlightLocation: (
    longitude: number,
    latitude: number,
    label: string
  ) => void;
  getActiveLayers: () => ActiveLayer[];
  getChapters: () => { index: number; title: string }[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  chips?: ToolChip[];
}
