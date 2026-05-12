import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { system } from "../../theme";
import LandingPage from "../LandingPage";

vi.mock("../../lib/story/api", () => ({
  listExampleStoriesFromServer: vi.fn().mockResolvedValue([]),
}));

function WorkspaceTarget() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <div data-testid="workspace-target" data-workspace-id={workspaceId} />;
}

function renderLanding(initialEntry: string = "/") {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/w/:workspaceId/*" element={<WorkspaceTarget />} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("LandingPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the open-source demo eyebrow and pitch headline", () => {
    renderLanding();
    expect(
      screen.getByText(/open-source demo · by development seed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /tell stories with cloud-native/i })
    ).toBeInTheDocument();
  });

  it("renders the 'not a hosted product' framing", () => {
    renderLanding();
    expect(screen.getByText(/not a hosted product/i)).toBeInTheDocument();
  });

  it("renders two equal CTAs — Start a story and View on GitHub", () => {
    renderLanding();
    expect(
      screen.getByRole("button", { name: /start a story/i })
    ).toBeInTheDocument();
    const githubCta = screen.getByRole("link", { name: /view on github/i });
    expect(githubCta.getAttribute("href")).toBe(
      "https://github.com/aboydnw/cng-sandbox"
    );
  });

  it("'Start a story' creates a workspace and navigates to it", () => {
    renderLanding();
    fireEvent.click(screen.getByRole("button", { name: /start a story/i }));
    expect(screen.getByTestId("workspace-target")).toBeInTheDocument();
  });

  it("renders example story cards fetched from the public endpoint", async () => {
    const { listExampleStoriesFromServer } = await import(
      "../../lib/story/api"
    );
    (
      listExampleStoriesFromServer as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([
      {
        id: "ex-1",
        title: "IMERG precipitation",
        chapters: [],
        is_example: true,
        published: true,
        dataset_id: null,
        dataset_ids: [],
        description: null,
      },
    ]);
    renderLanding();
    await waitFor(() => {
      expect(screen.getByText(/imerg precipitation/i)).toBeInTheDocument();
    });
  });

  it("renders the footer band with Contact and GitHub blocks", () => {
    renderLanding();
    expect(
      screen.getByText(/want to build this for real/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/all code on github/i)).toBeInTheDocument();
  });

  it("auto-redirects to a stored workspace when one exists in localStorage", () => {
    localStorage.setItem("myWorkspaceId", "stored123");
    renderLanding();
    const target = screen.getByTestId("workspace-target");
    expect(target).toHaveAttribute("data-workspace-id", "stored123");
  });

  it("does not auto-redirect when ?switch=1 is set, even if a workspace is stored", () => {
    localStorage.setItem("myWorkspaceId", "stored123");
    renderLanding("/?switch=1");
    expect(screen.queryByTestId("workspace-target")).toBeNull();
  });

  it("navigates to an existing workspace when the user submits an ID", () => {
    renderLanding();
    const input = screen.getByLabelText(/workspace ID/i);
    fireEvent.change(input, { target: { value: "abc12345" } });
    const goBtn = screen.getByRole("button", { name: /open|go|enter/i });
    fireEvent.click(goBtn);
    expect(screen.getByTestId("workspace-target")).toBeInTheDocument();
  });

  it("trims whitespace from the entered workspace ID", () => {
    renderLanding();
    const input = screen.getByLabelText(/workspace ID/i);
    fireEvent.change(input, { target: { value: "  abc12345  " } });
    const goBtn = screen.getByRole("button", { name: /open|go|enter/i });
    fireEvent.click(goBtn);
    expect(screen.getByTestId("workspace-target")).toHaveAttribute(
      "data-workspace-id",
      "abc12345"
    );
  });

  it("does not navigate when the entered workspace ID is empty", () => {
    renderLanding();
    const input = screen.getByLabelText(/workspace ID/i);
    fireEvent.change(input, { target: { value: "   " } });
    const goBtn = screen.getByRole("button", { name: /open|go|enter/i });
    fireEvent.click(goBtn);
    expect(screen.queryByTestId("workspace-target")).toBeNull();
  });
});
