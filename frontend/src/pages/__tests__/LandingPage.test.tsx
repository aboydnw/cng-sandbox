import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, beforeEach } from "vitest";
import { system } from "../../theme";
import LandingPage from "../LandingPage";

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
  });

  it("renders the project title and description", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /CNG Sandbox/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/interactive maps and stories|source\.coop/i)
    ).toBeTruthy();
  });

  it("creates a new workspace when the primary CTA is clicked", () => {
    renderLanding();
    const cta = screen.getByRole("button", { name: /start building/i });
    fireEvent.click(cta);
    expect(screen.getByTestId("workspace-target")).toBeInTheDocument();
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
    expect(
      screen.getByRole("heading", { name: /CNG Sandbox/ })
    ).toBeInTheDocument();
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

  it("links to the About page", () => {
    renderLanding();
    const link = screen.getByRole("link", { name: /learn more/i });
    expect(link.getAttribute("href")).toBe("/about");
  });
});
