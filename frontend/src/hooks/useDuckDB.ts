import { useRef, useState, useCallback } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";

interface DuckDBState {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
  loading: boolean;
  error: string | null;
}

const dbSingleton: {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
} = {
  db: null,
  conn: null,
};

export function useDuckDB() {
  const [state, setState] = useState<DuckDBState>({
    db: dbSingleton.db,
    conn: dbSingleton.conn,
    loading: false,
    error: null,
  });
  const initializingRef = useRef(false);

  const initialize = useCallback(async () => {
    if (dbSingleton.db && dbSingleton.conn) {
      setState({
        db: dbSingleton.db,
        conn: dbSingleton.conn,
        loading: false,
        error: null,
      });
      return;
    }
    if (initializingRef.current) return;
    initializingRef.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const DUCKDB_BUNDLES = await duckdb.selectBundle(
        duckdb.getJsDelivrBundles()
      );

      // Fetch the worker script and create a same-origin blob URL
      // to avoid cross-origin Worker restrictions
      const workerResponse = await fetch(DUCKDB_BUNDLES.mainWorker!);
      const workerBlob = new Blob([await workerResponse.text()], {
        type: "application/javascript",
      });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger();
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(
        DUCKDB_BUNDLES.mainModule,
        DUCKDB_BUNDLES.pthreadWorker
      );

      const conn = await db.connect();
      await conn.query("INSTALL spatial; LOAD spatial;");

      dbSingleton.db = db;
      dbSingleton.conn = conn;
      setState({ db, conn, loading: false, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DuckDB could not be loaded";
      setState({ db: null, conn: null, loading: false, error: msg });
    } finally {
      initializingRef.current = false;
    }
  }, []);

  return { ...state, initialize };
}
