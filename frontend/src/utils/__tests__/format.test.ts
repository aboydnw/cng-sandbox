import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { timeAgo } from "../format";

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
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
