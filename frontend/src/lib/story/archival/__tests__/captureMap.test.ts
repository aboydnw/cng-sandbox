import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../components/UnifiedMap", () => ({
  UnifiedMap: vi.fn(() => null),
}));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn((container: Element) => ({
    container,
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

import { captureChapterMap } from "../captureMap";
import { createScrollytellingChapter } from "../../types";
import type { Connection } from "../../../../types";

const mockChapter = createScrollytellingChapter({
  id: "ch1",
  title: "Test",
  narrative: "",
  order: 0,
  map_state: {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    basemap: "positron",
  },
  layer_config: {
    dataset_id: "",
    connection_id: "portable-x",
    colormap: "viridis",
    opacity: 1,
    basemap: "positron",
  },
});

const mockConnection: Connection = {
  id: "portable-x",
  name: "x",
  url: "https://example.com/cog.tif",
  connection_type: "cog",
  tile_type: "raster",
  bounds: null,
  min_zoom: null,
  max_zoom: null,
  band_count: null,
  rescale: null,
  workspace_id: null,
  is_categorical: false,
  categories: null,
  tile_url: null,
  render_path: "client",
  conversion_status: "ready",
  conversion_error: null,
  feature_count: null,
  file_size: null,
  is_shared: false,
  preferred_colormap: null,
  preferred_colormap_reversed: null,
  config: null,
  geozarr_attrs: null,
  created_at: "",
};

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("captureChapterMap", () => {
  it("rejects with a timeout error after 30s if the map never settles", async () => {
    vi.useFakeTimers();
    const promise = captureChapterMap({
      chapter: mockChapter,
      datasetMap: new Map(),
      connectionMap: new Map([["portable-x", mockConnection]]),
    });
    const failure = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
  });

  it("appends a hidden host to document.body and removes it on completion", async () => {
    vi.useFakeTimers();
    const promise = captureChapterMap({
      chapter: mockChapter,
      datasetMap: new Map(),
      connectionMap: new Map([["portable-x", mockConnection]]),
    });
    expect(
      document.body.querySelector("[data-archival-capture]")
    ).not.toBeNull();

    const failure = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
    expect(document.body.querySelector("[data-archival-capture]")).toBeNull();
  });
});
