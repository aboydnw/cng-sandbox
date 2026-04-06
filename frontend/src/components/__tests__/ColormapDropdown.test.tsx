import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "../../theme";
import { ColormapDropdown } from "../ColormapDropdown";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("ColormapDropdown", () => {
  it("shows the current colormap name in the trigger", () => {
    renderWithChakra(<ColormapDropdown value="viridis" onChange={vi.fn()} />);
    expect(screen.getByText("viridis")).toBeTruthy();
  });

  it("opens dropdown on click and shows all colormaps", () => {
    renderWithChakra(<ColormapDropdown value="viridis" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("magma")).toBeTruthy();
    expect(screen.getByText("plasma")).toBeTruthy();
    expect(screen.getByText("coolwarm")).toBeTruthy();
  });

  it("calls onChange when a colormap is selected", () => {
    const onChange = vi.fn();
    renderWithChakra(<ColormapDropdown value="viridis" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("magma"));
    expect(onChange).toHaveBeenCalledWith("magma");
  });

  it("closes dropdown after selection", () => {
    renderWithChakra(<ColormapDropdown value="viridis" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("magma"));
    expect(screen.queryByText("plasma")).toBeNull();
  });
});
