import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

const mockDatasetsResource = vi.fn();

vi.mock("../../hooks/useWorkspaceLibrary", () => ({
  useWorkspaceDatasets: () => mockDatasetsResource(),
}));

import WorkspaceHomePage from "../WorkspaceHomePage";

function resource(overrides: Record<string, unknown> = {}) {
  return {
    data: [],
    status: "success",
    error: null,
    retry: vi.fn(),
    ...overrides,
  };
}

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
  beforeEach(() => {
    mockDatasetsResource.mockReturnValue(resource());
  });

  it("renders only the three most recent non-example datasets", async () => {
    mockDatasetsResource.mockReturnValue(
      resource({
        data: [
          { id: "d1", title: "Alpha", created_at: "2026-05-01T00:00:00Z" },
          { id: "d2", title: "Bravo", created_at: "2026-05-13T00:00:00Z" },
          { id: "d3", title: "Charlie", created_at: "2026-05-10T00:00:00Z" },
          { id: "d4", title: "Delta", created_at: "2026-04-01T00:00:00Z" },
          { id: "ex", title: "Example dataset", is_example: true },
        ],
      })
    );

    renderHome();

    expect(await screen.findByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Delta")).not.toBeInTheDocument();
    expect(screen.queryByText("Example dataset")).not.toBeInTheDocument();
  });

  it("offers map creation and Earth Stories without CNG story actions", () => {
    renderHome();

    expect(screen.getByRole("link", { name: "Create map" })).toHaveAttribute(
      "href",
      "/w/test-workspace/quick-map"
    );
    expect(
      screen.getByRole("link", { name: /explore earth stories on github/i })
    ).toHaveAttribute("href", "https://github.com/aboydnw/earth-stories");
    expect(
      screen.queryByRole("link", { name: /create story/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/recent stories|example stories/i)).toBeNull();
  });

  it("shows a data-only empty state", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: "Start your first map" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/map or story/i)).toBeNull();
  });

  it("shows dataset loading and error states", () => {
    mockDatasetsResource.mockReturnValue(
      resource({ status: "error", error: "Dataset request failed" })
    );
    renderHome();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load your workspace"
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("keeps the raw workspace ID out of the main page content", () => {
    renderHome();
    expect(screen.queryByText(/workspace ID:/i)).not.toBeInTheDocument();
  });
});
