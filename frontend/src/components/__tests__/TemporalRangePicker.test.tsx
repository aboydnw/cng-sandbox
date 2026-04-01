import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { TemporalRangePicker } from "../TemporalRangePicker";
import type { TimeDimInfo } from "../../types";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

const timeDim12: TimeDimInfo = {
  name: "time",
  size: 12,
  values: Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `2020-${m}-01T00:00:00Z`;
  }),
};

const timeDim100: TimeDimInfo = {
  name: "time",
  size: 100,
  values: Array.from({ length: 100 }, () => `2020-01-01T00:00:00Z`),
};

const timeDimNoValues: TimeDimInfo = {
  name: "dim0",
  size: 8,
  values: null,
};

describe("TemporalRangePicker", () => {
  it("shows All selected by default for small datasets", () => {
    const onConfirm = vi.fn();
    renderWithChakra(
      <TemporalRangePicker timeDim={timeDim12} onConfirm={onConfirm} />
    );
    expect(screen.getByText(/12 timesteps/)).toBeTruthy();
    expect(screen.getByText("Convert")).toBeTruthy();
  });

  it("calls onConfirm with full range when All is selected", () => {
    const onConfirm = vi.fn();
    renderWithChakra(
      <TemporalRangePicker timeDim={timeDim12} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByText("Convert"));
    expect(onConfirm).toHaveBeenCalledWith(0, 11);
  });

  it("disables All when timesteps exceed 50 and shows limit message", () => {
    const onConfirm = vi.fn();
    renderWithChakra(
      <TemporalRangePicker timeDim={timeDim100} onConfirm={onConfirm} />
    );
    expect(screen.getByText(/Maximum 50 timesteps/)).toBeTruthy();
  });

  it("handles null values gracefully", () => {
    const onConfirm = vi.fn();
    renderWithChakra(
      <TemporalRangePicker timeDim={timeDimNoValues} onConfirm={onConfirm} />
    );
    expect(screen.getByText(/8 timesteps/)).toBeTruthy();
  });
});
