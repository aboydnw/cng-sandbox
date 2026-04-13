import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";
import AboutPage from "../AboutPage";

function renderAbout() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace/about"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={
              <WorkspaceProvider>
                <AboutPage />
              </WorkspaceProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("AboutPage", () => {
  it("renders the mission section", () => {
    renderAbout();
    expect(screen.getByText("About CNG Sandbox")).toBeTruthy();
    expect(
      screen.getByText(/hands-on demonstration of the cloud-native/)
    ).toBeTruthy();
  });

  it("renders all pipeline steps", () => {
    renderAbout();
    expect(screen.getByText("Upload")).toBeTruthy();
    expect(screen.getByText("Convert")).toBeTruthy();
    expect(screen.getByText("Tile")).toBeTruthy();
    expect(screen.getByText("View")).toBeTruthy();
  });

  it("renders the open source credits table", () => {
    renderAbout();
    expect(screen.getByText("pgSTAC")).toBeTruthy();
    expect(screen.getByText("titiler")).toBeTruthy();
    expect(screen.getByText("MapLibre GL JS")).toBeTruthy();
    expect(screen.getByText("deck.gl")).toBeTruthy();
    expect(screen.getByText("PostGIS")).toBeTruthy();
  });

  it("links to cloudnativegeo.org", () => {
    renderAbout();
    const link = screen.getByText("cloudnativegeo.org");
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "https://cloudnativegeo.org/"
    );
  });

  it("links to Development Seed", () => {
    renderAbout();
    const links = screen.getAllByText("Development Seed");
    const footerLink = links.find(
      (el) =>
        el.closest("a")?.getAttribute("href") === "https://developmentseed.org/"
    );
    expect(footerLink).toBeTruthy();
  });
});
