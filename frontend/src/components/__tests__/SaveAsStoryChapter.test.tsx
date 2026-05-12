import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

vi.mock("../../lib/story/api", () => ({
  listStoriesFromServer: vi.fn(),
  getStoryFromServer: vi.fn(),
  saveStoryToServer: vi.fn(),
  createStoryOnServer: vi.fn(),
}));

import {
  listStoriesFromServer,
  getStoryFromServer,
  saveStoryToServer,
  createStoryOnServer,
} from "../../lib/story/api";
import { SaveAsStoryChapter } from "../SaveAsStoryChapter";

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={<WorkspaceProvider>{ui}</WorkspaceProvider>}
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

const baseDataset = {
  id: "ds-1",
  filename: "foo.tif",
  title: "Foo",
  bounds: [-180, -90, 180, 90],
  preferred_colormap: null,
  preferred_colormap_reversed: null,
};

describe("SaveAsStoryChapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("renders a trigger button with the save-as-chapter label", async () => {
    renderWithRouter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SaveAsStoryChapter dataset={baseDataset as any} connection={null} />
    );
    expect(
      await screen.findByRole("button", { name: /save as story chapter/i })
    ).toBeInTheDocument();
  });

  it("opens a menu with 'New story' and any of the user's own (non-example) stories", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "u-1", title: "My draft", is_example: false, chapters: [] },
      { id: "ex-1", title: "Example", is_example: true, chapters: [] },
    ]);
    renderWithRouter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SaveAsStoryChapter dataset={baseDataset as any} connection={null} />
    );
    const trigger = await screen.findByRole("button", {
      name: /save as story chapter/i,
    });
    const user = userEvent.setup();
    await user.click(trigger);
    expect(
      await screen.findByRole("menuitem", { name: /new story/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("menuitem", { name: /my draft/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /example$/i })).toBeNull();
  });

  it("creates a new story when 'New story' is clicked", async () => {
    (createStoryOnServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "new-id",
      chapters: [],
    });
    renderWithRouter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SaveAsStoryChapter dataset={baseDataset as any} connection={null} />
    );
    const trigger = await screen.findByRole("button", {
      name: /save as story chapter/i,
    });
    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(
      await screen.findByRole("menuitem", { name: /new story/i })
    );
    expect(createStoryOnServer).toHaveBeenCalled();
  });

  it("appends a map chapter to an existing story when picked", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "u-1",
        title: "My draft",
        is_example: false,
        chapters: [
          { id: "c0", order: 0, type: "prose", title: "x", narrative: "" },
        ],
      },
    ]);
    (getStoryFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "u-1",
      title: "My draft",
      description: null,
      dataset_id: null,
      dataset_ids: [],
      chapters: [
        { id: "c0", order: 0, type: "prose", title: "x", narrative: "" },
      ],
      published: false,
      is_example: false,
    });
    (saveStoryToServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "u-1",
    });

    renderWithRouter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SaveAsStoryChapter dataset={baseDataset as any} connection={null} />
    );
    const trigger = await screen.findByRole("button", {
      name: /save as story chapter/i,
    });
    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(
      await screen.findByRole("menuitem", { name: /my draft/i })
    );
    expect(getStoryFromServer).toHaveBeenCalledWith("u-1");
    expect(saveStoryToServer).toHaveBeenCalled();
    const savedStory = (saveStoryToServer as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(savedStory.chapters.length).toBe(2);
    expect(savedStory.chapters[1].type).toBe("map");
    expect(savedStory.chapters[1].order).toBe(1);
    expect(savedStory.chapters[1].layer_config.dataset_id).toBe("ds-1");
  });

  it("derives next chapter order from max(order)+1, not array length", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "u-1",
        title: "My draft",
        is_example: false,
        chapters: [
          { id: "c0", order: 0, type: "prose", title: "a", narrative: "" },
          { id: "c2", order: 5, type: "prose", title: "b", narrative: "" },
        ],
      },
    ]);
    (getStoryFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "u-1",
      title: "My draft",
      description: null,
      dataset_id: null,
      dataset_ids: [],
      chapters: [
        { id: "c0", order: 0, type: "prose", title: "a", narrative: "" },
        { id: "c2", order: 5, type: "prose", title: "b", narrative: "" },
      ],
      published: false,
      is_example: false,
    });
    (saveStoryToServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "u-1",
    });

    renderWithRouter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <SaveAsStoryChapter dataset={baseDataset as any} connection={null} />
    );
    const trigger = await screen.findByRole("button", {
      name: /save as story chapter/i,
    });
    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(
      await screen.findByRole("menuitem", { name: /my draft/i })
    );
    const savedStory = (saveStoryToServer as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(savedStory.chapters[2].order).toBe(6);
  });
});
