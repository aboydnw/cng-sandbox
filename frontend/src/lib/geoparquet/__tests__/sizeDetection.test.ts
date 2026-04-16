import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectRemoteSize } from "../sizeDetection";

describe("detectRemoteSize", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Content-Length from HEAD when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-length": "12345" }),
      }))
    );
    const conn = { query: vi.fn() } as never;
    const result = await detectRemoteSize("https://example.com/x.parquet", conn);
    expect(result).toEqual({ sizeBytes: 12345, source: "head" });
  });

  it("falls back to DuckDB parquet_metadata when HEAD lacks Content-Length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, headers: new Headers() }))
    );
    const conn = {
      query: vi.fn(async () => ({
        numRows: 1,
        get: () => ({ total_uncompressed_size: 9_000_000 }),
      })),
    } as never;
    const result = await detectRemoteSize("https://example.com/x.parquet", conn);
    expect(result).toEqual({ sizeBytes: 9_000_000, source: "footer" });
  });

  it("returns unknown on total failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("blocked");
      })
    );
    const conn = {
      query: vi.fn(async () => {
        throw new Error("no");
      }),
    } as never;
    const result = await detectRemoteSize("https://example.com/x.parquet", conn);
    expect(result).toEqual({ sizeBytes: null, source: "unknown" });
  });
});
