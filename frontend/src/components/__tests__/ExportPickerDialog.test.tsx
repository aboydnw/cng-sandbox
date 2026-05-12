import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";
import { ExportPickerDialog } from "../ExportPickerDialog";

vi.mock("../../lib/story/api", () => ({
  listStoriesFromServer: vi.fn(),
}));
vi.mock("../../lib/story/buildStaticBundle", () => ({
  buildAndDownloadBundle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/story/exportConfig", () => ({
  downloadStoryConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/story/archival/downloadArchival", () => ({
  downloadArchivalHtml: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../EmbedSnippet", () => ({
  EmbedSnippet: () => <div data-testid="embed-snippet" />,
}));
vi.mock("../ArchivalProgress", () => ({
  ArchivalProgress: () => null,
}));

import { listStoriesFromServer } from "../../lib/story/api";

function renderPicker(open = true) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test/"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={
              <WorkspaceProvider>
                <ExportPickerDialog open={open} onClose={vi.fn()} />
              </WorkspaceProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("ExportPickerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only the user's own (non-example) stories", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "u-1", title: "Mine", chapters: [], is_example: false },
      { id: "ex-1", title: "Example", chapters: [], is_example: true },
    ]);
    renderPicker();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^mine$/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /^example$/i })).toBeNull();
  });

  it("shows empty state when there are no user stories", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      []
    );
    renderPicker();
    await waitFor(() => {
      expect(screen.getByText(/no stories yet/i)).toBeInTheDocument();
    });
  });

  it("shows an error state when the list fetch fails", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom")
    );
    renderPicker();
    expect(
      await screen.findByText(/could not load stories/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/no stories yet/i)).toBeNull();
  });

  it("clicking a story opens the ExportDialog for it", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "u-1", title: "Mine", chapters: [], is_example: false },
    ]);
    renderPicker();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^mine$/i }));
    expect(
      await screen.findByRole("button", { name: /download static bundle/i })
    ).toBeInTheDocument();
  });
});
