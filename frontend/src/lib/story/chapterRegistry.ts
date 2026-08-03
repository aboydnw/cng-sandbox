import type { ComponentType } from "react";
import {
  Article,
  ChartLine,
  Image,
  MapTrifold,
  PaperPlaneTilt,
  Path,
  VideoCamera,
} from "@phosphor-icons/react";
import type { ChapterType } from "./types";
import { CHAPTER_TYPE_DESCRIPTIONS, CHAPTER_TYPE_LABELS } from "./labels";

export interface ChapterTypeDefinition {
  type: ChapterType;
  group: "map" | "media" | "writing";
  label: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  prominence: "primary" | "secondary";
  requiresData: boolean;
}

function definition(
  type: ChapterType,
  values: Omit<ChapterTypeDefinition, "type" | "label" | "description">
): ChapterTypeDefinition {
  return {
    type,
    label: CHAPTER_TYPE_LABELS[type],
    description: CHAPTER_TYPE_DESCRIPTIONS[type],
    ...values,
  };
}

export const CHAPTER_TYPE_REGISTRY: ChapterTypeDefinition[] = [
  definition("scrollytelling", {
    group: "map",
    icon: Path,
    prominence: "primary",
    requiresData: true,
  }),
  definition("map", {
    group: "map",
    icon: MapTrifold,
    prominence: "primary",
    requiresData: true,
  }),
  definition("image", {
    group: "media",
    icon: Image,
    prominence: "primary",
    requiresData: false,
  }),
  definition("prose", {
    group: "writing",
    icon: Article,
    prominence: "primary",
    requiresData: false,
  }),
  definition("video", {
    group: "media",
    icon: VideoCamera,
    prominence: "secondary",
    requiresData: false,
  }),
  definition("chart", {
    group: "media",
    icon: ChartLine,
    prominence: "secondary",
    requiresData: false,
  }),
  definition("flyover", {
    group: "map",
    icon: PaperPlaneTilt,
    prominence: "secondary",
    requiresData: false,
  }),
];

export function chapterTypeDefinition(type: ChapterType) {
  return CHAPTER_TYPE_REGISTRY.find((item) => item.type === type)!;
}
