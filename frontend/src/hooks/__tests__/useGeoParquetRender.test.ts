import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGeoParquetRender } from "../useGeoParquetRender";

function makeMockConn(rows: { __geojson: string; name: string }[]) {
  const mockTable = {
    numRows: rows.length,
    get: (i: number) => rows[i],
    schema: {
      fields: [{ name: "__geojson" }, { name: "name" }],
    },
  };
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("DESCRIBE")) {
      return {
        numRows: 2,
        get: (i: number) =>
          i === 0
            ? { column_name: "geometry", column_type: "GEOMETRY" }
            : { column_name: "name", column_type: "VARCHAR" },
      };
    }
    if (sql.startsWith("SELECT COUNT")) {
      return { numRows: 1, get: () => ({ cnt: rows.length }) };
    }
    return mockTable;
  });
  return { query } as unknown as import("@duckdb/duckdb-wasm").AsyncDuckDBConnection;
}

describe("useGeoParquetRender", () => {
  it("returns an Arrow-shaped table after load()", async () => {
    const conn = makeMockConn([
      { __geojson: '{"type":"Point","coordinates":[0,0]}', name: "A" },
    ]);
    const { result } = renderHook(() =>
      useGeoParquetRender(conn, "https://example.com/x.parquet")
    );
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.table).not.toBeNull());
    expect(result.current.table?.numRows).toBe(1);
    expect(result.current.featureCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("blocks load when feature count exceeds cap", async () => {
    const conn = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SELECT COUNT")) {
          return { numRows: 1, get: () => ({ cnt: 600_000 }) };
        }
        return { numRows: 0, get: () => null };
      }),
    } as unknown as import("@duckdb/duckdb-wasm").AsyncDuckDBConnection;

    const { result } = renderHook(() =>
      useGeoParquetRender(conn, "https://example.com/big.parquet", { featureCap: 500_000 })
    );
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.table).toBeNull();
    expect(result.current.error).toMatch(/too large/i);
    expect(result.current.overCap).toBe(true);
  });

  it("does nothing when conn is null", async () => {
    const { result } = renderHook(() =>
      useGeoParquetRender(null, "https://example.com/x.parquet")
    );
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.table).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
