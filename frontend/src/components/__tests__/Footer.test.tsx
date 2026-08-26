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
  it("links to Earth Stories and CNG Sandbox as distinct repositories", () => {
    renderFooter();
    const earthStories = screen.getByRole("link", {
      name: /earth stories on github/i,
    });
    const cngSandbox = screen.getByRole("link", {
      name: /cng sandbox on github/i,
    });
    expect(earthStories).toHaveAttribute(
      "href",
      "https://github.com/aboydnw/earth-stories"
    );
    expect(cngSandbox).toHaveAttribute(
      "href",
      "https://github.com/aboydnw/cng-sandbox"
    );
    for (const link of [earthStories, cngSandbox]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });

  it("links to the workspace-scoped About page", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /about/i });
    expect(link.getAttribute("href")).toBe("/w/test-workspace/about");
  });

  it("links to the Development Seed contact page", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /contact us/i });
    expect(link.getAttribute("href")).toBe(
      "https://developmentseed.org/contact/"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("credits Development Seed", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /development seed/i });
    expect(link.getAttribute("href")).toBe("https://developmentseed.org/");
  });
});
