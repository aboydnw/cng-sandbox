import { describe, it, expect, vi, afterEach } from "vitest";
import { daysUntilExpiry, expiryLabel } from "../format";

describe("daysUntilExpiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
