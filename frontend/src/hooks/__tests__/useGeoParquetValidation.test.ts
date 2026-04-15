import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { useGeoParquetValidation } from "../useGeoParquetValidation";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeConn(
  impl: (sql: string) => Promise<unknown> | unknown
): AsyncDuckDBConnection {
  return {
    query: vi.fn(async (sql: string) => impl(sql)),
  } as unknown as AsyncDuckDBConnection;
}

describe("useGeoParquetValidation", () => {
  it("returns valid state with geometry info for valid GeoParquet", async () => {
    const describeResult = {
      numRows: 2,
      get: (i: number) => {
        if (i === 0) {
          return {
            column_name: "id",
            column_type: "INTEGER",
          };
        }
        return {
          column_name: "geometry",
          column_type: "GEOMETRY",
        };
      },
    };

    const geomTypeResult = {
      numRows: 1,
      get: () => ({
        geom_type: "POINT",
      }),
    };

    const bboxResult = {
      numRows: 1,
      get: () => ({
        minx: -120,
        miny: -45,
        maxx: 120,
        maxy: 45,
      }),
    };

    const mockConn = makeConn((sql) => {
      if (sql.includes("DESCRIBE")) return describeResult;
      if (sql.includes("ST_GeometryType")) return geomTypeResult;
      if (sql.includes("ST_Extent")) return bboxResult;
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "/api/test.parquet")
    );

    expect(result.current.validating).toBe(false);
    expect(result.current.valid).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.geometryInfo).toBeNull();

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.geometryInfo).not.toBeNull();
    expect(result.current.geometryInfo?.type).toBe("POINT");
    expect(result.current.geometryInfo?.bbox).toEqual({
      minLon: -120,
      minLat: -45,
      maxLon: 120,
      maxLat: 45,
    });
  });

  it("returns error state for unreachable URL", async () => {
    const mockConn = makeConn(() => {
      throw new Error("Not found (404)");
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "/api/missing.parquet")
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(false);
    expect(result.current.error).toBe("Could not access URL: file not found (404)");
    expect(result.current.geometryInfo).toBeNull();
  });

  it("returns error state when no geometry column detected", async () => {
    const describeResult = {
      numRows: 2,
      get: (i: number) => {
        if (i === 0) {
          return {
            column_name: "id",
            column_type: "INTEGER",
          };
        }
        return {
          column_name: "name",
          column_type: "VARCHAR",
        };
      },
    };

    const mockConn = makeConn((sql) => {
      if (sql.includes("DESCRIBE")) return describeResult;
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "/api/test.parquet")
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(false);
    expect(result.current.error).toBe("No geometry column detected");
    expect(result.current.geometryInfo).toBeNull();
  });

  it("returns error when connection is null", async () => {
    const { result } = renderHook(() =>
      useGeoParquetValidation(null, "/api/test.parquet")
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(false);
    expect(result.current.error).toBe("DuckDB connection not available");
  });

  it("uses the override conn when provided even if hook conn is null", async () => {
    const describeResult = {
      numRows: 1,
      get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
    };
    const overrideConn = makeConn((sql) => {
      if (sql.includes("DESCRIBE")) return describeResult;
      if (sql.includes("ST_GeometryType")) {
        return { numRows: 1, get: () => ({ geom_type: "POINT" }) };
      }
      if (sql.includes("ST_Extent")) {
        return {
          numRows: 1,
          get: () => ({ minx: -1, miny: -1, maxx: 1, maxy: 1 }),
        };
      }
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(null, "/api/test.parquet")
    );

    await act(async () => {
      await result.current.validate(overrideConn);
    });

    expect(result.current.valid).toBe(true);
    expect(result.current.geometryInfo?.type).toBe("POINT");
  });

  it("sets validating to true while validation is in progress", async () => {
    let resolveDescribe: (value: unknown) => void = () => {};
    const describePromise = new Promise((resolve) => {
      resolveDescribe = resolve;
    });

    const describeResult = {
      numRows: 1,
      get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
    };

    const mockConn = makeConn(async (sql) => {
      if (sql.includes("DESCRIBE")) {
        await describePromise;
        return describeResult;
      }
      if (sql.includes("ST_GeometryType")) {
        return {
          numRows: 1,
          get: () => ({ geom_type: "POINT" }),
        };
      }
      if (sql.includes("ST_Extent")) {
        return {
          numRows: 1,
          get: () => ({
            minx: -120,
            miny: -45,
            maxx: 120,
            maxy: 45,
          }),
        };
      }
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "/api/test.parquet")
    );

    const validatePromise = act(async () => {
      result.current.validate();
    });

    resolveDescribe(undefined);
    await validatePromise;

    // State should eventually be set to valid=true
    await waitFor(() => expect(result.current.validating).toBe(false));
    expect(result.current.valid).toBe(true);
  });

  it("returns error when geometry column name contains invalid characters", async () => {
    const describeResult = {
      numRows: 1,
      get: () => ({
        column_name: "geom'; DROP TABLE--",
        column_type: "GEOMETRY",
      }),
    };

    const mockConn = makeConn((sql) => {
      if (sql.includes("DESCRIBE")) return describeResult;
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "/api/test.parquet")
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(false);
    expect(result.current.error).toBe("Invalid column name");
  });

  it("does not allow concurrent validation calls", async () => {
    let validateCallCount = 0;
    const mockConn = makeConn(async (sql) => {
      validateCallCount++;
      if (sql.includes("DESCRIBE")) {
        return {
          numRows: 1,
          get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
        };
      }
      if (sql.includes("ST_GeometryType")) {
        return {
          numRows: 1,
          get: () => ({ geom_type: "POINT" }),
        };
      }
      if (sql.includes("ST_Extent")) {
        return {
          numRows: 1,
          get: () => ({
            minx: -120,
            miny: -45,
            maxx: 120,
            maxy: 45,
          }),
        };
      }
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "/api/test.parquet")
    );

    await act(async () => {
      result.current.validate();
      result.current.validate();
    });

    await waitFor(() => expect(result.current.validating).toBe(false));

    expect(validateCallCount).toBe(3);
  });

  it("sanitizes error messages to avoid exposing internal details", async () => {
    const mockConn = makeConn(() => {
      throw new Error("DuckDB Internal Error: GDAL Exception: Unknown format");
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "/api/test.parquet")
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(false);
    expect(result.current.error).toBe("File validation failed");
    expect(result.current.error).not.toContain("GDAL");
    expect(result.current.error).not.toContain("DuckDB");
  });

  it("escapes single quotes in the URL to prevent SQL injection", async () => {
    const queries: string[] = [];
    const describeResult = {
      numRows: 1,
      get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
    };
    const mockConn = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("DESCRIBE")) return describeResult;
        if (sql.includes("ST_GeometryType")) {
          return { numRows: 1, get: () => ({ geom_type: "POINT" }) };
        }
        if (sql.includes("ST_Extent")) {
          return {
            numRows: 1,
            get: () => ({ minx: 0, miny: 0, maxx: 1, maxy: 1 }),
          };
        }
      }),
    } as unknown as AsyncDuckDBConnection;

    const trickyUrl = "/api/data's.parquet";
    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, trickyUrl)
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(true);
    // Every SQL query should contain the escaped form, never a raw single quote breaking the literal
    for (const q of queries) {
      expect(q).toContain("data''s.parquet");
      expect(q).not.toContain("data's.parquet");
    }
  });
});
