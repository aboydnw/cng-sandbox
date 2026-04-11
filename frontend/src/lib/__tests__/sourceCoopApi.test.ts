import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { connectSourceCoop } from "../sourceCoopApi";

describe("connectSourceCoop", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts the product slug with workspace header", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ dataset_id: "abc", job_id: "xyz" }),
    });

    const result = await connectSourceCoop("alexgleith/gebco-2024", "deadbeef");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as any).mock.calls[0];
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
    (global.fetch as any).mockResolvedValueOnce({
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
    (global.fetch as any).mockResolvedValueOnce({
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
