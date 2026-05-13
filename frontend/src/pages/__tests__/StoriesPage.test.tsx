import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

function LocationProbe({ onLocation }: { onLocation: (path: string) => void }) {
  const loc = useLocation();
  onLocation(loc.pathname);
  return null;
}

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
      await screen.findByRole("heading", { name: /workspace home/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /your stories/i })
    ).not.toBeInTheDocument();
  });

  it("renders UploadPage at /quick-map", async () => {
    renderApp("/w/test-workspace/quick-map");
    expect(await screen.findByText(/upload/i)).toBeInTheDocument();
  });

  it("renders StoriesPage at /w/:id/stories", async () => {
    renderApp("/w/test-workspace/stories");
    expect(
      await screen.findByRole("heading", { name: /your stories/i })
    ).toBeInTheDocument();
  });
});

import { listStoriesFromServer, forkStoryOnServer } from "../../lib/story/api";
import type { Story } from "../../lib/story/types";

describe("StoriesPage example-story cards", () => {
  it("renders example stories as clickable cards, not as table rows", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "ex-1",
        title: "Arctic ice loss",
        chapters: [{}, {}, {}, {}],
        is_example: true,
        published: true,
        updated_at: new Date().toISOString(),
      } as unknown as Story,
    ]);
    renderStoriesPage();
    const card = await screen.findByRole("button", {
      name: /arctic ice loss/i,
    });
    expect(card).toBeInTheDocument();
    expect(screen.queryByText("Chapters")).toBeNull();
  });

  it("renders 'No example stories available.' when no examples come back", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      []
    );
    renderStoriesPage();
    expect(
      await screen.findByText(/no example stories available\./i)
    ).toBeInTheDocument();
  });
});

describe("StoriesPage example-story clone-on-click", () => {
  it("forks the example and navigates to the new draft editor", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "ex-1",
        title: "Arctic ice loss",
        chapters: [{}, {}, {}, {}],
        is_example: true,
        published: true,
        updated_at: new Date().toISOString(),
      } as unknown as Story,
    ]);
    (forkStoryOnServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "new-draft-id",
      title: "Arctic ice loss",
      chapters: [],
      is_example: false,
      published: false,
    } as unknown as Story);

    let path = "";
    render(
      <ChakraProvider value={system}>
        <MemoryRouter initialEntries={["/w/test-workspace"]}>
          <Routes>
            <Route
              path="/w/:workspaceId/*"
              element={
                <WorkspaceProvider>
                  <>
                    <StoriesPage />
                    <LocationProbe onLocation={(p) => (path = p)} />
                  </>
                </WorkspaceProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </ChakraProvider>
    );

    const card = await screen.findByRole("button", {
      name: /arctic ice loss/i,
    });
    const user = userEvent.setup();
    await user.click(card);
    expect(forkStoryOnServer).toHaveBeenCalledWith("ex-1");
    await waitFor(() => {
      expect(path).toBe("/w/test-workspace/story/new-draft-id/edit");
    });
  });
});

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

  it("renders 'Your stories' heading before 'Example stories' heading in DOM order", async () => {
    renderStoriesPage();
    const headings = await screen.findAllByRole("heading");
    const texts = headings.map((h) => h.textContent || "");
    const yourIdx = texts.findIndex((t) => /your stories/i.test(t));
    const exampleIdx = texts.findIndex((t) => /example stories/i.test(t));
    expect(yourIdx).toBeGreaterThan(-1);
    expect(exampleIdx).toBeGreaterThan(-1);
    expect(yourIdx).toBeLessThan(exampleIdx);
  });

  it("always renders the Example stories section, even when there are no example stories", async () => {
    renderStoriesPage();
    expect(
      await screen.findByRole("heading", { name: /example stories/i })
    ).toBeInTheDocument();
  });
});

export { renderStoriesPage };
