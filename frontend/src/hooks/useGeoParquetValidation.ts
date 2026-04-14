import { useState, useCallback } from "react";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { useGeoParquetQuery } from "./useGeoParquetQuery";

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

  const { runQuery } = useGeoParquetQuery(conn, parquetUrl);

  const validate = useCallback(async () => {
    if (!conn) {
      setState({
        validating: false,
        valid: false,
        error: "DuckDB connection not available",
        geometryInfo: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, validating: true }));

    try {
      const fullUrl = `${window.location.origin}${parquetUrl}`;

      // Step 1: Detect geometry column
      const descResult = await runQuery(
        `DESCRIBE SELECT * FROM read_parquet('${fullUrl}') LIMIT 0`
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

      // Step 2: Get geometry type
      const geomTypeResult = await runQuery(
        `SELECT DISTINCT ST_GeometryType("${geometryColumnName}") as geom_type FROM read_parquet('${fullUrl}') WHERE "${geometryColumnName}" IS NOT NULL LIMIT 1`
      );

      let geometryType = "UNKNOWN";
      if (geomTypeResult && geomTypeResult.numRows > 0) {
        const row = geomTypeResult.get(0);
        if (row && row.geom_type) {
          geometryType = String(row.geom_type);
        }
      }

      // Step 3: Get bounding box
      const bboxResult = await runQuery(
        `SELECT ST_MinX(ST_Extent("${geometryColumnName}")) as minx,
                ST_MinY(ST_Extent("${geometryColumnName}")) as miny,
                ST_MaxX(ST_Extent("${geometryColumnName}")) as maxx,
                ST_MaxY(ST_Extent("${geometryColumnName}")) as maxy
         FROM read_parquet('${fullUrl}') WHERE "${geometryColumnName}" IS NOT NULL`
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
    }
  }, [conn, parquetUrl, runQuery]);

  return {
    ...state,
    validate,
  };
}

function categorizeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("not found") || message.includes("404")) {
      return "Could not access URL";
    }
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection")
    ) {
      return "Could not access URL";
    }

    return error.message;
  }

  return "Validation failed";
}
