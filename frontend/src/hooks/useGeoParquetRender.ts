import { useCallback, useRef, useState } from "react";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { Table } from "apache-arrow";

const DEFAULT_FEATURE_CAP = 500_000;
const GEOM_NAMES = ["geometry", "geom", "wkb_geometry", "the_geom"];

export interface GeoParquetRenderState {
  table: Table | null;
  featureCount: number;
  loading: boolean;
  error: string | null;
  overCap: boolean;
}

export interface UseGeoParquetRenderOptions {
  featureCap?: number;
}

export function useGeoParquetRender(
  conn: AsyncDuckDBConnection | null,
  url: string,
  options: UseGeoParquetRenderOptions = {}
) {
  const featureCap = options.featureCap ?? DEFAULT_FEATURE_CAP;
  const [state, setState] = useState<GeoParquetRenderState>({
    table: null,
    featureCount: 0,
    loading: false,
    error: null,
    overCap: false,
  });
  const geomColRef = useRef<string | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqIdRef.current;
    if (!conn || !url) {
      geomColRef.current = null;
      setState({
        table: null,
        featureCount: 0,
        loading: false,
        error: null,
        overCap: false,
      });
      return;
    }
    // Reset geometry column detection for each new load so URL switches
    // don't reuse a column name that may not exist in the new file.
    geomColRef.current = null;
    setState((s) => ({ ...s, loading: true, error: null, overCap: false }));
    try {
      // Escape single quotes to prevent SQL injection via URL values.
      const safeUrl = url.split("'").join("''");

      const countResult = await conn.query(
        `SELECT COUNT(*) as cnt FROM read_parquet('${safeUrl}')`
      );
      if (myReq !== reqIdRef.current) return;
      const featureCount = Number(countResult.get(0)?.cnt ?? 0);

      if (featureCount > featureCap) {
        setState({
          table: null,
          featureCount,
          loading: false,
          error: `Dataset too large for in-browser rendering (${featureCount.toLocaleString()} features > ${featureCap.toLocaleString()} cap). Server-side conversion coming soon.`,
          overCap: true,
        });
        return;
      }

      if (!geomColRef.current) {
        const desc = await conn.query(
          `DESCRIBE SELECT * FROM read_parquet('${safeUrl}') LIMIT 0`
        );
        if (myReq !== reqIdRef.current) return;
        for (let i = 0; i < desc.numRows; i++) {
          const row = desc.get(i);
          if (!row) continue;
          const colType = String(row.column_type);
          const colName = String(row.column_name);
          if (
            colType.includes("GEOMETRY") ||
            (colType === "BLOB" && GEOM_NAMES.includes(colName.toLowerCase()))
          ) {
            geomColRef.current = colName;
            break;
          }
        }
      }

      const geomCol = geomColRef.current;
      const safeGeomCol = geomCol ? geomCol.replace(/"/g, '""') : null;
      const sql = safeGeomCol
        ? `SELECT * EXCLUDE ("${safeGeomCol}"), ST_AsGeoJSON("${safeGeomCol}") as __geojson FROM read_parquet('${safeUrl}') LIMIT ${featureCap}`
        : `SELECT * FROM read_parquet('${safeUrl}') LIMIT ${featureCap}`;
      const table = (await conn.query(sql)) as unknown as Table;
      if (myReq !== reqIdRef.current) return;

      setState({
        table,
        featureCount,
        loading: false,
        error: null,
        overCap: false,
      });
    } catch (e) {
      if (myReq !== reqIdRef.current) return;
      setState({
        table: null,
        featureCount: 0,
        loading: false,
        error: e instanceof Error ? e.message : "Query failed",
        overCap: false,
      });
    }
  }, [conn, url, featureCap]);

  return { ...state, load };
}
