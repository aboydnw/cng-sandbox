import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "../../theme";
import { seedExampleData } from "../../lib/examples/api";
import LandingPage from "../LandingPage";

vi.mock("../../hooks/useWorkspace", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../hooks/useWorkspace")
  >();
  return {
    ...actual,
    generateWorkspaceId: vi.fn(() => "generated123"),
  };
});

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return { ...actual, setWorkspaceId: vi.fn() };
});

vi.mock("../../lib/examples/api", () => ({
  seedExampleData: vi
    .fn()
    .mockResolvedValue({ state: "seeded", story_id_map: {} }),
}));

vi.mock("../../lib/story/api", () => ({
  listExampleStoriesFromServer: vi.fn().mockResolvedValue([]),
}));

function WorkspaceTarget() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const rest = location.pathname.replace(`/w/${workspaceId}`, "");
  return (
    <div
      data-testid="workspace-target"
      data-workspace-id={workspaceId}
      data-rest={rest}
    />
  );
}

function renderLanding(initialEntry = "/") {
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
    vi.mocked(seedExampleData).mockResolvedValue({
      state: "seeded",
      story_id_map: {},
    });
  });

  it("presents Earth Stories and the two product paths", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /earth stories/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /explore earth stories/i })
    ).toHaveAttribute("href", "https://github.com/aboydnw/earth-stories");
    expect(
      screen.getByRole("button", { name: /open the data sandbox/i })
    ).toBeInTheDocument();
  });

  it("opens Earth Stories safely in a new tab", () => {
    renderLanding();
    const link = screen.getByRole("link", { name: /explore earth stories/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("always shows the homepage when a workspace is stored", () => {
    localStorage.setItem("myWorkspaceId", "stored123");
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /earth stories/i })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-target")).not.toBeInTheDocument();
  });

  it("opens the stored workspace only after the sandbox CTA is selected", async () => {
    localStorage.setItem("myWorkspaceId", "stored123");
    renderLanding();
    fireEvent.click(
      screen.getByRole("button", { name: /open the data sandbox/i })
    );
    expect(await screen.findByTestId("workspace-target")).toHaveAttribute(
      "data-workspace-id",
      "stored123"
    );
    expect(screen.getByTestId("workspace-target")).toHaveAttribute(
      "data-rest",
      "/"
    );
  });

  it("creates and seeds a workspace before opening the sandbox root", async () => {
    renderLanding();
    fireEvent.click(
      screen.getByRole("button", { name: /open the data sandbox/i })
    );
    await waitFor(() => {
      expect(seedExampleData).toHaveBeenCalledWith("generated123");
    });
    expect(await screen.findByTestId("workspace-target")).toHaveAttribute(
      "data-workspace-id",
      "generated123"
    );
    expect(screen.getByTestId("workspace-target")).toHaveAttribute(
      "data-rest",
      "/"
    );
  });

  it("opens the sandbox root when example seeding fails", async () => {
    vi.mocked(seedExampleData).mockRejectedValueOnce(new Error("HTTP 500"));
    renderLanding();
    fireEvent.click(
      screen.getByRole("button", { name: /open the data sandbox/i })
    );
    expect(await screen.findByTestId("workspace-target")).toHaveAttribute(
      "data-rest",
      "/"
    );
  });

  it("navigates to a known workspace when the user submits an ID", () => {
    renderLanding();
    fireEvent.change(screen.getByLabelText(/workspace ID/i), {
      target: { value: "abc12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^open$/i }));
    expect(screen.getByTestId("workspace-target")).toHaveAttribute(
      "data-workspace-id",
      "abc12345"
    );
  });

  it("trims whitespace from a submitted workspace ID", () => {
    renderLanding();
    fireEvent.change(screen.getByLabelText(/workspace ID/i), {
      target: { value: "  abc12345  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^open$/i }));
    expect(screen.getByTestId("workspace-target")).toHaveAttribute(
      "data-workspace-id",
      "abc12345"
    );
  });

  it("does not navigate when the workspace ID is empty", () => {
    renderLanding();
    const button = screen.getByRole("button", { name: /^open$/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByTestId("workspace-target")).not.toBeInTheDocument();
  });
});
