import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

vi.mock("../../lib/story/api", () => ({
  listStoriesFromServer: vi.fn().mockResolvedValue([]),
  deleteStoryFromServer: vi.fn().mockResolvedValue(undefined),
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
  it("renders StoriesPage at workspace root (/)", async () => {
    renderApp("/w/test-workspace");
    expect(
      await screen.findByRole("heading", { name: /your stories/i })
    ).toBeInTheDocument();
  });

  it("renders UploadPage at /quick-map", async () => {
    renderApp("/w/test-workspace/quick-map");
    expect(await screen.findByText(/upload/i)).toBeInTheDocument();
  });

  it("redirects /stories to /", async () => {
    renderApp("/w/test-workspace/stories");
    expect(
      await screen.findByRole("heading", { name: /your stories/i })
    ).toBeInTheDocument();
  });
});

import { listStoriesFromServer } from "../../lib/story/api";

describe("StoriesPage example-story cards", () => {
  it("renders example stories as ExampleStoryCard links, not as table rows", async () => {
    (listStoriesFromServer as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "ex-1",
        title: "Arctic ice loss",
        chapters: [{}, {}, {}, {}],
        is_example: true,
        published: true,
        updated_at: new Date().toISOString(),
      } as any,
    ]);
    renderStoriesPage();
    const link = await screen.findByRole("link", { name: /arctic ice loss/i });
    expect(link.getAttribute("href")).toBe("/w/test-workspace/story/ex-1/edit");
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
