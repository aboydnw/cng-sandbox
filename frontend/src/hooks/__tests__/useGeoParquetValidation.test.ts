import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { useGeoParquetValidation } from "../useGeoParquetValidation";

const mockRunQuery = vi.fn();

vi.mock("../useGeoParquetQuery", () => ({
  useGeoParquetQuery: () => ({
    runQuery: mockRunQuery,
  }),
}));

beforeEach(() => {
  mockRunQuery.mockReset();
  vi.clearAllMocks();
});

describe("useGeoParquetValidation", () => {
  it("returns valid state with geometry info for valid GeoParquet", async () => {
    const mockConn = { query: vi.fn() } as unknown as AsyncDuckDBConnection;

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

    mockRunQuery.mockImplementation(async (sql) => {
      if (sql.includes("DESCRIBE")) {
        return describeResult;
      }
      if (sql.includes("ST_GeometryType")) {
        return geomTypeResult;
      }
      if (sql.includes("ST_Extent")) {
        return bboxResult;
      }
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
    const mockConn = { query: vi.fn() } as unknown as AsyncDuckDBConnection;

    mockRunQuery.mockImplementation(async () => {
      const error = new Error("Not found (404)");
      throw error;
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
    const mockConn = { query: vi.fn() } as unknown as AsyncDuckDBConnection;

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

    mockRunQuery.mockImplementation(async (sql) => {
      if (sql.includes("DESCRIBE")) {
        return describeResult;
      }
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

  it("sets validating to true while validation is in progress", async () => {
    const mockConn = { query: vi.fn() } as unknown as AsyncDuckDBConnection;

    let resolveDescribe: (value: unknown) => void = () => {};
    const describePromise = new Promise((resolve) => {
      resolveDescribe = resolve;
    });

    const describeResult = {
      numRows: 1,
      get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
    };

    mockRunQuery.mockImplementation(async (sql) => {
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
    const mockConn = { query: vi.fn() } as unknown as AsyncDuckDBConnection;

    const describeResult = {
      numRows: 1,
      get: () => ({
        column_name: "geom'; DROP TABLE--",
        column_type: "GEOMETRY",
      }),
    };

    mockRunQuery.mockImplementation(async (sql) => {
      if (sql.includes("DESCRIBE")) {
        return describeResult;
      }
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
    const mockConn = { query: vi.fn() } as unknown as AsyncDuckDBConnection;

    let validateCallCount = 0;
    mockRunQuery.mockImplementation(async (sql) => {
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
    const mockConn = { query: vi.fn() } as unknown as AsyncDuckDBConnection;

    mockRunQuery.mockImplementation(async () => {
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
});
