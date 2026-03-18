import { useState, useCallback, useRef } from "react";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { Table } from "apache-arrow";

export interface ColumnStats {
  name: string;
  type: "numeric" | "categorical" | "date" | "geometry" | "other";
  min?: number;
  max?: number;
  mean?: number;
  uniqueCount?: number;
  topValues?: Array<{ value: string; count: number }>;
}

export interface QueryResult {
  table: Table | null;
  totalCount: number;
  filteredCount: number;
  columnStats: ColumnStats[];
  truncated: boolean;
  error: string | null;
}

const FEATURE_LIMIT = 100_000;
const GEOM_NAMES = ["geometry", "geom", "wkb_geometry", "the_geom"];

export function useGeoParquetQuery(conn: AsyncDuckDBConnection | null, parquetUrl: string) {
  const [result, setResult] = useState<QueryResult>({
    table: null,
    totalCount: 0,
    filteredCount: 0,
    columnStats: [],
    truncated: false,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const geomColRef = useRef<string | null>(null);

  const fullUrl = `${window.location.origin}${parquetUrl}`;

  const computeStats = useCallback(
    async (whereClause: string): Promise<{ count: number; stats: ColumnStats[] }> => {
      if (!conn) return { count: 0, stats: [] };

      const countResult = await conn.query(
        `SELECT COUNT(*) as cnt FROM read_parquet('${fullUrl}') ${whereClause}`
      );
      const count = Number(countResult.get(0)?.cnt ?? 0);

      const summarize = await conn.query(`SUMMARIZE SELECT * FROM read_parquet('${fullUrl}') ${whereClause}`);
      const stats: ColumnStats[] = [];

      for (let i = 0; i < summarize.numRows; i++) {
        const row = summarize.get(i);
        if (!row) continue;
        const colName = String(row.column_name);
        const colType = String(row.column_type);

        // Skip geometry and ID-like columns
        if (colType.includes("GEOMETRY") || colType === "BLOB") continue;
        if (["id", "fid", "ogc_fid"].includes(colName.toLowerCase())) continue;

        if (["INTEGER", "BIGINT", "DOUBLE", "FLOAT", "SMALLINT", "TINYINT", "HUGEINT", "DECIMAL"].some(t => colType.includes(t))) {
          stats.push({
            name: colName,
            type: "numeric",
            min: Number(row.min),
            max: Number(row.max),
            mean: row.avg != null ? Number(row.avg) : undefined,
            uniqueCount: Number(row.approx_unique),
          });
        } else if (colType.includes("DATE") || colType.includes("TIMESTAMP")) {
          stats.push({ name: colName, type: "date", uniqueCount: Number(row.approx_unique) });
        } else if (colType === "VARCHAR" || colType === "STRING") {
          const uniqueCount = Number(row.approx_unique);
          let topValues: Array<{ value: string; count: number }> = [];
          if (uniqueCount <= 20) {
            const topResult = await conn.query(
              `SELECT "${colName}" as val, COUNT(*) as cnt FROM read_parquet('${fullUrl}') ${whereClause} GROUP BY "${colName}" ORDER BY cnt DESC LIMIT 20`
            );
            topValues = Array.from({ length: topResult.numRows }, (_, j) => {
              const r = topResult.get(j)!;
              return { value: String(r.val), count: Number(r.cnt) };
            });
          }
          stats.push({ name: colName, type: "categorical", uniqueCount, topValues });
        }
      }
      return { count, stats };
    },
    [conn, fullUrl],
  );

  const runQuery = useCallback(
    async (sql: string) => {
      if (!conn) return;
      setLoading(true);
      try {
        // Get total count (unfiltered) for context
        const totalResult = await conn.query(`SELECT COUNT(*) as cnt FROM read_parquet('${fullUrl}')`);
        const totalCount = Number(totalResult.get(0)?.cnt ?? 0);

        // Detect geometry column name on first run
        if (!geomColRef.current) {
          const descResult = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${fullUrl}') LIMIT 0`);
          for (let i = 0; i < descResult.numRows; i++) {
            const row = descResult.get(i);
            if (!row) continue;
            const colType = String(row.column_type);
            const colName = String(row.column_name);
            if (colType.includes("GEOMETRY") || colType === "BLOB" && GEOM_NAMES.includes(colName.toLowerCase())) {
              geomColRef.current = colName;
              break;
            }
          }
        }

        // Convert geometry from WKB to GeoJSON text so deck.gl can render it
        const geomCol = geomColRef.current;
        const geojsonSql = geomCol
          ? `SELECT * EXCLUDE ("${geomCol}"), ST_AsGeoJSON("${geomCol}") as __geojson FROM (${sql}) _limited LIMIT ${FEATURE_LIMIT}`
          : `SELECT * FROM (${sql}) _limited LIMIT ${FEATURE_LIMIT}`;
        const table = (await conn.query(geojsonSql)) as unknown as Table;

        // Get filtered count from the original query (without limit)
        const countSql = `SELECT COUNT(*) as cnt FROM (${sql}) _sub`;
        const countResult = await conn.query(countSql);
        const filteredCount = Number(countResult.get(0)?.cnt ?? 0);

        // Extract WHERE clause for stats computation
        const whereMatch = sql.match(/WHERE\s+(.+)$/i);
        const whereClause = whereMatch ? `WHERE ${whereMatch[1]}` : "";
        const { stats } = await computeStats(whereClause);

        setResult({
          table,
          totalCount,
          filteredCount,
          columnStats: stats,
          truncated: filteredCount > FEATURE_LIMIT,
          error: null,
        });
      } catch (e) {
        setResult((prev) => ({
          ...prev,
          table: null,
          error: e instanceof Error ? e.message : "Query failed",
        }));
      } finally {
        setLoading(false);
      }
    },
    [conn, fullUrl, computeStats],
  );

  const loadInitial = useCallback(async () => {
    if (!conn) return;
    const sql = `SELECT * FROM read_parquet('${fullUrl}')`;
    await runQuery(sql);
  }, [conn, fullUrl, runQuery]);

  return { result, loading, runQuery, loadInitial };
}
