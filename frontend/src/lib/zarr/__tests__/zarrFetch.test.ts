import { describe, it, expect, beforeEach, vi } from "vitest";
import { createZarrStore, _resetOriginCacheForTests } from "../zarrFetch";

describe("createZarrStore", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    _resetOriginCacheForTests();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("returns the response from a direct fetch when the upstream allows CORS", async () => {
    mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const store = createZarrStore("https://cors-ok.example.com/store.zarr");
    const result = await store.get("/zarr.json" as never);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledRequest = mockFetch.mock.calls[0][0] as Request;
    expect(calledRequest.url).toContain("cors-ok.example.com");
    expect(calledRequest.url).not.toContain("/api/zarr-proxy");
  });

  it("falls back to /api/zarr-proxy after a CORS TypeError", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const store = createZarrStore(
      "https://cors-blocked.example.com/store.zarr"
    );
    const result = await store.get("/zarr.json" as never);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const fallbackRequest = mockFetch.mock.calls[1][0] as Request;
    expect(fallbackRequest.url).toContain("/api/zarr-proxy?url=");
    expect(fallbackRequest.url).toContain(
      encodeURIComponent(
        "https://cors-blocked.example.com/store.zarr/zarr.json"
      )
    );
  });

  it("uses the cached proxy decision for subsequent same-origin requests", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("first", { status: 200 }))
      .mockResolvedValueOnce(new Response("second", { status: 200 }));

    const store = createZarrStore(
      "https://cors-blocked.example.com/store.zarr"
    );
    await store.get("/zarr.json" as never);
    await store.get("/0/0/0" as never);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const secondRequest = mockFetch.mock.calls[2][0] as Request;
    expect(secondRequest.url).toContain("/api/zarr-proxy?url=");
  });

  it("preserves the Range header when proxying", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response("partial", {
          status: 206,
          headers: { "content-range": "bytes 0-3/100" },
        })
      );

    const store = createZarrStore(
      "https://cors-blocked.example.com/store.zarr"
    );
    await store.getRange("/0/0/0" as never, { offset: 0, length: 4 });

    const proxiedRequest = mockFetch.mock.calls[1][0] as Request;
    expect(proxiedRequest.headers.get("range")).toBe("bytes=0-3");
  });
});
