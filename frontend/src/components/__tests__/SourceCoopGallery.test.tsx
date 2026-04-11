import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { SourceCoopGallery } from "../SourceCoopGallery";
import { system } from "../../theme";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("SourceCoopGallery", () => {
  it("renders a card for every product in the catalog", () => {
    renderWithChakra(<SourceCoopGallery onSelect={vi.fn()} />);

    expect(screen.getByText(/GHRSST/i)).toBeTruthy();
    expect(screen.getByText(/GEBCO/i)).toBeTruthy();
    expect(screen.getByText("Land & Carbon Lab Carbon Data")).toBeTruthy();
  });

  it("calls onSelect with the slug when a card is clicked", () => {
    const onSelect = vi.fn();
    renderWithChakra(<SourceCoopGallery onSelect={onSelect} />);

    fireEvent.click(screen.getByText(/GEBCO/i));

    expect(onSelect).toHaveBeenCalledWith("alexgleith/gebco-2024");
  });

  it("renders a section heading", () => {
    renderWithChakra(<SourceCoopGallery onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /source\.coop/i })).toBeTruthy();
  });

  it("falls back when a thumbnail fails to load", () => {
    renderWithChakra(<SourceCoopGallery onSelect={vi.fn()} />);
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
    fireEvent.error(images[0]);
  });
});
