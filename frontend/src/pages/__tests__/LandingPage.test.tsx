import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, beforeEach } from "vitest";
import { system } from "../../theme";
import LandingPage from "../LandingPage";

function renderLanding() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/w/:workspaceId/*"
            element={<div data-testid="workspace-target" />}
          />
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
      screen.getByText(/cloud-native geospatial|upload.*GeoTIFF/i)
    ).toBeTruthy();
  });

  it("creates a new workspace when the primary CTA is clicked", () => {
    renderLanding();
    const cta = screen.getByRole("button", { name: /create.*workspace/i });
    fireEvent.click(cta);
    expect(screen.getByTestId("workspace-target")).toBeInTheDocument();
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
    expect(screen.getByTestId("workspace-target")).toBeInTheDocument();
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
