import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { ProgressTracker } from "../ProgressTracker";
import { system } from "../../theme";
import type { StageInfo } from "../../types";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("ProgressTracker", () => {
  const baseProps = {
    stages: [
      { name: "Scanning", status: "done" as const },
      { name: "Converting", status: "error" as const, detail: "Unsupported CRS" },
      { name: "Validating", status: "pending" as const },
    ],
    filename: "test.tif",
    fileSize: "24.5 MB",
  };

  it("renders retry button when a stage has error status and onRetry is provided", () => {
    const onRetry = vi.fn();
    renderWithChakra(<ProgressTracker {...baseProps} onRetry={onRetry} />);
    const btn = screen.getByText("Try again");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders report button when onReport is provided", () => {
    const onReport = vi.fn();
    renderWithChakra(<ProgressTracker {...baseProps} onRetry={() => {}} onReport={onReport} />);
    const btn = screen.getByText("Report this issue");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onReport).toHaveBeenCalledOnce();
  });

  it("does not render action buttons when no stage has error", () => {
    const stages: StageInfo[] = [
      { name: "Scanning", status: "done" },
      { name: "Converting", status: "active" },
    ];
    renderWithChakra(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="10 MB" onRetry={() => {}} />,
    );
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("does not render action buttons when onRetry is not provided", () => {
    renderWithChakra(<ProgressTracker {...baseProps} />);
    expect(screen.queryByText("Try again")).toBeNull();
  });
});
