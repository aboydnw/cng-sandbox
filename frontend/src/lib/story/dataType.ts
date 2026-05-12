import type { Story } from "./types";

export function inferDataType(story: Story): string {
  const types = new Set<string>();
  for (const ch of story.chapters) {
    const t = (ch as { type?: string }).type;
    if (t === "map") types.add("Map");
    if (t === "chart") types.add("Chart");
    if (t === "image") types.add("Image");
    if (t === "video") types.add("Video");
    if (t === "prose") types.add("Prose");
  }
  if (types.size === 0) return "Story";
  if (types.size === 1) return Array.from(types)[0];
  return "Mixed";
}
