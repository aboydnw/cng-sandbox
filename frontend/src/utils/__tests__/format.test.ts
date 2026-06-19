import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { daysUntilExpiry, expiryLabel, timeAgo } from "../format";

afterEach(() => {
  vi.useRealTimers();
});

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));
  });

  it("returns 'just now' for timestamps under a minute old", () => {
    expect(timeAgo("2026-06-09T11:59:30Z")).toBe("just now");
  });

  it("returns minutes for timestamps under an hour old", () => {
    expect(timeAgo("2026-06-09T11:15:00Z")).toBe("45m ago");
  });

  it("returns hours for timestamps under a day old", () => {
    expect(timeAgo("2026-06-09T09:00:00Z")).toBe("3h ago");
  });

  it("returns days for older timestamps", () => {
    expect(timeAgo("2026-06-02T12:00:00Z")).toBe("7d ago");
  });
});

describe("daysUntilExpiry", () => {
  it("counts whole days remaining, rounding up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    expect(daysUntilExpiry("2026-06-13T12:00:00Z")).toBe(13);
  });

  it("returns 0 for past dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    expect(daysUntilExpiry("2026-05-20T00:00:00Z")).toBe(0);
  });
});

describe("expiryLabel", () => {
  it("formats plural days", () => {
    expect(expiryLabel(12)).toBe("Expires in 12 days");
  });

  it("formats a single day", () => {
    expect(expiryLabel(1)).toBe("Expires in 1 day");
  });

  it("formats today", () => {
    expect(expiryLabel(0)).toBe("Expires today");
  });
});
