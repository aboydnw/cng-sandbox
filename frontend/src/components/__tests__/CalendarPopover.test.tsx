import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "../../theme";
import { CalendarPopover } from "../CalendarPopover";
import type { Timestep } from "../../types";

const TIMESTEPS: Timestep[] = [
  { datetime: "2024-01-15T00:00:00Z", index: 0 },
  { datetime: "2024-03-15T00:00:00Z", index: 1 },
  { datetime: "2024-06-15T00:00:00Z", index: 2 },
];

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("CalendarPopover", () => {
  it("renders the current date label", () => {
    renderWithChakra(
      <CalendarPopover
        timesteps={TIMESTEPS}
        activeIndex={0}
        onIndexChange={vi.fn()}
        cadence="monthly"
      />
    );
    expect(screen.getByText("Jan 2024")).toBeTruthy();
  });

  it("updates the label when activeIndex changes", () => {
    renderWithChakra(
      <CalendarPopover
        timesteps={TIMESTEPS}
        activeIndex={1}
        onIndexChange={vi.fn()}
        cadence="monthly"
      />
    );
    expect(screen.getByText("Mar 2024")).toBeTruthy();
  });

  it("calls onIndexChange when next button is clicked", () => {
    const onIndexChange = vi.fn();
    renderWithChakra(
      <CalendarPopover
        timesteps={TIMESTEPS}
        activeIndex={0}
        onIndexChange={onIndexChange}
        cadence="monthly"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /next timestep/i }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("opens the calendar popover when the calendar button is clicked", () => {
    renderWithChakra(
      <CalendarPopover
        timesteps={TIMESTEPS}
        activeIndex={0}
        onIndexChange={vi.fn()}
        cadence="monthly"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /open calendar/i }));
    expect(screen.getByText("January 2024")).toBeTruthy();
  });

  it("shows time picker for sub-daily data when a date has multiple times", () => {
    const subDailyTimesteps: Timestep[] = [
      { datetime: "2024-01-15T00:00:00Z", index: 0 },
      { datetime: "2024-01-15T06:00:00Z", index: 1 },
      { datetime: "2024-01-15T12:00:00Z", index: 2 },
      { datetime: "2024-01-16T00:00:00Z", index: 3 },
    ];
    renderWithChakra(
      <CalendarPopover
        timesteps={subDailyTimesteps}
        activeIndex={0}
        onIndexChange={vi.fn()}
        cadence="hourly"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /open calendar/i }));
    // Click the day button for Jan 15 (has multiple timesteps)
    const jan15btn = screen.getByRole("button", { name: /January 15/i });
    fireEvent.click(jan15btn);
    expect(screen.getByText("Select time")).toBeTruthy();
    expect(screen.getByText("00:00 UTC")).toBeTruthy();
    expect(screen.getByText("06:00 UTC")).toBeTruthy();
    expect(screen.getByText("12:00 UTC")).toBeTruthy();
  });

  it("calls onIndexChange when a time is selected from the time picker", () => {
    const onIndexChange = vi.fn();
    const subDailyTimesteps: Timestep[] = [
      { datetime: "2024-01-15T00:00:00Z", index: 0 },
      { datetime: "2024-01-15T06:00:00Z", index: 1 },
      { datetime: "2024-01-15T12:00:00Z", index: 2 },
      { datetime: "2024-01-16T00:00:00Z", index: 3 },
    ];
    renderWithChakra(
      <CalendarPopover
        timesteps={subDailyTimesteps}
        activeIndex={0}
        onIndexChange={onIndexChange}
        cadence="hourly"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /open calendar/i }));
    const jan15btn = screen.getByRole("button", { name: /January 15/i });
    fireEvent.click(jan15btn);
    fireEvent.click(screen.getByText("06:00 UTC"));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("does not show time picker for a date with only one timestep", () => {
    const subDailyTimesteps: Timestep[] = [
      { datetime: "2024-01-15T00:00:00Z", index: 0 },
      { datetime: "2024-01-15T06:00:00Z", index: 1 },
      { datetime: "2024-01-16T00:00:00Z", index: 2 },
    ];
    const onIndexChange = vi.fn();
    renderWithChakra(
      <CalendarPopover
        timesteps={subDailyTimesteps}
        activeIndex={0}
        onIndexChange={onIndexChange}
        cadence="hourly"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /open calendar/i }));
    const jan16btn = screen.getByRole("button", { name: /January 16/i });
    fireEvent.click(jan16btn);
    // Single timestep date should directly call onIndexChange without showing time picker
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(screen.queryByText("Select time")).toBeNull();
  });
});
