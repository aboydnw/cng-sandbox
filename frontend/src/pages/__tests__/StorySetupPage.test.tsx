import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "../../theme";
import StorySetupPage from "../StorySetupPage";
import { createStoryOnServer } from "../../lib/story";

const navigate = vi.fn();

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
  useWorkspaceDatasets: () => ({
    status: "ready",
    data: [],
    error: null,
    retry: vi.fn(),
  }),
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

function renderPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/story/new"]}>
        <StorySetupPage />
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("StorySetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
