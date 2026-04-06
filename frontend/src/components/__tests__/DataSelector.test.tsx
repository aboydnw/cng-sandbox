import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "../../theme";
import { DataSelector } from "../DataSelector";
import type { DataSelectorItem } from "../DataSelector";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

const DATASETS: DataSelectorItem[] = [
  { id: "d1", name: "temperature.tif", source: "dataset", dataType: "raster" },
  { id: "d2", name: "boundaries.json", source: "dataset", dataType: "vector" },
];

const CONNECTIONS: DataSelectorItem[] = [
  { id: "c1", name: "MODIS XYZ", source: "connection", dataType: "raster" },
];

describe("DataSelector", () => {
  it("shows the active item name in the trigger", () => {
    renderWithChakra(
      <DataSelector
        items={[...DATASETS, ...CONNECTIONS]}
        activeId="d1"
        activeSource="dataset"
        onSelect={vi.fn()}
        onUploadClick={vi.fn()}
        onAddConnectionClick={vi.fn()}
      />
    );
    expect(screen.getByText("temperature.tif")).toBeTruthy();
  });

  it("opens dropdown and shows sections", () => {
    renderWithChakra(
      <DataSelector
        items={[...DATASETS, ...CONNECTIONS]}
        activeId="d1"
        activeSource="dataset"
        onSelect={vi.fn()}
        onUploadClick={vi.fn()}
        onAddConnectionClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Datasets")).toBeTruthy();
    expect(screen.getByText("Connections")).toBeTruthy();
    expect(screen.getByText("boundaries.json")).toBeTruthy();
    expect(screen.getByText("MODIS XYZ")).toBeTruthy();
  });

  it("calls onSelect with id and source", () => {
    const onSelect = vi.fn();
    renderWithChakra(
      <DataSelector
        items={[...DATASETS, ...CONNECTIONS]}
        activeId="d1"
        activeSource="dataset"
        onSelect={onSelect}
        onUploadClick={vi.fn()}
        onAddConnectionClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("MODIS XYZ"));
    expect(onSelect).toHaveBeenCalledWith("c1", "connection");
  });

  it("calls onUploadClick from dropdown", () => {
    const onUpload = vi.fn();
    renderWithChakra(
      <DataSelector
        items={DATASETS}
        activeId="d1"
        activeSource="dataset"
        onSelect={vi.fn()}
        onUploadClick={onUpload}
        onAddConnectionClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Upload new file"));
    expect(onUpload).toHaveBeenCalled();
  });

  it("shows Loading... when activeId is not in items", () => {
    renderWithChakra(
      <DataSelector
        items={DATASETS}
        activeId="nonexistent"
        activeSource="dataset"
        onSelect={vi.fn()}
        onUploadClick={vi.fn()}
        onAddConnectionClick={vi.fn()}
      />
    );
    expect(screen.getByText("Loading...")).toBeTruthy();
  });
});
