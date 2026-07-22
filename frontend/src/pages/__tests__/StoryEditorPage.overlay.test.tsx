import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

vi.mock("../../components/UnifiedMap", () => ({
  UnifiedMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="unified-map">{children}</div>
  ),
}));

const mapChapter = {
  id: "ch1",
  order: 0,
  type: "map",
  title: "M",
  narrative: "",
  map_state: {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    basemap: "streets",
  },
  layer_config: {
    dataset_id: "ds-1",
    colormap: "viridis",
    opacity: 0.8,
    basemap: "streets",
  },
  overlays: [],
};

const story = {
  id: "s1",
  title: "S",
  description: "",
  dataset_id: null,
  dataset_ids: [],
  published: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  chapters: [mapChapter],
};

const noop = () => {};

vi.mock("../../hooks/useStoryEditor", () => ({
  useStoryEditor: () => ({
    story,
    loading: false,
    error: null,
    activeChapter: mapChapter,
    activeChapterId: "ch1",
    activeDataset: null,
    camera: { longitude: 0, latitude: 0, zoom: 2, pitch: 0, bearing: 0 },
    basemap: "streets",
    viewSavedFlash: false,
    publishDialogOpen: false,
    transitionDuration: undefined,
    mapContainerRef: { current: null },
    allDatasets: [],
    allConnections: [],
    uploadModalOpen: false,
    saveState: "idle",
    layers: [],
    previewRenderMetadata: undefined,
    workspacePath: (p: string) => p,
    updateStory: noop,
    selectChapter: noop,
    handleCameraChange: noop,
    resetView: noop,
    addChapter: noop,
    deleteChapter: noop,
    reorderChapters: noop,
    updateChapterTitle: noop,
    updateChapterNarrative: noop,
    updateChapterLayerConfig: noop,
    updateChapterOverlays: noop,
    updateChapterType: noop,
    updateChapterOverlayPosition: noop,
    updateChapterMapState: noop,
    updateChapter: noop,
    previewFlyoverPose: noop,
    handleDatasetReady: noop,
    handlePublish: noop,
    handleUnpublish: noop,
    setBasemap: noop,
    setPublishDialogOpen: noop,
    setUploadModalOpen: noop,
    handleConnectionCreated: noop,
  }),
}));

import StoryEditorPage from "../StoryEditorPage";

describe("StoryEditorPage overlays", () => {
  it("shows the overlay editor for a map chapter", async () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <MemoryRouter initialEntries={["/w/test/story/s1/edit"]}>
          <StoryEditorPage />
        </MemoryRouter>
      </ChakraProvider>
    );
    expect(await screen.findByText(/overlay layers/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add overlay/i })
    ).toBeInTheDocument();
  });

  it("moves between mobile editor tabs with arrow keys", async () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <MemoryRouter initialEntries={["/w/test/story/s1/edit"]}>
          <StoryEditorPage />
        </MemoryRouter>
      </ChakraProvider>
    );
    const editTab = await screen.findByRole("tab", { name: /edit/i });
    fireEvent.keyDown(editTab, { key: "ArrowLeft" });
    const previewTab = screen.getByRole("tab", { name: /preview/i });
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(previewTab).toHaveFocus());
  });
});
