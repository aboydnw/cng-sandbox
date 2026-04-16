import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

export interface SizeDetection {
  sizeBytes: number | null;
  source: "head" | "footer" | "unknown";
}

export async function detectRemoteSize(
  url: string,
  conn: AsyncDuckDBConnection | null
): Promise<SizeDetection> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) {
      const len = res.headers.get("content-length");
      if (len) return { sizeBytes: Number(len), source: "head" };
    }
  } catch {
    // fall through to footer read
  }

  if (conn) {
    try {
      const escapedUrl = url.replace(/'/g, "''");
      const metadata = await conn.query(
        `SELECT SUM(total_uncompressed_size) AS total_uncompressed_size FROM parquet_metadata('${escapedUrl}')`
      );
      const row = metadata.get(0);
      if (row?.total_uncompressed_size != null) {
        return {
          sizeBytes: Number(row.total_uncompressed_size),
          source: "footer",
        };
      }
    } catch {
      // fall through
    }
  }

  return { sizeBytes: null, source: "unknown" };
}
