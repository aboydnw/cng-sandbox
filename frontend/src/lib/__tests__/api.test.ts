import { describe, it, expect, vi, beforeEach } from "vitest";
import { workspaceFetch, setWorkspaceId, datasetsApi, connectionsApi } from "../api";

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

describe("datasetsApi.setPreferredColormap", () => {
  it("PATCHes /api/datasets/{id}/colormap with the payload", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        preferred_colormap: "terrain",
        preferred_colormap_reversed: false,
      }),
    });
    const result = await datasetsApi.setPreferredColormap("abc", {
      preferredColormap: "terrain",
      preferredColormapReversed: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/datasets/abc/colormap");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      preferred_colormap: "terrain",
      preferred_colormap_reversed: false,
    });
    expect((result as Record<string, unknown>).preferred_colormap).toBe(
      "terrain"
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
      json: async () => ({ detail: "Forbidden" }),
    });
    await expect(
      datasetsApi.setPreferredColormap("abc", {
        preferredColormap: "terrain",
        preferredColormapReversed: false,
      })
    ).rejects.toThrow();
  });
});

describe("connectionsApi.setPreferredColormap", () => {
  it("PATCHes /api/connections/{id}/colormap with the payload", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        preferred_colormap: "plasma",
        preferred_colormap_reversed: true,
      }),
    });
    const result = await connectionsApi.setPreferredColormap("xyz", {
      preferredColormap: "plasma",
      preferredColormapReversed: true,
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/connections/xyz/colormap");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      preferred_colormap: "plasma",
      preferred_colormap_reversed: true,
    });
    expect((result as unknown as Record<string, unknown>).preferred_colormap).toBe(
      "plasma"
    );
  });
});
