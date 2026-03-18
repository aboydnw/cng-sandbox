import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import { ProgressTracker } from "../src/components/ProgressTracker";
import type { StageInfo } from "../src/types";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("ProgressTracker", () => {
  it("renders all 5 stage names", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "active" },
      { name: "Converting", status: "pending" },
      { name: "Validating", status: "pending" },
      { name: "Ingesting", status: "pending" },
      { name: "Ready", status: "pending" },
    ];
    renderWithProviders(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="12 MB" />,
    );
    expect(screen.getByText("Scanning")).toBeTruthy();
    expect(screen.getByText("Converting")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("shows filename and size", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "done" },
      { name: "Converting", status: "active" },
      { name: "Validating", status: "pending" },
      { name: "Ingesting", status: "pending" },
      { name: "Ready", status: "pending" },
    ];
    renderWithProviders(
      <ProgressTracker stages={stages} filename="rainfall_2024.tif" fileSize="12.4 MB" />,
    );
    expect(screen.getByText(/rainfall_2024\.tif/)).toBeTruthy();
  });

  it("shows error detail on failed stage", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "done" },
      { name: "Converting", status: "error", detail: "Bad CRS" },
      { name: "Validating", status: "pending" },
      { name: "Ingesting", status: "pending" },
      { name: "Ready", status: "pending" },
    ];
    renderWithProviders(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="1 MB" />,
    );
    expect(screen.getByText("Bad CRS")).toBeTruthy();
  });
});
