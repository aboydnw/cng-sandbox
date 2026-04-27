import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ChapterPreview } from "../ChapterPreview";
import { createProseChapter } from "../../../lib/story/types";

function wrap(node: React.ReactNode) {
  return <ChakraProvider value={defaultSystem}>{node}</ChakraProvider>;
}

describe("ChapterPreview", () => {
  it("renders a prose preview using ProseChapter content", () => {
    const ch = createProseChapter({ title: "Intro", narrative: "Hello world" });
    render(wrap(<ChapterPreview chapter={ch} />));
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders nothing for map-bound chapters (caller mounts the map directly)", () => {
    // Map-bound chapters render the editable UnifiedMap in the parent component,
    // not via ChapterPreview. The dispatcher returns null for those types.
    const ch = { id: "x", order: 0, title: "T", narrative: "", type: "map" as const,
      map_state: { center: [0,0] as [number, number], zoom: 2, bearing: 0, pitch: 0, basemap: "streets" },
      layer_config: { dataset_id: "x", colormap: "viridis", opacity: 0.8, basemap: "streets" } };
    const { container } = render(wrap(<ChapterPreview chapter={ch} />));
    expect(container.firstChild).toBeNull();
  });
});
