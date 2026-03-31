import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
      {
        name: "Converting",
        status: "error" as const,
        detail: "Unsupported CRS",
      },
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
    renderWithChakra(
      <ProgressTracker {...baseProps} onRetry={() => {}} onReport={onReport} />
    );
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
      <ProgressTracker
        stages={stages}
        filename="test.tif"
        fileSize="10 MB"
        onRetry={() => {}}
      />
    );
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("does not render action buttons when onRetry is not provided", () => {
    renderWithChakra(<ProgressTracker {...baseProps} />);
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("renders percent progress detail for active stage", () => {
    const stages: StageInfo[] = [
      { name: "Uploading", status: "done" },
      {
        name: "Converting",
        status: "active",
        progress: { percent: 67, current: null, total: null, detail: null },
      },
      { name: "Validating", status: "pending" },
    ];
    renderWithChakra(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="10 MB" />
    );
    expect(screen.getByText(/67%/)).toBeTruthy();
  });

  it("renders current/total progress detail for active stage", () => {
    const stages: StageInfo[] = [
      { name: "Uploading", status: "done" },
      { name: "Scanning", status: "done" },
      {
        name: "Validating",
        status: "active",
        progress: { percent: null, current: 3, total: 7, detail: null },
      },
    ];
    renderWithChakra(
      <ProgressTracker stages={stages} filename="test.geojson" fileSize="5 MB" />
    );
    expect(screen.getByText(/3 of 7/)).toBeTruthy();
  });

  it("renders sub-phase detail for active stage", () => {
    const stages: StageInfo[] = [
      { name: "Uploading", status: "done" },
      {
        name: "Ingesting",
        status: "active",
        progress: { percent: null, current: null, total: null, detail: "uploading" },
      },
    ];
    renderWithChakra(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="10 MB" />
    );
    expect(screen.getAllByText(/uploading/i).length).toBeGreaterThan(0);
  });

  it("displays elapsed time for active stage", () => {
    vi.useFakeTimers();

    const stages: StageInfo[] = [
      { name: "Uploading", status: "done" },
      { name: "Scanning", status: "active" },
    ];
    renderWithChakra(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="10 MB" />
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText(/3s/)).toBeTruthy();

    vi.useRealTimers();
  });

  it("shows elapsed time combined with progress detail", () => {
    vi.useFakeTimers();

    const stages: StageInfo[] = [
      { name: "Uploading", status: "done" },
      {
        name: "Converting",
        status: "active",
        progress: { percent: 42, current: null, total: null, detail: null },
      },
    ];
    renderWithChakra(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="10 MB" />
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/42%/)).toBeTruthy();
    expect(screen.getByText(/5s/)).toBeTruthy();

    vi.useRealTimers();
  });

  it("renders upload bytes progress for Uploading stage", () => {
    const stages: StageInfo[] = [
      {
        name: "Uploading",
        status: "active",
        progress: { percent: 50, current: 2200000, total: 4400000, detail: null },
      },
      { name: "Scanning", status: "pending" },
    ];
    renderWithChakra(
      <ProgressTracker stages={stages} filename="test.tif" fileSize="4.2 MB" />
    );
    expect(screen.getByText(/2\.1 MB/)).toBeTruthy();
    expect(screen.getAllByText(/4\.2 MB/).length).toBeGreaterThan(0);
  });
});
