import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

vi.mock("../../lib/story/api", () => ({
  listStoriesFromServer: vi.fn().mockResolvedValue([]),
  deleteStoryFromServer: vi.fn().mockResolvedValue(undefined),
  forkStoryOnServer: vi.fn(),
}));

import App from "../../App";
import StoriesPage from "../StoriesPage";

function renderApp(initialPath: string) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </ChakraProvider>
  );
}

function renderStoriesPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={
              <WorkspaceProvider>
                <StoriesPage />
              </WorkspaceProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("Workspace routing", () => {
  it("renders WorkspaceHomePage at workspace root (/), not StoriesPage", async () => {
    renderApp("/w/test-workspace");
    expect(
      await screen.findByRole("heading", { name: /your workspace/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^stories$/i })
    ).not.toBeInTheDocument();
  });

  it("renders UploadPage at /quick-map", async () => {
    renderApp("/w/test-workspace/quick-map");
    expect(
      await screen.findByRole("heading", {
        name: /create a map from your data/i,
      })
    ).toBeInTheDocument();
  });

  it("renders StoriesPage at /w/:id/stories", async () => {
    renderApp("/w/test-workspace/stories");
    expect(
      await screen.findByRole("heading", { name: /^stories$/i })
    ).toBeInTheDocument();
  });
});

import { listStoriesFromServer } from "../../lib/story/api";
import type { Story } from "../../lib/story/types";

describe("StoriesPage layout", () => {
  it("renders a 'Quick map' link in the header pointing to /quick-map", async () => {
    renderStoriesPage();
    const link = await screen.findByRole("link", { name: /quick map/i });
    expect(link.getAttribute("href")).toBe("/w/test-workspace/quick-map");
  });

  it("renders a 'New story' link in the header pointing to /story/new", async () => {
    renderStoriesPage();
    const link = await screen.findByRole("link", { name: /new story/i });
    expect(link.getAttribute("href")).toBe("/w/test-workspace/story/new");
  });
});

describe("StoriesPage no longer renders example cards", () => {
  it("does not render ExampleStoryCard when the API returns is_example rows", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "ex-1",
        title: "An Example",
        chapters: [],
        is_example: true,
        published: true,
        updated_at: "2026-05-13T00:00:00Z",
      } as unknown as Story,
    ]);
    renderStoriesPage();
    await waitFor(() => {
      expect(listStoriesFromServer).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("heading", { name: /example stories/i })
    ).toBeNull();
    expect(screen.queryByText("An Example")).toBeNull();
  });
});

describe("StoriesPage fetch failure", () => {
  it("shows an error message instead of the empty state when the fetch rejects", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Failed to list stories: 500")
    );
    renderStoriesPage();

    expect(
      await screen.findByText(/couldn’t load your stories/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/no stories yet/i)).not.toBeInTheDocument();
  });
});

export { renderStoriesPage };
