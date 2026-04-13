import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { RasterSidebarControls } from "../RasterSidebarControls";

function renderCtrl(props: Partial<React.ComponentProps<typeof RasterSidebarControls>> = {}) {
  const defaultProps: React.ComponentProps<typeof RasterSidebarControls> = {
    opacity: 0.8,
    onOpacityChange: () => {},
    colormapName: "viridis",
    onColormapChange: () => {},
    showColormap: true,
    selectedBand: "rgb",
    onBandChange: () => {},
    showBands: false,
    rescaleMin: null,
    rescaleMax: null,
    datasetMin: 0,
    datasetMax: 100,
    onRescaleChange: () => {},
    colormapReversed: false,
    onColormapReversedChange: () => {},
  };
  return render(
    <ChakraProvider value={system}>
      <RasterSidebarControls {...defaultProps} {...props} />
    </ChakraProvider>
  );
}

describe("RasterSidebarControls rescale + flip", () => {
  it("shows dataset defaults as placeholders when overrides are null", () => {
    renderCtrl();
    const min = screen.getByLabelText(/rescale min/i) as HTMLInputElement;
    const max = screen.getByLabelText(/rescale max/i) as HTMLInputElement;
    expect(min.placeholder).toBe("0");
    expect(max.placeholder).toBe("100");
    expect(min.value).toBe("");
    expect(max.value).toBe("");
  });

  it("shows override values when set", () => {
    renderCtrl({ rescaleMin: 10, rescaleMax: 50 });
    expect((screen.getByLabelText(/rescale min/i) as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText(/rescale max/i) as HTMLInputElement).value).toBe("50");
  });

  it("calls onRescaleChange when a field is blurred with a new number", () => {
    const onRescaleChange = vi.fn();
    renderCtrl({ onRescaleChange });
    const min = screen.getByLabelText(/rescale min/i);
    fireEvent.change(min, { target: { value: "5" } });
    fireEvent.blur(min);
    expect(onRescaleChange).toHaveBeenCalledWith(5, null);
  });

  it("commits on Enter key", () => {
    const onRescaleChange = vi.fn();
    renderCtrl({ rescaleMin: 1, onRescaleChange });
    const max = screen.getByLabelText(/rescale max/i);
    fireEvent.change(max, { target: { value: "99" } });
    fireEvent.keyDown(max, { key: "Enter" });
    expect(onRescaleChange).toHaveBeenCalledWith(1, 99);
  });

  it("reset button clears both values to null", () => {
    const onRescaleChange = vi.fn();
    renderCtrl({ rescaleMin: 10, rescaleMax: 50, onRescaleChange });
    fireEvent.click(screen.getByRole("button", { name: /reset rescale/i }));
    expect(onRescaleChange).toHaveBeenCalledWith(null, null);
  });

  it("flip toggle calls onColormapReversedChange", () => {
    const onColormapReversedChange = vi.fn();
    renderCtrl({ onColormapReversedChange });
    fireEvent.click(screen.getByRole("button", { name: /flip colormap/i }));
    expect(onColormapReversedChange).toHaveBeenCalledWith(true);
  });

  it("hides rescale and flip when isCategorical", () => {
    renderCtrl({
      isCategorical: true,
      categories: [{ value: 1, color: "#ff0000", label: "a" }],
      datasetId: "d1",
      showColormap: false,
    });
    expect(screen.queryByLabelText(/rescale min/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /flip colormap/i })).toBeNull();
  });

  it("empty string commits null (back to auto)", () => {
    const onRescaleChange = vi.fn();
    renderCtrl({ rescaleMin: 10, rescaleMax: 50, onRescaleChange });
    const min = screen.getByLabelText(/rescale min/i);
    fireEvent.change(min, { target: { value: "" } });
    fireEvent.blur(min);
    expect(onRescaleChange).toHaveBeenCalledWith(null, 50);
  });
});
