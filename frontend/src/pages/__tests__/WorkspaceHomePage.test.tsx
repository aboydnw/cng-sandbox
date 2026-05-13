import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

const mockListStories = vi.fn();
const mockFetch = vi.fn();

vi.mock("../../lib/story/api", () => ({
  listStoriesFromServer: (...args: unknown[]) => mockListStories(...args),
  forkStoryOnServer: vi.fn(),
}));

vi.mock("../../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    workspaceFetch: (...args: unknown[]) => mockFetch(...args),
  };
});

import WorkspaceHomePage from "../WorkspaceHomePage";
import type { Story } from "../../lib/story/types";

function renderHome() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={
              <WorkspaceProvider>
                <WorkspaceHomePage />
              </WorkspaceProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("WorkspaceHomePage", () => {
  it("renders the three most recent non-example stories", async () => {
    mockListStories.mockResolvedValue([
      {
        id: "s1",
        title: "Older",
        chapters: [],
        is_example: false,
        updated_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "s2",
        title: "Newest",
        chapters: [],
        is_example: false,
        updated_at: "2026-05-13T00:00:00Z",
      },
      {
        id: "s3",
        title: "Middle",
        chapters: [],
        is_example: false,
        updated_at: "2026-05-10T00:00:00Z",
      },
      {
        id: "s4",
        title: "Oldest",
        chapters: [],
        is_example: false,
        updated_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "s-ex",
        title: "Example",
        chapters: [],
        is_example: true,
        updated_at: "2026-05-12T00:00:00Z",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "d-seed",
            title: "Seed dataset",
            filename: "seed.tif",
            is_example: false,
          },
        ]),
    });
    renderHome();
    expect(await screen.findByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("Middle")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
    expect(screen.queryByText("Oldest")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Example$/ })
    ).not.toBeInTheDocument();
  });

  it("renders the three most recent datasets", async () => {
    mockListStories.mockResolvedValue([
      {
        id: "s-seed",
        title: "Seed story",
        chapters: [],
        is_example: false,
        updated_at: "2026-05-01T00:00:00Z",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "d1",
            title: "Alpha",
            filename: "alpha.tif",
            created_at: "2026-05-01T00:00:00Z",
            is_example: false,
          },
          {
            id: "d2",
            title: "Bravo",
            filename: "bravo.tif",
            created_at: "2026-05-13T00:00:00Z",
            is_example: false,
          },
          {
            id: "d3",
            title: "Charlie",
            filename: "charlie.tif",
            created_at: "2026-05-10T00:00:00Z",
            is_example: false,
          },
          {
            id: "d4",
            title: "Delta",
            filename: "delta.tif",
            created_at: "2026-04-01T00:00:00Z",
            is_example: false,
          },
        ]),
    });
    renderHome();
    expect(await screen.findByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Delta")).not.toBeInTheDocument();
  });

  it("links 'View all stories' to /stories and 'View all data' to /data", async () => {
    mockListStories.mockResolvedValue([
      {
        id: "s-seed",
        title: "Seed story",
        chapters: [],
        is_example: false,
        updated_at: "2026-05-01T00:00:00Z",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "d-seed",
            title: "Seed dataset",
            filename: "seed.tif",
            is_example: false,
          },
        ]),
    });
    renderHome();
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /view all stories/i })
      ).toHaveAttribute("href", "/w/test-workspace/stories");
    });
    expect(
      screen.getByRole("link", { name: /view all data/i })
    ).toHaveAttribute("href", "/w/test-workspace/data");
  });

  it("shows example story clone cards when the workspace is empty", async () => {
    mockListStories.mockResolvedValue([
      {
        id: "ex1",
        title: "Example A",
        chapters: [{ id: "c1" }],
        is_example: true,
        updated_at: "2026-05-12T00:00:00Z",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    renderHome();
    expect(
      await screen.findByText(/this workspace is empty/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /example a/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /recent stories/i })
    ).not.toBeInTheDocument();
  });

  it("clones an example into the workspace when its card is clicked", async () => {
    const { forkStoryOnServer } = await import("../../lib/story/api");
    (forkStoryOnServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "fork-9",
      title: "Example A",
      chapters: [],
      is_example: false,
      published: false,
    } as unknown as Story);
    mockListStories.mockResolvedValue([
      {
        id: "ex1",
        title: "Example A",
        chapters: [{ id: "c1" }],
        is_example: true,
        updated_at: "2026-05-12T00:00:00Z",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    renderHome();
    const card = await screen.findByRole("button", { name: /example a/i });
    card.click();
    await waitFor(() => {
      expect(forkStoryOnServer).toHaveBeenCalledWith("ex1");
    });
  });

  it("shows the workspace ID prominently", async () => {
    mockListStories.mockResolvedValue([
      {
        id: "s-seed",
        title: "Seed story",
        chapters: [],
        is_example: false,
        updated_at: "2026-05-01T00:00:00Z",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "d-seed",
            title: "Seed dataset",
            filename: "seed.tif",
            is_example: false,
          },
        ]),
    });
    renderHome();
    const matches = await screen.findAllByText(/test-workspace/);
    expect(matches.length).toBeGreaterThan(0);
  });
});
