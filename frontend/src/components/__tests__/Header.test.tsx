import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
