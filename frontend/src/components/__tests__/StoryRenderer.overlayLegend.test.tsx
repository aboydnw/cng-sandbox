import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Story } from "../../lib/story";
import type { Connection, Dataset } from "../../types";

vi.mock("../UnifiedMap", () => ({
  UnifiedMap: () => <div data-testid="unified-map" />,
}));

vi.mock("scrollama", () => ({
  default: () => ({
    setup: () => ({
      onStepEnter: () => ({ onStepExit: () => ({}) }),
    }),
    onStepEnter: () => ({ onStepExit: () => ({}) }),
    onStepExit: () => ({}),
    resize: () => {},
    destroy: () => {},
    enable: () => {},
    disable: () => {},
  }),
}));

import { StoryRenderer } from "../StoryRenderer";

const overlayConn = {
  id: "conn-admin",
  name: "Admin boundaries",
  connection_type: "pmtiles",
  tile_type: "vector",
  url: "https://x/admin.pmtiles",
} as unknown as Connection;

const story = {
  id: "s1",
  title: "S",
  dataset_id: null,
  dataset_ids: [],
  published: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  chapters: [
    {
      id: "ch1",
      order: 0,
      type: "scrollytelling",
      title: "M",
      narrative: "text",
      transition: "fly-to",
      overlay_position: "left",
      map_state: {
        center: [0, 0],
        zoom: 2,
        bearing: 0,
        pitch: 0,
        basemap: "streets",
      },
      layer_config: {
        dataset_id: "",
        connection_id: "conn-admin",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
      },
      overlays: [{ connection_id: "conn-admin", opacity: 1, visible: true }],
    },
  ],
} as unknown as Story;

describe("StoryRenderer overlay legend", () => {
  it("renders visible overlay names in the reader legend", () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <StoryRenderer
          story={story}
          datasetMap={new Map<string, Dataset | null>()}
          connectionMap={new Map([["conn-admin", overlayConn]])}
        />
      </ChakraProvider>
    );
    expect(screen.getAllByText(/admin boundaries/i).length).toBeGreaterThan(0);
  });
});
