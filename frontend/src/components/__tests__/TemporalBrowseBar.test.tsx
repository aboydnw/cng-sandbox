import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { TemporalBrowseBar } from "../TemporalBrowseBar";
import type { Timestep } from "../../types";

const TIMESTEPS: Timestep[] = [
  { datetime: "2024-01-15T00:00:00Z", index: 0 },
  { datetime: "2024-02-15T00:00:00Z", index: 1 },
  { datetime: "2024-03-15T00:00:00Z", index: 2 },
];

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("TemporalBrowseBar", () => {
  it("renders the current date and animate button", () => {
    renderWithChakra(
      <TemporalBrowseBar
        timesteps={TIMESTEPS}
        activeIndex={0}
        onIndexChange={vi.fn()}
        onEnterAnimateMode={vi.fn()}
      />
    );
    expect(screen.getByText("Jan 2024")).toBeTruthy();
    expect(screen.getByLabelText(/animate/i)).toBeTruthy();
  });

  it("calls onEnterAnimateMode when play is clicked", () => {
    const onEnterAnimateMode = vi.fn();
    renderWithChakra(
      <TemporalBrowseBar
        timesteps={TIMESTEPS}
        activeIndex={0}
        onIndexChange={vi.fn()}
        onEnterAnimateMode={onEnterAnimateMode}
      />
    );
    fireEvent.click(screen.getByLabelText(/animate/i));
    expect(onEnterAnimateMode).toHaveBeenCalled();
  });
});
