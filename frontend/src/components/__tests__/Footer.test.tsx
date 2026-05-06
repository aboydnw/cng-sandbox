import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect } from "vitest";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";
import { Footer } from "../Footer";

function renderFooter() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={
              <WorkspaceProvider>
                <Footer />
              </WorkspaceProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("Footer", () => {
  it("links to the GitHub repo", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /github/i });
    expect(link.getAttribute("href")).toBe(
      "https://github.com/aboydnw/cng-sandbox"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("links to the workspace-scoped About page", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /about/i });
    expect(link.getAttribute("href")).toBe("/w/test-workspace/about");
  });

  it("links to the security mailto", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /security/i });
    expect(link.getAttribute("href")).toBe(
      "mailto:security@developmentseed.org"
    );
  });

  it("credits Development Seed", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /development seed/i });
    expect(link.getAttribute("href")).toBe("https://developmentseed.org/");
  });
});
