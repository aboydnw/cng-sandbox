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

test("renders logo and title as static (non-linked) content", () => {
  renderWithProviders(<SharedHeader />);
  expect(screen.getByText(/cng sandbox/i)).toBeInTheDocument();
  expect(screen.getByAltText(/development seed/i)).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("does not render Make your own map CTA", () => {
  renderWithProviders(<SharedHeader />);
  expect(screen.queryByText(/make your own map/i)).not.toBeInTheDocument();
});

test("does not render Library link", () => {
  renderWithProviders(<SharedHeader />);
  expect(screen.queryByText("Library")).not.toBeInTheDocument();
});

test("does not render workspace badge", () => {
  renderWithProviders(<SharedHeader />);
  expect(screen.queryByText(/workspace/i)).not.toBeInTheDocument();
});
