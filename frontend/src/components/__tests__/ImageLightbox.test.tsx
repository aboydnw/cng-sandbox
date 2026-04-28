import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { ImageLightbox } from "../ImageLightbox";
import { system } from "../../theme";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("ImageLightbox", () => {
  it("clicking the X button calls onClose", () => {
    const onClose = vi.fn();
    renderWithChakra(
      <ImageLightbox src="/test.jpg" alt="test" onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pressing ESC calls onClose", () => {
    const onClose = vi.fn();
    renderWithChakra(
      <ImageLightbox src="/test.jpg" alt="test" onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop calls onClose, but clicking the image does not", () => {
    const onClose = vi.fn();
    renderWithChakra(
      <ImageLightbox src="/test.jpg" alt="test" onClose={onClose} />
    );

    const image = screen.getByAltText("test");
    fireEvent.click(image);
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = screen.getByTestId("image-lightbox-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
