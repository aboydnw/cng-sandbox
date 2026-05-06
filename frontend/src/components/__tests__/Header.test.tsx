import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { Header } from "../Header";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={<WorkspaceProvider>{ui}</WorkspaceProvider>}
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("Header", () => {
  it("does not render a Discover nav link", () => {
    renderWithProviders(<Header />);
    expect(
      screen.queryByRole("link", { name: /discover/i })
    ).not.toBeInTheDocument();
  });

  it("renders Data, Stories, and About nav links", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("link", { name: /^data$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^stories$/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
  });
});

describe("Header (public, no workspace)", () => {
  function renderPublic() {
    return render(
      <ChakraProvider value={system}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<Header />} />
          </Routes>
        </MemoryRouter>
      </ChakraProvider>
    );
  }

  it("does not render the workspace ID badge", () => {
    renderPublic();
    expect(screen.queryByText(/Workspace /)).toBeNull();
  });

  it("does not render workspace-scoped Data and Stories links", () => {
    renderPublic();
    expect(screen.queryByRole("link", { name: "Data" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Stories" })).toBeNull();
  });

  it("renders an About link pointing at /about", () => {
    renderPublic();
    const link = screen.getByRole("link", { name: "About" });
    expect(link.getAttribute("href")).toBe("/about");
  });

  it("renders the home logo link pointing at /", () => {
    renderPublic();
    const links = screen.getAllByRole("link");
    const home = links.find((el) => el.getAttribute("href") === "/");
    expect(home).toBeTruthy();
  });
});
