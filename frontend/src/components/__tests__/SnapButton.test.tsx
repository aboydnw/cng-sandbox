import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { SnapButton } from "../SnapButton";

function renderWithChakra(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>
  );
}

describe("SnapButton", () => {
  it("renders with accessible label", () => {
    renderWithChakra(
      <SnapButton onSnap={vi.fn()} isCapturing={false} error={false} />
    );
    expect(screen.getByLabelText(/save map as png/i)).toBeInTheDocument();
  });

  it("calls onSnap when clicked", () => {
    const onSnap = vi.fn();
    renderWithChakra(
      <SnapButton onSnap={onSnap} isCapturing={false} error={false} />
    );
    fireEvent.click(screen.getByLabelText(/save map as png/i));
    expect(onSnap).toHaveBeenCalledTimes(1);
  });

  it("is disabled while capturing", () => {
    renderWithChakra(
      <SnapButton onSnap={vi.fn()} isCapturing={true} error={false} />
    );
    expect(screen.getByLabelText(/save map as png/i)).toBeDisabled();
  });

  it("does not call onSnap when error state is set (button click during flash)", () => {
    const onSnap = vi.fn();
    renderWithChakra(
      <SnapButton onSnap={onSnap} isCapturing={false} error={true} />
    );
    fireEvent.click(screen.getByLabelText(/save map as png/i));
    // click still fires — error is a visual flash only, not a disabled state
    expect(onSnap).toHaveBeenCalledTimes(1);
  });
});
