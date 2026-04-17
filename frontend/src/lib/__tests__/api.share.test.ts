import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectionsApi, datasetsApi } from "../api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("connectionsApi.share", () => {
  it("PATCHes /api/connections/:id/share with is_shared: true", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await connectionsApi.share("c1", true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/connections/c1/share");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ is_shared: true });
  });

  it("PATCHes /api/connections/:id/share with is_shared: false", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await connectionsApi.share("c1", false);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/connections/c1/share");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ is_shared: false });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(connectionsApi.share("c1", true)).rejects.toThrow("HTTP 403");
  });
});

describe("datasetsApi.share", () => {
  it("PATCHes /api/datasets/:id/share with is_shared: true", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await datasetsApi.share("d1", true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/datasets/d1/share");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ is_shared: true });
  });

  it("PATCHes /api/datasets/:id/share with is_shared: false", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await datasetsApi.share("d1", false);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/datasets/d1/share");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ is_shared: false });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(datasetsApi.share("d1", true)).rejects.toThrow("HTTP 403");
  });
});
