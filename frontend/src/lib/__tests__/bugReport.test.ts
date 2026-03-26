import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitBugReport } from "../bugReport";
import type { LogEntry } from "../consoleCapture";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("submitBugReport", () => {
  const basePayload = {
    description: "Map won't load",
    page_url: "/map/ds-123",
    dataset_id: "ds-123",
    console_logs: [] as LogEntry[],
  };

  it("posts to /api/bug-report and returns the issue URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ issue_url: "https://github.com/org/repo/issues/1" }),
    });

    const result = await submitBugReport(basePayload);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/bug-report",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(result.issue_url).toBe("https://github.com/org/repo/issues/1");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ detail: "GitHub API error" }),
    });

    await expect(submitBugReport(basePayload)).rejects.toThrow();
  });
});
