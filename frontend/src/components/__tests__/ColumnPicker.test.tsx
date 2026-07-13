import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ColumnPicker } from "../ColumnPicker";
import type { ScannedColumn } from "../../types";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

const latlonColumns: ScannedColumn[] = [
  { name: "latitude", dtype: "float64", role: "lat" },
  { name: "longitude", dtype: "float64", role: "lon" },
  { name: "name", dtype: "object", role: null },
];

const wktColumns: ScannedColumn[] = [
  { name: "geometry", dtype: "object", role: "wkt" },
  { name: "label", dtype: "object", role: null },
];

describe("ColumnPicker", () => {
  it("pre-selects the guessed lat/lon columns", () => {
    renderWithChakra(
      <ColumnPicker columns={latlonColumns} onConfirm={vi.fn()} />
    );
    expect(
      (screen.getByLabelText("Latitude column") as HTMLSelectElement).value
    ).toBe("latitude");
    expect(
      (screen.getByLabelText("Longitude column") as HTMLSelectElement).value
    ).toBe("longitude");
  });

  it("emits a lat/lon mapping on confirm", () => {
    const onConfirm = vi.fn();
    renderWithChakra(
      <ColumnPicker columns={latlonColumns} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByText("Convert"));
    expect(onConfirm).toHaveBeenCalledWith({
      lat_column: "latitude",
      lon_column: "longitude",
      crs: "EPSG:4326",
    });
  });

  it("defaults to WKT mode and emits a wkt mapping when only WKT is guessed", () => {
    const onConfirm = vi.fn();
    renderWithChakra(
      <ColumnPicker columns={wktColumns} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByText("Convert"));
    expect(onConfirm).toHaveBeenCalledWith({
      wkt_column: "geometry",
      crs: "EPSG:4326",
    });
  });

  it("toggling to WKT swaps the controls", () => {
    renderWithChakra(
      <ColumnPicker columns={latlonColumns} onConfirm={vi.fn()} />
    );
    expect(screen.queryByLabelText("WKT column")).toBeNull();
    fireEvent.click(screen.getByText("WKT geometry"));
    expect(screen.getByLabelText("WKT column")).toBeTruthy();
    expect(screen.queryByLabelText("Latitude column")).toBeNull();
  });

  it("disables Convert until a valid mapping is chosen", () => {
    const onConfirm = vi.fn();
    const noGuess: ScannedColumn[] = [
      { name: "a", dtype: "float64", role: null },
      { name: "b", dtype: "float64", role: null },
    ];
    renderWithChakra(<ColumnPicker columns={noGuess} onConfirm={onConfirm} />);
    const convert = screen.getByText("Convert") as HTMLButtonElement;
    expect(convert).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Latitude column"), {
      target: { value: "a" },
    });
    fireEvent.change(screen.getByLabelText("Longitude column"), {
      target: { value: "b" },
    });
    expect(convert).not.toBeDisabled();
    fireEvent.click(convert);
    expect(onConfirm).toHaveBeenCalledWith({
      lat_column: "a",
      lon_column: "b",
      crs: "EPSG:4326",
    });
  });
});
