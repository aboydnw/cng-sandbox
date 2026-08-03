import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "../../theme";
import StorySetupPage from "../StorySetupPage";
import { createStoryOnServer } from "../../lib/story";

const navigate = vi.fn();
const useWorkspaceDatasetsMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom"
    );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../hooks/useWorkspace", () => ({
  useWorkspace: () => ({ workspacePath: (path: string) => `/w/ws${path}` }),
  useOptionalWorkspace: () => null,
}));

vi.mock("../../hooks/useWorkspaceLibrary", () => ({
  useWorkspaceDatasets: useWorkspaceDatasetsMock,
}));

vi.mock("../../lib/story", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/story")>("../../lib/story");
  return {
    ...actual,
    createStoryOnServer: vi.fn((story) =>
      Promise.resolve({ ...story, id: "story-created" })
    ),
  };
});

function renderPage(entry = "/story/new") {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[entry]}>
        <StorySetupPage />
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("StorySetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceDatasetsMock.mockReturnValue({
      status: "ready",
      data: [],
      error: null,
      retry: vi.fn(),
    });
  });

  it("does not persist a story before a template is chosen", () => {
    renderPage();
    expect(createStoryOnServer).not.toHaveBeenCalled();
    expect(screen.getByText("Map-led story")).toBeInTheDocument();
    expect(screen.getByText("Media story")).toBeInTheDocument();
    expect(screen.getByText("Blank story")).toBeInTheDocument();
  });

  it("creates the selected template and opens its editor", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Choose Blank story" }));

    await waitFor(() => expect(createStoryOnServer).toHaveBeenCalledOnce());
    expect(navigate).toHaveBeenCalledWith("/w/ws/story/story-created/edit", {
      replace: true,
    });
  });

  it("creates a map chapter even when no dataset was provided", async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Choose Map-led story" })
    );

    await waitFor(() => expect(createStoryOnServer).toHaveBeenCalledOnce());
    const created = vi.mocked(createStoryOnServer).mock.calls[0][0];
    expect(created.chapters[0].type).toBe("map");
  });

  it("waits for a requested dataset before enabling map creation", () => {
    useWorkspaceDatasetsMock.mockReturnValue({
      status: "loading",
      data: [],
      error: null,
      retry: vi.fn(),
    });
    renderPage("/story/new?dataset=dataset-1");

    expect(
      screen.getByRole("button", { name: "Loading selected dataset…" })
    ).toBeDisabled();
    expect(createStoryOnServer).not.toHaveBeenCalled();
  });

  it("offers retry when a requested dataset fails to load", () => {
    const retry = vi.fn();
    useWorkspaceDatasetsMock.mockReturnValue({
      status: "error",
      data: [],
      error: "HTTP 503",
      retry,
    });
    renderPage("/story/new?dataset=dataset-1");

    expect(
      screen.getByRole("button", { name: "Dataset couldn’t load" })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(createStoryOnServer).not.toHaveBeenCalled();
  });

  it("does not create a story for a settled missing dataset", () => {
    renderPage("/story/new?dataset=missing");
    expect(
      screen.getByRole("button", { name: "Dataset unavailable" })
    ).toBeDisabled();
    expect(createStoryOnServer).not.toHaveBeenCalled();
  });
});
