import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { CopcControls } from "../CopcControls";

function renderCtrl(
  props: Partial<React.ComponentProps<typeof CopcControls>> = {}
) {
  const defaultProps: React.ComponentProps<typeof CopcControls> = {
    colorMode: "elevation",
    onColorModeChange: () => {},
    pointSize: 2,
    onPointSizeChange: () => {},
    pointCount: 400,
  };
  return render(
    <ChakraProvider value={system}>
      <CopcControls {...defaultProps} {...props} />
    </ChakraProvider>
  );
}

describe("CopcControls", () => {
  it("changing the color mode calls onColorModeChange", () => {
    const onColorModeChange = vi.fn();
    renderCtrl({ onColorModeChange });
    fireEvent.change(screen.getByDisplayValue("Elevation"), {
      target: { value: "intensity" },
    });
    expect(onColorModeChange).toHaveBeenCalledWith("intensity");
  });

  it("dragging the point size calls onPointSizeChange", () => {
    const onPointSizeChange = vi.fn();
    renderCtrl({ onPointSizeChange });
    fireEvent.change(screen.getByLabelText("Point size"), {
      target: { value: "4" },
    });
    expect(onPointSizeChange).toHaveBeenCalledWith(4);
  });

  it("shows the point count", () => {
    renderCtrl({ pointCount: 12345 });
    expect(screen.getByText(/12,345 pts/)).toBeInTheDocument();
  });
});
