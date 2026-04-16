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
      if (sql.includes("ST_XMin")) return bboxResult;
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
    expect(result.current.error).toBe(
      "Could not access URL: file not found (404)"
    );
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
      if (sql.includes("ST_XMin")) {
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
      if (sql.includes("ST_XMin")) {
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

    let validatePromise: Promise<void> = Promise.resolve();
    act(() => {
      validatePromise = result.current.validate();
    });

    // Assert mid-flight: validating should be true while DESCRIBE is pending
    await waitFor(() => expect(result.current.validating).toBe(true));

    resolveDescribe(undefined);
    await act(async () => {
      await validatePromise;
    });

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
      if (sql.includes("ST_XMin")) {
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

    // validateCallCount counts SQL queries issued to the mock conn (4 per
    // validation: DESCRIBE, ST_GeometryType, bbox (ST_XMin/MAX aggregate),
    // parquet_metadata for size detection). The second validate() call is
    // skipped due to the in-flight guard, so we expect exactly 4 queries,
    // not 8.
    expect(validateCallCount).toBe(4);
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

  it("passes absolute URLs through unchanged and prefixes relative paths with window.location.origin", async () => {
    const queries: string[] = [];
    const describeResult = {
      numRows: 1,
      get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
    };
    const makeQueryConn = () =>
      ({
        query: vi.fn(async (sql: string) => {
          queries.push(sql);
          if (sql.includes("DESCRIBE")) return describeResult;
          if (sql.includes("ST_GeometryType")) {
            return { numRows: 1, get: () => ({ geom_type: "POINT" }) };
          }
          if (sql.includes("ST_XMin")) {
            return {
              numRows: 1,
              get: () => ({ minx: 0, miny: 0, maxx: 1, maxy: 1 }),
            };
          }
        }),
      }) as unknown as AsyncDuckDBConnection;

    // Absolute URL: passed through unchanged
    queries.length = 0;
    const absoluteConn = makeQueryConn();
    const absoluteUrl = "https://example.com/data.parquet";
    const { result: absoluteResult } = renderHook(() =>
      useGeoParquetValidation(absoluteConn, absoluteUrl)
    );
    await act(async () => {
      await absoluteResult.current.validate();
    });
    expect(absoluteResult.current.valid).toBe(true);
    for (const q of queries) {
      expect(q).toContain("https://example.com/data.parquet");
      expect(q).not.toContain(`${window.location.origin}https://`);
    }

    // Relative path: prefixed with window.location.origin
    queries.length = 0;
    const relativeConn = makeQueryConn();
    const relativePath = "/api/data.parquet";
    const { result: relativeResult } = renderHook(() =>
      useGeoParquetValidation(relativeConn, relativePath)
    );
    await act(async () => {
      await relativeResult.current.validate();
    });
    expect(relativeResult.current.valid).toBe(true);
    for (const q of queries) {
      expect(q).toContain(`${window.location.origin}/api/data.parquet`);
    }

    // Path without leading slash: still prefixed correctly with a single slash
    queries.length = 0;
    const bareConn = makeQueryConn();
    const barePath = "api/data.parquet";
    const { result: bareResult } = renderHook(() =>
      useGeoParquetValidation(bareConn, barePath)
    );
    await act(async () => {
      await bareResult.current.validate();
    });
    expect(bareResult.current.valid).toBe(true);
    for (const q of queries) {
      expect(q).toContain(`${window.location.origin}/api/data.parquet`);
    }
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
        if (sql.includes("ST_XMin")) {
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

  it("reports size and picks a render path after validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-length": "8000000" }),
      }))
    );

    const mockConn = makeConn((sql) => {
      if (sql.includes("DESCRIBE")) {
        return {
          numRows: 1,
          get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
        };
      }
      if (sql.includes("ST_GeometryType")) {
        return { numRows: 1, get: () => ({ geom_type: "POINT" }) };
      }
      if (sql.includes("ST_XMin")) {
        return {
          numRows: 1,
          get: () => ({ minx: 0, miny: 0, maxx: 1, maxy: 1 }),
        };
      }
    });

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "https://example.com/small.parquet")
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(true);
    expect(result.current.sizeBytes).toBe(8000000);
    expect(result.current.sizeSource).toBe("head");
    expect(result.current.renderPath).toBe("client");

    vi.unstubAllGlobals();
  });

  it("uses the overrideUrl argument when provided instead of the hook's parquetUrl", async () => {
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
          return { numRows: 1, get: () => ({ geom_type: "POLYGON" }) };
        }
        if (sql.includes("ST_XMin")) {
          return {
            numRows: 1,
            get: () => ({ minx: -1, miny: -1, maxx: 1, maxy: 1 }),
          };
        }
      }),
    } as unknown as AsyncDuckDBConnection;

    // Hook is created with an empty parquetUrl. Without the override, every
    // query would run against `${window.location.origin}/` (empty URL
    // resolving to the dev server root). This simulates the common case
    // where the caller issues setPreviewUrl(...) and then immediately calls
    // validate() before React has re-rendered the hook with the new URL.
    const { result } = renderHook(() => useGeoParquetValidation(mockConn, ""));

    const overrideUrl = "https://example.com/override.parquet";
    await act(async () => {
      await result.current.validate(undefined, overrideUrl);
    });

    expect(result.current.valid).toBe(true);
    for (const q of queries) {
      expect(q).toContain(overrideUrl);
      expect(q).not.toContain(`${window.location.origin}/'`);
    }
  });

  it("computes the bbox with aggregate MIN/MAX of ST_XMin/YMin/XMax/YMax", async () => {
    const queries: string[] = [];
    const mockConn = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("DESCRIBE")) {
          return {
            numRows: 1,
            get: () => ({ column_name: "geometry", column_type: "GEOMETRY" }),
          };
        }
        if (sql.includes("ST_GeometryType")) {
          return { numRows: 1, get: () => ({ geom_type: "POINT" }) };
        }
        if (sql.includes("ST_XMin")) {
          return {
            numRows: 1,
            get: () => ({ minx: 0, miny: 0, maxx: 1, maxy: 1 }),
          };
        }
      }),
    } as unknown as AsyncDuckDBConnection;

    const { result } = renderHook(() =>
      useGeoParquetValidation(mockConn, "https://example.com/t.parquet")
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.valid).toBe(true);
    const bboxQuery = queries.find((q) => q.includes("ST_XMin"));
    expect(bboxQuery).toBeDefined();
    // Aggregate form (not the broken scalar ST_MinX(ext) / ST_Extent CTE)
    expect(bboxQuery).toContain("MIN(ST_XMin");
    expect(bboxQuery).toContain("MIN(ST_YMin");
    expect(bboxQuery).toContain("MAX(ST_XMax");
    expect(bboxQuery).toContain("MAX(ST_YMax");
    expect(bboxQuery).not.toMatch(/ST_MinX|ST_MaxX|ST_MinY|ST_MaxY/);
  });
});
