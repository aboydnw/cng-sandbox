import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import type { Dataset } from "../../types";
import type { MapChapter as MapChapterType } from "../../lib/story";

vi.mock("../UnifiedMap", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UnifiedMap: (props: any) => (
    <div data-testid="unified-map">{props.children}</div>
  ),
}));

import { MapChapter } from "../MapChapter";

const TRACKS = [
  {
    trajectory_id: "a",
    path: [
      [0, 0],
      [1, 1],
    ],
    timestamps: [0, 1000],
    speeds: [1, 2],
  },
];

function makeDataset(over: Partial<Dataset>): Dataset {
  return {
    id: "ds",
    dataset_type: "raster",
    trips_url: null,
    tile_url: "/raster/tiles/{z}/{x}/{y}",
    band_count: 3,
    categories: null,
    ...over,
  } as unknown as Dataset;
}

const chapter: MapChapterType = {
  id: "c1",
  order: 0,
  type: "map",
  title: "Map",
  narrative: "",
  map_state: {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    basemap: "streets",
  },
  layer_config: {
    dataset_id: "ds",
    colormap: "viridis",
    opacity: 1,
    basemap: "streets",
  },
  overlays: [],
} as unknown as MapChapterType;

function renderChapter(dataset: Dataset) {
  return render(
    <ChakraProvider value={system}>
      <MapChapter chapter={chapter} chapterIndex={0} dataset={dataset} />
    </ChakraProvider>
  );
}

describe("MapChapter trajectory transport bar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => TRACKS }))
    );
  });

  it("shows the transport bar for a trajectory dataset", async () => {
    renderChapter(
      makeDataset({
        id: "ds",
        dataset_type: "trajectory",
        trips_url: "/storage/ds/trips.json",
      })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Play")).toBeInTheDocument()
    );
    expect(screen.getByLabelText("Scrub time")).toBeInTheDocument();
  });

  it("does not show the transport bar for a raster dataset", () => {
    renderChapter(makeDataset({ id: "ds", dataset_type: "raster" }));
    expect(screen.queryByLabelText("Play")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Scrub time")).not.toBeInTheDocument();
  });
});
