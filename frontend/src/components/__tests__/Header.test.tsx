import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "../Header";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace"]}>
        <WorkspaceProvider>
          {ui}
        </WorkspaceProvider>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("Header", () => {
  it("does not render a Discover nav link", () => {
    renderWithProviders(<Header />);
    expect(screen.queryByRole("link", { name: /discover/i })).not.toBeInTheDocument();
  });

  it("renders Library and About nav links", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("link", { name: /library/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
  });
});
