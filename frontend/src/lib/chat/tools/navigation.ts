import { z } from "zod";
import type { ChatTool } from "../types";

const flyToSchema = z
  .object({
    longitude: z.number(),
    latitude: z.number(),
    zoom: z.number(),
    pitch: z.number().optional(),
    bearing: z.number().optional(),
  })
  .strict();

const goToChapterSchema = z
  .object({ chapter_index: z.number().int() })
  .strict();

const setLayerVisibilitySchema = z
  .object({ layer_id: z.string(), visible: z.boolean() })
  .strict();

const highlightLocationSchema = z
  .object({
    longitude: z.number(),
    latitude: z.number(),
    label: z.string(),
  })
  .strict();

const fmt = (n: number) => n.toFixed(1);

export const navigationTools: ChatTool[] = [
  {
    name: "fly_to",
    schema: flyToSchema,
    execute: async (input, bridge) => {
      const { longitude, latitude, zoom, pitch, bearing } = input as z.infer<
        typeof flyToSchema
      >;
      bridge.flyTo(longitude, latitude, zoom, pitch, bearing);
      return { summary: `flew to ${fmt(latitude)}, ${fmt(longitude)}` };
    },
  },
  {
    name: "go_to_chapter",
    schema: goToChapterSchema,
    execute: async (input, bridge) => {
      const { chapter_index } = input as z.infer<typeof goToChapterSchema>;
      bridge.goToChapter(chapter_index);
      const chapter = bridge
        .getChapters()
        .find((c) => c.index === chapter_index);
      const title = chapter ? ` "${chapter.title}"` : "";
      return { summary: `went to chapter ${chapter_index}${title}` };
    },
  },
  {
    name: "set_layer_visibility",
    schema: setLayerVisibilitySchema,
    execute: async (input, bridge) => {
      const { layer_id, visible } = input as z.infer<
        typeof setLayerVisibilitySchema
      >;
      bridge.setLayerVisibility(layer_id, visible);
      return {
        summary: `turned ${layer_id} ${visible ? "on" : "off"}`,
      };
    },
  },
  {
    name: "highlight_location",
    schema: highlightLocationSchema,
    execute: async (input, bridge) => {
      const { longitude, latitude, label } = input as z.infer<
        typeof highlightLocationSchema
      >;
      bridge.highlightLocation(longitude, latitude, label);
      return { summary: `pinned "${label}"` };
    },
  },
];
