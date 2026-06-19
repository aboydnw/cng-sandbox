import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@duckdb/duckdb-wasm", () => ({
  selectBundle: vi.fn(),
  getJsDelivrBundles: vi.fn(() => []),
  ConsoleLogger: vi.fn(),
  AsyncDuckDB: vi.fn(),
}));

const BUNDLE = {
  mainModule: "module.wasm",
  mainWorker: "worker.js",
  pthreadWorker: null,
};

async function loadModules() {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const { useDuckDB } = await import("../useDuckDB");
  return { duckdb, useDuckDB };
}

describe("useDuckDB", () => {
  beforeEach(() => {
    vi.resetModules();
    URL.createObjectURL = vi.fn(() => "blob:duckdb");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets error and returns null when bundle selection fails", async () => {
    const { duckdb, useDuckDB } = await loadModules();
    vi.mocked(duckdb.selectBundle).mockRejectedValue(
      new Error("CDN unreachable")
    );

    const { result } = renderHook(() => useDuckDB());
    let handle: unknown;
    await act(async () => {
      handle = await result.current.initialize();
    });

    expect(handle).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.conn).toBeNull();
    expect(result.current.db).toBeNull();
  });

  it("sets error when the worker fetch returns a non-ok response", async () => {
    const { duckdb, useDuckDB } = await loadModules();
    vi.mocked(duckdb.selectBundle).mockResolvedValue(BUNDLE);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => "not found",
      }))
    );

    const { result } = renderHook(() => useDuckDB());
    let handle: unknown;
    await act(async () => {
      handle = await result.current.initialize();
    });

    expect(handle).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.conn).toBeNull();
  });

  it("recovers when a retry succeeds after a failed init", async () => {
    const { duckdb, useDuckDB } = await loadModules();
    const mockConn = { query: vi.fn(async () => undefined) };
    vi.mocked(duckdb.AsyncDuckDB).mockImplementation(function () {
      return {
        instantiate: vi.fn(async () => undefined),
        connect: vi.fn(async () => mockConn),
      } as unknown as InstanceType<typeof duckdb.AsyncDuckDB>;
    });
    vi.mocked(duckdb.selectBundle)
      .mockRejectedValueOnce(new Error("CDN unreachable"))
      .mockResolvedValue(BUNDLE);
    vi.stubGlobal("Worker", vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => "" }))
    );

    const { result } = renderHook(() => useDuckDB());
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.error).not.toBeNull();

    let handle: unknown;
    await act(async () => {
      handle = await result.current.initialize();
    });
    expect(handle).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.conn).not.toBeNull();
  });
});
