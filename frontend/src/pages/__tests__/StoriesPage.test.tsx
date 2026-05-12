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

export { renderStoriesPage };
