import { describe, expect, it, vi, beforeEach, afterEach, Mock } from "vitest";
import { connectSourceCoop } from "../sourceCoopApi";

describe("connectSourceCoop", () => {
  const originalFetch = global.fetch;
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts the product slug with workspace header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ dataset_id: "abc", job_id: "xyz" }),
    });

    const result = await connectSourceCoop("alexgleith/gebco-2024", "deadbeef");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/connect-source-coop");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-Workspace-Id"]).toBe("deadbeef");
    expect(init.body).toBe(
      JSON.stringify({ product_slug: "alexgleith/gebco-2024" }),
    );

    expect(result).toEqual({ dataset_id: "abc", job_id: "xyz" });
  });

  it("throws with the detail message on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => ({ detail: "source.coop unreachable" }),
    });

    await expect(
      connectSourceCoop("alexgleith/gebco-2024", "deadbeef"),
    ).rejects.toThrow(/source.coop unreachable/);
  });

  it("throws a fallback message when the response body has no detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(
      connectSourceCoop("alexgleith/gebco-2024", "deadbeef"),
    ).rejects.toThrow();
  });
});
