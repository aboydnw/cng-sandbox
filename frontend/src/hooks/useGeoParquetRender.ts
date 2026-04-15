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

  const load = useCallback(async () => {
    if (!conn || !url) return;
    setState((s) => ({ ...s, loading: true, error: null, overCap: false }));
    try {
      const countResult = await conn.query(
        `SELECT COUNT(*) as cnt FROM read_parquet('${url}')`
      );
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
          `DESCRIBE SELECT * FROM read_parquet('${url}') LIMIT 0`
        );
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
      const sql = geomCol
        ? `SELECT * EXCLUDE ("${geomCol}"), ST_AsGeoJSON("${geomCol}") as __geojson FROM read_parquet('${url}') LIMIT ${featureCap}`
        : `SELECT * FROM read_parquet('${url}') LIMIT ${featureCap}`;
      const table = (await conn.query(sql)) as unknown as Table;

      setState({
        table,
        featureCount,
        loading: false,
        error: null,
        overCap: false,
      });
    } catch (e) {
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
