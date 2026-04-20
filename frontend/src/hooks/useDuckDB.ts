import { useState, useCallback } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";

interface DuckDBState {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
  loading: boolean;
  error: string | null;
}

type DuckDBHandle = {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
};

const dbSingleton: {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
} = {
  db: null,
  conn: null,
};

let initPromise: Promise<DuckDBHandle> | null = null;

async function createDuckDB(): Promise<DuckDBHandle> {
  const DUCKDB_BUNDLES = await duckdb.selectBundle(
    duckdb.getJsDelivrBundles()
  );

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
  return { db, conn };
}

export function useDuckDB() {
  const [state, setState] = useState<DuckDBState>({
    db: dbSingleton.db,
    conn: dbSingleton.conn,
    loading: false,
    error: null,
  });

  const initialize = useCallback(async (): Promise<DuckDBHandle | null> => {
    if (dbSingleton.db && dbSingleton.conn) {
      const handle = { db: dbSingleton.db, conn: dbSingleton.conn };
      setState({ ...handle, loading: false, error: null });
      return handle;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    if (!initPromise) {
      initPromise = createDuckDB().catch((e) => {
        initPromise = null;
        throw e;
      });
    }

    try {
      const handle = await initPromise;
      setState({ ...handle, loading: false, error: null });
      return handle;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DuckDB could not be loaded";
      setState({ db: null, conn: null, loading: false, error: msg });
      return null;
    }
  }, []);

  return { ...state, initialize };
}
