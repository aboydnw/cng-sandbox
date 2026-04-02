import { describe, it, expect } from "vitest";
import { formatDateRangeBadge, groupTimestepsByDate } from "../temporal";
import type { Timestep } from "../../types";

describe("formatDateRangeBadge", () => {
  it("formats annual range", () => {
    const result = formatDateRangeBadge(
      "2020-01-01T00:00:00Z",
      "2023-01-01T00:00:00Z",
      12,
      "annual"
    );
    expect(result).toBe("2020 — 2023 · 12 timesteps");
  });

  it("formats monthly range", () => {
    const result = formatDateRangeBadge(
      "2024-01-15T00:00:00Z",
      "2024-06-15T00:00:00Z",
      6,
      "monthly"
    );
    expect(result).toBe("Jan 2024 — Jun 2024 · 6 timesteps");
  });

  it("formats daily range", () => {
    const result = formatDateRangeBadge(
      "2024-01-01T00:00:00Z",
      "2024-01-31T00:00:00Z",
      31,
      "daily"
    );
    expect(result).toBe("Jan 1, 2024 — Jan 31, 2024 · 31 timesteps");
  });

  it("uses singular for 1 timestep", () => {
    const result = formatDateRangeBadge(
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      1,
      "daily"
    );
    expect(result).toContain("1 timestep");
  });
});

describe("groupTimestepsByDate", () => {
  it("groups sub-daily timesteps by date", () => {
    const timesteps: Timestep[] = [
      { datetime: "2024-01-15T00:00:00Z", index: 0 },
      { datetime: "2024-01-15T06:00:00Z", index: 1 },
      { datetime: "2024-01-15T12:00:00Z", index: 2 },
      { datetime: "2024-01-16T00:00:00Z", index: 3 },
    ];
    const groups = groupTimestepsByDate(timesteps);
    expect(groups.size).toBe(2);
    expect(groups.get("2024-01-15")!.length).toBe(3);
    expect(groups.get("2024-01-16")!.length).toBe(1);
  });
});
