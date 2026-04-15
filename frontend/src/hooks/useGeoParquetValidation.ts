import { useState, useCallback, useRef } from "react";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

function isValidColumnName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function resolveParquetUrl(parquetUrl: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(parquetUrl) || parquetUrl.startsWith("//")) {
    return parquetUrl;
  }
  const path = parquetUrl.startsWith("/") ? parquetUrl : `/${parquetUrl}`;
  return `${window.location.origin}${path}`;
}

export interface GeometryInfo {
  type: string;
  bbox: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  } | null;
  crs?: string;
}

export interface ValidationState {
  validating: boolean;
  valid: boolean;
  error: string | null;
  geometryInfo: GeometryInfo | null;
}

const GEOM_NAMES = ["geometry", "geom", "wkb_geometry", "the_geom"];

export function useGeoParquetValidation(
  conn: AsyncDuckDBConnection | null,
  parquetUrl: string
) {
  const [state, setState] = useState<ValidationState>({
    validating: false,
    valid: false,
    error: null,
    geometryInfo: null,
  });

  const validatingRef = useRef(false);

  const validate = useCallback(
    async (overrideConn?: AsyncDuckDBConnection | null) => {
      if (validatingRef.current) {
        console.warn(
          "Validation already in progress, skipping concurrent call"
        );
        return;
      }

      const activeConn = overrideConn ?? conn;

      if (!activeConn) {
        setState({
          validating: false,
          valid: false,
          error: "DuckDB connection not available",
          geometryInfo: null,
        });
        return;
      }

      validatingRef.current = true;
      setState((prev) => ({ ...prev, validating: true }));

      try {
        const fullUrl = resolveParquetUrl(parquetUrl);
        const escapedUrl = escapeSqlLiteral(fullUrl);

        // Step 1: Detect geometry column
        const descResult = await activeConn.query(
          `DESCRIBE SELECT * FROM read_parquet('${escapedUrl}') LIMIT 0`
        );

        let geometryColumnName: string | null = null;

        if (descResult && descResult.numRows) {
          for (let i = 0; i < descResult.numRows; i++) {
            const row = descResult.get(i);
            if (!row) continue;
            const colType = String(row.column_type);
            const colName = String(row.column_name);

            if (
              colType.includes("GEOMETRY") ||
              (colType === "BLOB" && GEOM_NAMES.includes(colName.toLowerCase()))
            ) {
              geometryColumnName = colName;
              break;
            }
          }
        }

        if (!geometryColumnName) {
          setState({
            validating: false,
            valid: false,
            error: "No geometry column detected",
            geometryInfo: null,
          });
          return;
        }

        if (!isValidColumnName(geometryColumnName)) {
          setState({
            validating: false,
            valid: false,
            error: "Invalid column name",
            geometryInfo: null,
          });
          return;
        }

        // Step 2: Get geometry type
        const geomTypeResult = await activeConn.query(
          `SELECT DISTINCT ST_GeometryType("${geometryColumnName}") as geom_type FROM read_parquet('${escapedUrl}') WHERE "${geometryColumnName}" IS NOT NULL LIMIT 1`
        );

        let geometryType = "UNKNOWN";
        if (geomTypeResult && geomTypeResult.numRows > 0) {
          const row = geomTypeResult.get(0);
          if (row && row.geom_type) {
            geometryType = String(row.geom_type);
          }
        }

        // Step 3: Get bounding box (compute ST_Extent once via CTE)
        const bboxResult = await activeConn.query(
          `WITH extent AS (
             SELECT ST_Extent("${geometryColumnName}") as ext
             FROM read_parquet('${escapedUrl}') WHERE "${geometryColumnName}" IS NOT NULL
           )
           SELECT ST_MinX(ext) as minx, ST_MinY(ext) as miny,
                  ST_MaxX(ext) as maxx, ST_MaxY(ext) as maxy
           FROM extent`
        );

        let bbox: GeometryInfo["bbox"] = null;
        if (bboxResult && bboxResult.numRows > 0) {
          const row = bboxResult.get(0);
          if (
            row &&
            row.minx != null &&
            row.miny != null &&
            row.maxx != null &&
            row.maxy != null
          ) {
            bbox = {
              minLon: Number(row.minx),
              minLat: Number(row.miny),
              maxLon: Number(row.maxx),
              maxLat: Number(row.maxy),
            };
          }
        }

        setState({
          validating: false,
          valid: true,
          error: null,
          geometryInfo: {
            type: geometryType,
            bbox,
          },
        });
      } catch (e) {
        const errorMessage = categorizeError(e);
        setState({
          validating: false,
          valid: false,
          error: errorMessage,
          geometryInfo: null,
        });
      } finally {
        validatingRef.current = false;
      }
    },
    [conn, parquetUrl]
  );

  return {
    ...state,
    validate,
  };
}

function categorizeError(error: unknown): string {
  if (error instanceof Error) {
    const errorMsg = error.message;
    const lowerMsg = errorMsg.toLowerCase();

    if (lowerMsg.includes("404") || lowerMsg.includes("not found")) {
      return "Could not access URL: file not found (404)";
    }
    if (lowerMsg.includes("403")) {
      return "Could not access URL: permission denied (403)";
    }
    if (lowerMsg.includes("network") || lowerMsg.includes("fetch")) {
      return `Could not access URL: ${errorMsg}`;
    }
    if (lowerMsg.includes("parquet")) {
      return "File is not a valid Parquet";
    }
    if (
      lowerMsg.includes("no geometry") ||
      lowerMsg.includes("geometry column not found")
    ) {
      return "No geometry column detected";
    }
    if (lowerMsg.includes("geometry")) {
      return "Geometry processing failed";
    }

    return "File validation failed";
  }

  return "Validation failed";
}
