import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SharedHeader } from "../SharedHeader";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ChakraProvider>
  );
}

test("renders logo linking to homepage", () => {
  renderWithProviders(<SharedHeader />);
  const link = screen.getByRole("link", { name: /cng sandbox/i });
  expect(link).toHaveAttribute("href", "/");
});

test("renders Make your own map CTA linking to homepage", () => {
  renderWithProviders(<SharedHeader />);
  const cta = screen.getByRole("link", { name: /make your own map/i });
  expect(cta).toHaveAttribute("href", "/");
});

test("does not render Library link", () => {
  renderWithProviders(<SharedHeader />);
  expect(screen.queryByText("Library")).not.toBeInTheDocument();
});

test("does not render workspace badge", () => {
  renderWithProviders(<SharedHeader />);
  expect(screen.queryByText(/workspace/i)).not.toBeInTheDocument();
});
