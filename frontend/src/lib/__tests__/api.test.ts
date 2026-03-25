import { describe, it, expect, vi, beforeEach } from "vitest";
import { workspaceFetch, setWorkspaceId } from "../api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true });
  setWorkspaceId("test1234");
});

describe("workspaceFetch", () => {
  it("adds X-Workspace-Id header to requests", async () => {
    await workspaceFetch("/api/datasets");
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.get("X-Workspace-Id")).toBe("test1234");
  });

  it("preserves existing headers", async () => {
    await workspaceFetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.headers.get("X-Workspace-Id")).toBe("test1234");
  });

  it("works with FormData (no Content-Type override)", async () => {
    const body = new FormData();
    await workspaceFetch("/api/upload", { method: "POST", body });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.get("X-Workspace-Id")).toBe("test1234");
  });
});
