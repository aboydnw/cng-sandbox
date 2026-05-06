import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
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

describe("Header workspace menu", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens a menu with copy / make-primary / change items when not yet primary", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Header />);
    await user.click(screen.getByLabelText(/workspace menu/i));
    expect(
      await screen.findByRole("menuitem", { name: /copy workspace link/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", {
        name: /make this my primary workspace/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /change workspaces/i })
    ).toBeInTheDocument();
  });

  it("hides 'make primary' when this workspace is already the primary", async () => {
    const user = userEvent.setup();
    localStorage.setItem("myWorkspaceId", "test-workspace");
    renderWithProviders(<Header />);
    await user.click(screen.getByLabelText(/workspace menu/i));
    await screen.findByRole("menuitem", { name: /copy workspace link/i });
    expect(
      screen.queryByRole("menuitem", {
        name: /make this my primary workspace/i,
      })
    ).toBeNull();
    expect(screen.getByText(/^primary workspace$/i)).toBeInTheDocument();
  });

  it("writes the workspace id to localStorage when 'make primary' is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Header />);
    await user.click(screen.getByLabelText(/workspace menu/i));
    const item = await screen.findByRole("menuitem", {
      name: /make this my primary workspace/i,
    });
    await user.click(item);
    expect(localStorage.getItem("myWorkspaceId")).toBe("test-workspace");
  });
});
