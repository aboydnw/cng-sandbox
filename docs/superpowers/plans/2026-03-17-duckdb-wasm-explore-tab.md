# DuckDB-WASM Explore Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-based DuckDB-WASM "Explore" tab to the CNG sandbox that lets users query GeoParquet files directly and compare live-queried rendering (GeoArrow) against pre-tiled rendering (PMTiles) on the same map.

**Architecture:** DuckDB-WASM runs in the browser, queries GeoParquet files in MinIO via HTTP range requests through a Vite proxy. Query results are Arrow tables rendered via `@geoarrow/deck.gl-layers` on a deck.gl map. The existing CreditsPanel becomes tabbed — "Credits" shows PMTiles tiles, "Explore" shows DuckDB-queried features. Tab state in MapPage drives which map component renders.

**Tech Stack:** DuckDB-WASM, Apache Arrow JS, @geoarrow/deck.gl-layers, deck.gl 9, MapLibre GL JS, React 19, Chakra UI 3, Vite 4

**Spec:** `docs/superpowers/specs/2026-03-17-duckdb-wasm-explore-tab-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `sandbox/frontend/src/hooks/useDuckDB.ts` | Lazy-init DuckDB-WASM singleton, load spatial extension, expose `db` and `conn` refs |
| `sandbox/frontend/src/hooks/useGeoParquetQuery.ts` | Run SQL against a GeoParquet URL, return Arrow table + row count + column stats |
| `sandbox/frontend/src/hooks/useFilterQuery.ts` | Manage filter state, generate SQL WHERE clauses, debounce, track filter-vs-custom-SQL mode |
| `sandbox/frontend/src/components/ExploreTab.tsx` | Explore tab container: wires hooks together, renders FilterControls + SqlEditor + stats |
| `sandbox/frontend/src/components/DuckDBMap.tsx` | deck.gl + GeoArrow rendering for Arrow table results, MapLibre basemap |
| `sandbox/frontend/src/components/FilterControls.tsx` | Auto-generated filter widgets: range sliders (numeric), multi-selects (categorical) |
| `sandbox/frontend/src/components/SqlEditor.tsx` | Collapsible SQL textarea with run button, error display |

### Modified Files

| File | What Changes |
|------|-------------|
| `sandbox/ingestion/src/models.py` | Add `parquet_url: str \| None` field to Dataset |
| `sandbox/ingestion/src/services/pipeline.py` | Populate `parquet_url` with MinIO key after GeoParquet upload |
| `sandbox/frontend/src/types.ts` | Add `parquet_url?: string` to Dataset interface |
| `sandbox/frontend/vite.config.ts` | Add `/storage/` proxy to MinIO, add `optimizeDeps.exclude` for DuckDB-WASM |
| `sandbox/frontend/src/pages/MapPage.tsx` | Add tab state, basemap state, viewport sync, conditional VectorMap vs DuckDBMap |
| `sandbox/frontend/src/components/CreditsPanel.tsx` | Wrap existing content in Chakra Tabs; expose Explore tab slot |
| `sandbox/frontend/src/components/VectorMap.tsx` | Accept `basemap` prop + `onViewportChange` callback instead of internal state |

---

## Task 1: Backend — Add `parquet_url` to Dataset Model

**Files:**
- Modify: `sandbox/ingestion/src/models.py:79-106`
- Modify: `sandbox/ingestion/src/services/pipeline.py:244-269`
- Modify: `sandbox/frontend/src/types.ts:29-56`

- [ ] **Step 1: Add field to Python Dataset model**

In `sandbox/ingestion/src/models.py`, add after line 98 (`pg_table`):

```python
    parquet_url: str | None = None  # MinIO key for GeoParquet file (vector only)
```

- [ ] **Step 2: Populate parquet_url in pipeline.py**

In `sandbox/ingestion/src/services/pipeline.py`, the `converted_key` variable at line 216 already holds the MinIO key for the GeoParquet file. Pass it into the Dataset constructor. After line 265 (the `pg_table` assignment), add:

```python
            parquet_url=f"/storage/{converted_key}" if format_pair.dataset_type == DatasetType.VECTOR else None,
```

The `/storage/` prefix matches the new Vite proxy we'll add in Task 3.

- [ ] **Step 3: Add field to TypeScript Dataset type**

In `sandbox/frontend/src/types.ts`, add after the `pg_table` field:

```typescript
  parquet_url: string | null;
```

- [ ] **Step 4: Verify with existing ingestion tests**

Run: `cd sandbox/ingestion && uv run pytest -v`

Expected: All tests pass. The new field has a default of `None` so existing test fixtures don't break.

- [ ] **Step 5: Commit**

```bash
git add sandbox/ingestion/src/models.py sandbox/ingestion/src/services/pipeline.py sandbox/frontend/src/types.ts
git commit -m "feat(sandbox): add parquet_url field to Dataset model"
```

---

## Task 2: Install DuckDB-WASM Dependencies

**Files:**
- Modify: `sandbox/frontend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd sandbox/frontend && npm install @duckdb/duckdb-wasm apache-arrow @geoarrow/deck.gl-layers
```

- [ ] **Step 2: Verify install succeeded**

```bash
cd sandbox/frontend && node -e "require('@duckdb/duckdb-wasm'); console.log('ok')"
```

- [ ] **Step 3: Commit**

```bash
git add sandbox/frontend/package.json sandbox/frontend/package-lock.json
git commit -m "feat(sandbox): add duckdb-wasm, apache-arrow, geoarrow dependencies"
```

---

## Task 3: Vite Config — Storage Proxy and WASM Support

**Files:**
- Modify: `sandbox/frontend/vite.config.ts`

- [ ] **Step 1: Add `/storage/` proxy**

In `vite.config.ts`, inside the `proxy` object (after the `/pmtiles` entry at ~line 30), add:

```typescript
      "/storage": {
        target: process.env.MINIO_PROXY_TARGET || "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/storage/, "/sandbox-data"),
      },
```

- [ ] **Step 2: Add optimizeDeps.exclude for DuckDB-WASM**

After the `resolve` block (~line 61), add:

```typescript
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
```

- [ ] **Step 3: Verify dev server starts**

```bash
cd sandbox/frontend && npx vite --port 5185 &
sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:5185/ && kill %1
```

Expected: `200`

- [ ] **Step 4: Verify range requests pass through proxy**

Start the full Docker stack, then:

```bash
# Upload a test GeoJSON first, then check the parquet file responds to range requests
curl -s -I "http://localhost:5185/storage/datasets/<test-id>/converted/<test-file>.parquet" | head -5
```

Expected: HTTP 200 or 206, confirming MinIO serves the file through the proxy.

- [ ] **Step 5: Commit**

```bash
git add sandbox/frontend/vite.config.ts
git commit -m "feat(sandbox): add /storage/ proxy and duckdb-wasm vite config"
```

---

## Task 4: `useDuckDB` Hook — Lazy DuckDB-WASM Initialization

**Files:**
- Create: `sandbox/frontend/src/hooks/useDuckDB.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useRef, useState, useCallback } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";

interface DuckDBState {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
  loading: boolean;
  error: string | null;
}

const dbSingleton: { db: duckdb.AsyncDuckDB | null; conn: duckdb.AsyncDuckDBConnection | null } = {
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
      setState({ db: dbSingleton.db, conn: dbSingleton.conn, loading: false, error: null });
      return;
    }
    if (initializingRef.current) return;
    initializingRef.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const DUCKDB_BUNDLES = await duckdb.selectBundle(duckdb.getJsDelivrBundles());

      const worker = new Worker(DUCKDB_BUNDLES.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(DUCKDB_BUNDLES.mainModule, DUCKDB_BUNDLES.pthreadWorker);

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
```

Key points:
- Module-level singleton so DuckDB is only initialized once across re-renders and component remounts
- `initialize()` is called lazily (on first Explore tab click, not on page load)
- Installs the `spatial` extension for geometry support
- Uses jsDelivr CDN bundles (no need to self-host WASM files)

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/hooks/useDuckDB.ts
git commit -m "feat(sandbox): add useDuckDB hook for lazy WASM initialization"
```

---

## Task 5: `useGeoParquetQuery` Hook — Query Execution + Stats

**Files:**
- Create: `sandbox/frontend/src/hooks/useGeoParquetQuery.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useState, useCallback } from "react";
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

        // Run the actual query with limit (subquery-wrapped to handle user SQL safely)
        const limitedSql = `SELECT * FROM (${sql}) _limited LIMIT ${FEATURE_LIMIT}`;
        const table = await conn.query(limitedSql);

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
```

Key points:
- `loadInitial()` runs the first unfiltered query on Explore tab open
- `runQuery(sql)` accepts any SQL string — used by both filter-generated and custom SQL
- `computeStats()` uses DuckDB's `SUMMARIZE` for fast column profiling
- `FEATURE_LIMIT` of 100K with `truncated` flag for the UI warning
- Column names are double-quoted to handle spaces and reserved words

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/hooks/useGeoParquetQuery.ts
git commit -m "feat(sandbox): add useGeoParquetQuery hook for DuckDB query execution"
```

---

## Task 6: `useFilterQuery` Hook — Filter State and SQL Generation

**Files:**
- Create: `sandbox/frontend/src/hooks/useFilterQuery.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import type { ColumnStats } from "./useGeoParquetQuery";

export interface NumericFilter {
  column: string;
  type: "numeric";
  min: number;
  max: number;
  currentMin: number;
  currentMax: number;
}

export interface CategoricalFilter {
  column: string;
  type: "categorical";
  values: string[];
  selected: string[];
}

export type Filter = NumericFilter | CategoricalFilter;

interface UseFilterQueryOptions {
  parquetUrl: string;
  onSqlChange: (sql: string) => void;
  debounceMs?: number;
}

const MAX_AUTO_FILTERS = 8;

export function useFilterQuery({ parquetUrl, onSqlChange, debounceMs = 300 }: UseFilterQueryOptions) {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [customSql, setCustomSql] = useState<string | null>(null);
  const [availableColumns, setAvailableColumns] = useState<ColumnStats[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fullUrl = `${window.location.origin}${parquetUrl}`;
  const baseSql = `SELECT * FROM read_parquet('${fullUrl}')`;

  const buildFiltersFromStats = useCallback((stats: ColumnStats[]) => {
    setAvailableColumns(stats);
    const autoFilters: Filter[] = [];

    // Priority 1: numeric with variance
    const numerics = stats.filter(
      (s) => s.type === "numeric" && s.min != null && s.max != null && s.min !== s.max,
    );
    for (const s of numerics) {
      if (autoFilters.length >= MAX_AUTO_FILTERS) break;
      autoFilters.push({
        column: s.name,
        type: "numeric",
        min: s.min!,
        max: s.max!,
        currentMin: s.min!,
        currentMax: s.max!,
      });
    }

    // Priority 2: categorical with 2-20 unique values
    const categoricals = stats.filter(
      (s) => s.type === "categorical" && s.uniqueCount != null && s.uniqueCount >= 2 && s.uniqueCount! <= 20 && s.topValues?.length,
    );
    for (const s of categoricals) {
      if (autoFilters.length >= MAX_AUTO_FILTERS) break;
      const values = s.topValues!.map((v) => v.value);
      autoFilters.push({
        column: s.name,
        type: "categorical",
        values,
        selected: [...values], // all selected by default
      });
    }

    setFilters(autoFilters);
  }, []);

  const generateSql = useCallback(() => {
    if (customSql !== null) return customSql;

    const clauses: string[] = [];
    for (const f of filters) {
      if (f.type === "numeric") {
        if (f.currentMin !== f.min || f.currentMax !== f.max) {
          clauses.push(`"${f.column}" BETWEEN ${f.currentMin} AND ${f.currentMax}`);
        }
      } else if (f.type === "categorical") {
        if (f.selected.length < f.values.length) {
          const escaped = f.selected.map((v) => `'${v.replace(/'/g, "''")}'`);
          clauses.push(`"${f.column}" IN (${escaped.join(", ")})`);
        }
      }
    }

    return clauses.length > 0 ? `${baseSql} WHERE ${clauses.join(" AND ")}` : baseSql;
  }, [filters, customSql, baseSql]);

  const updateFilter = useCallback(
    (column: string, update: Partial<NumericFilter> | Partial<CategoricalFilter>) => {
      setCustomSql(null); // revert to filter mode
      setFilters((prev) =>
        prev.map((f) => (f.column === column ? { ...f, ...update } : f)),
      );
    },
    [],
  );

  const addFilter = useCallback(
    (stat: ColumnStats) => {
      if (filters.some((f) => f.column === stat.name)) return;
      if (stat.type === "numeric" && stat.min != null && stat.max != null) {
        setFilters((prev) => [
          ...prev,
          { column: stat.name, type: "numeric", min: stat.min!, max: stat.max!, currentMin: stat.min!, currentMax: stat.max! },
        ]);
      } else if (stat.type === "categorical" && stat.topValues?.length) {
        const values = stat.topValues.map((v) => v.value);
        setFilters((prev) => [
          ...prev,
          { column: stat.name, type: "categorical", values, selected: [...values] },
        ]);
      }
    },
    [filters],
  );

  const removeFilter = useCallback((column: string) => {
    setFilters((prev) => prev.filter((f) => f.column !== column));
  }, []);

  const resetToFilters = useCallback(() => {
    setCustomSql(null);
  }, []);

  // Debounced SQL emission
  useEffect(() => {
    const sql = generateSql();
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSqlChange(sql), debounceMs);
    return () => clearTimeout(debounceRef.current);
  }, [generateSql, onSqlChange, debounceMs]);

  const isCustomMode = customSql !== null;
  const currentSql = generateSql();

  return {
    filters,
    availableColumns,
    isCustomMode,
    currentSql,
    buildFiltersFromStats,
    updateFilter,
    addFilter,
    removeFilter,
    setCustomSql,
    resetToFilters,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/hooks/useFilterQuery.ts
git commit -m "feat(sandbox): add useFilterQuery hook for filter state and SQL generation"
```

---

## Task 7: `SqlEditor` Component

**Files:**
- Create: `sandbox/frontend/src/components/SqlEditor.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { useState, useEffect } from "react";
import { Box, Button, Flex, Text, Textarea, Badge } from "@chakra-ui/react";

interface SqlEditorProps {
  sql: string;
  isCustomMode: boolean;
  error: string | null;
  loading: boolean;
  onRunQuery: (sql: string) => void;
  onSetCustomSql: (sql: string) => void;
  onReset: () => void;
}

export function SqlEditor({
  sql,
  isCustomMode,
  error,
  loading,
  onRunQuery,
  onSetCustomSql,
  onReset,
}: SqlEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [editValue, setEditValue] = useState(sql);

  // Keep editValue in sync when filters generate new SQL (only in filter mode)
  useEffect(() => {
    if (!isCustomMode) setEditValue(sql);
  }, [sql, isCustomMode]);

  return (
    <Box>
      <Flex
        align="center"
        gap={2}
        cursor="pointer"
        onClick={() => setExpanded((e) => !e)}
        py={1}
      >
        <Text fontSize="xs" fontWeight={600} color="gray.600">
          {expanded ? "▼" : "▶"} SQL
        </Text>
        {isCustomMode && (
          <Badge colorPalette="orange" size="sm">Custom SQL</Badge>
        )}
      </Flex>

      {!expanded && (
        <Text fontSize="xs" color="gray.500" truncate fontFamily="mono">
          {sql}
        </Text>
      )}

      {expanded && (
        <Box>
          <Textarea
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              onSetCustomSql(e.target.value);
            }}
            fontFamily="mono"
            fontSize="xs"
            rows={4}
            resize="vertical"
            mb={2}
          />
          <Flex gap={2}>
            <Button
              size="xs"
              colorPalette="orange"
              onClick={() => onRunQuery(editValue)}
              loading={loading}
            >
              Run query
            </Button>
            {isCustomMode && (
              <Button size="xs" variant="ghost" onClick={onReset}>
                Reset to filters
              </Button>
            )}
          </Flex>
        </Box>
      )}

      {error && (
        <Text fontSize="xs" color="red.500" mt={1}>
          {error}
        </Text>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/SqlEditor.tsx
git commit -m "feat(sandbox): add SqlEditor component"
```

---

## Task 8: `FilterControls` Component

**Files:**
- Create: `sandbox/frontend/src/components/FilterControls.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { Box, Flex, Text, Slider, Button } from "@chakra-ui/react";
import type { Filter, NumericFilter, CategoricalFilter } from "../hooks/useFilterQuery";
import type { ColumnStats } from "../hooks/useGeoParquetQuery";

interface FilterControlsProps {
  filters: Filter[];
  availableColumns: ColumnStats[];
  onUpdateFilter: (column: string, update: Partial<NumericFilter> | Partial<CategoricalFilter>) => void;
  onAddFilter: (stat: ColumnStats) => void;
  onRemoveFilter: (column: string) => void;
  disabled: boolean;
}

function NumericFilterControl({
  filter,
  onUpdate,
  onRemove,
  disabled,
}: {
  filter: NumericFilter;
  onUpdate: (update: Partial<NumericFilter>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const formatNum = (n: number) =>
    Math.abs(n) >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : Math.abs(n) >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : n.toFixed(n % 1 === 0 ? 0 : 1);

  return (
    <Box mb={3}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="xs" fontWeight={500} truncate>
          {filter.column}
        </Text>
        <Text
          fontSize="xs"
          color="gray.400"
          cursor="pointer"
          onClick={onRemove}
        >
          ×
        </Text>
      </Flex>
      <Slider.Root
        min={filter.min}
        max={filter.max}
        step={(filter.max - filter.min) / 100}
        value={[filter.currentMin, filter.currentMax]}
        onValueChange={({ value }: { value: number[] }) =>
          onUpdate({ currentMin: value[0], currentMax: value[1] })
        }
        disabled={disabled}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb index={0} />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>
      <Flex justify="space-between" mt={0.5}>
        <Text fontSize="2xs" color="gray.500">{formatNum(filter.currentMin)}</Text>
        <Text fontSize="2xs" color="gray.500">{formatNum(filter.currentMax)}</Text>
      </Flex>
    </Box>
  );
}

function CategoricalFilterControl({
  filter,
  onUpdate,
  onRemove,
  disabled,
}: {
  filter: CategoricalFilter;
  onUpdate: (update: Partial<CategoricalFilter>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const toggle = (value: string) => {
    const selected = filter.selected.includes(value)
      ? filter.selected.filter((v) => v !== value)
      : [...filter.selected, value];
    onUpdate({ selected });
  };

  return (
    <Box mb={3}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="xs" fontWeight={500} truncate>
          {filter.column}
        </Text>
        <Text
          fontSize="xs"
          color="gray.400"
          cursor="pointer"
          onClick={onRemove}
        >
          ×
        </Text>
      </Flex>
      <Flex wrap="wrap" gap={1}>
        {filter.values.map((v) => (
          <Button
            key={v}
            size="2xs"
            variant={filter.selected.includes(v) ? "solid" : "outline"}
            colorPalette={filter.selected.includes(v) ? "orange" : "gray"}
            onClick={() => toggle(v)}
            disabled={disabled}
            fontSize="2xs"
          >
            {v}
          </Button>
        ))}
      </Flex>
    </Box>
  );
}

export function FilterControls({
  filters,
  availableColumns,
  onUpdateFilter,
  onAddFilter,
  onRemoveFilter,
  disabled,
}: FilterControlsProps) {
  const activeColumnNames = new Set(filters.map((f) => f.column));
  const addableColumns = availableColumns.filter(
    (s) => !activeColumnNames.has(s.name) && (s.type === "numeric" || s.type === "categorical"),
  );

  return (
    <Box>
      {filters.map((f) =>
        f.type === "numeric" ? (
          <NumericFilterControl
            key={f.column}
            filter={f}
            onUpdate={(u) => onUpdateFilter(f.column, u)}
            onRemove={() => onRemoveFilter(f.column)}
            disabled={disabled}
          />
        ) : (
          <CategoricalFilterControl
            key={f.column}
            filter={f as CategoricalFilter}
            onUpdate={(u) => onUpdateFilter(f.column, u)}
            onRemove={() => onRemoveFilter(f.column)}
            disabled={disabled}
          />
        ),
      )}

      {addableColumns.length > 0 && (
        <Box mt={2}>
          <Text fontSize="xs" color="gray.500" mb={1}>
            + Add filter
          </Text>
          <Flex wrap="wrap" gap={1}>
            {addableColumns.slice(0, 10).map((s) => (
              <Button
                key={s.name}
                size="2xs"
                variant="outline"
                onClick={() => onAddFilter(s)}
                fontSize="2xs"
              >
                {s.name}
              </Button>
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/FilterControls.tsx
git commit -m "feat(sandbox): add FilterControls component with range sliders and multi-selects"
```

---

## Task 9: `DuckDBMap` Component — deck.gl + GeoArrow Rendering

**Files:**
- Create: `sandbox/frontend/src/components/DuckDBMap.tsx`

- [ ] **Step 1: Write the component**

This component renders an Arrow table from DuckDB on a deck.gl map with a MapLibre basemap. It detects geometry type from the Arrow table columns and picks the right GeoArrow layer.

```typescript
import { useMemo, useCallback } from "react";
import { Box, NativeSelect } from "@chakra-ui/react";
import { DeckGL } from "@deck.gl/react";
import { MapView } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import { GeoArrowPolygonLayer, GeoArrowPathLayer, GeoArrowScatterplotLayer } from "@geoarrow/deck.gl-layers";
import type { Table } from "apache-arrow";
import type { MapViewState } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAPS: Record<string, string> = {
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const ACCENT_COLOR = [207, 63, 2, 180] as [number, number, number, number]; // #CF3F02 with alpha

interface DuckDBMapProps {
  table: Table | null;
  viewState: MapViewState;
  onViewStateChange: (vs: MapViewState) => void;
  basemap: string;
  onBasemapChange: (basemap: string) => void;
}

function detectGeometryColumn(table: Table): string | null {
  for (const field of table.schema.fields) {
    const meta = field.metadata;
    if (meta?.get("ARROW:extension:name")?.includes("geoarrow")) {
      return field.name;
    }
  }
  // Fallback: common geometry column names
  for (const name of ["geometry", "geom", "wkb_geometry", "the_geom"]) {
    if (table.schema.fields.some((f) => f.name === name)) return name;
  }
  return null;
}

function detectGeometryType(table: Table, geomCol: string): "polygon" | "line" | "point" {
  const field = table.schema.fields.find((f) => f.name === geomCol);
  if (!field) return "point";
  const extName = field.metadata?.get("ARROW:extension:name") ?? "";
  if (extName.includes("polygon") || extName.includes("multipolygon")) return "polygon";
  if (extName.includes("linestring") || extName.includes("multilinestring")) return "line";
  return "point";
}

export function DuckDBMap({
  table,
  viewState,
  onViewStateChange,
  basemap,
  onBasemapChange,
}: DuckDBMapProps) {
  const layers = useMemo(() => {
    if (!table || table.numRows === 0) return [];

    const geomCol = detectGeometryColumn(table);
    if (!geomCol) return [];

    const geomType = detectGeometryType(table, geomCol);

    if (geomType === "polygon") {
      return [
        new GeoArrowPolygonLayer({
          id: "duckdb-polygons",
          data: table,
          getPolygon: geomCol,
          getFillColor: ACCENT_COLOR,
          getLineColor: [207, 63, 2, 255],
          getLineWidth: 1.5,
          lineWidthMinPixels: 1,
          pickable: true,
        }),
      ];
    }
    if (geomType === "line") {
      return [
        new GeoArrowPathLayer({
          id: "duckdb-lines",
          data: table,
          getPath: geomCol,
          getColor: [207, 63, 2, 255],
          getWidth: 2,
          widthMinPixels: 1,
          pickable: true,
        }),
      ];
    }
    return [
      new GeoArrowScatterplotLayer({
        id: "duckdb-points",
        data: table,
        getPosition: geomCol,
        getFillColor: ACCENT_COLOR,
        getLineColor: [255, 255, 255, 255],
        getRadius: 4,
        radiusMinPixels: 3,
        lineWidthMinPixels: 1,
        stroked: true,
        pickable: true,
      }),
    ];
  }, [table]);

  const onHover = useCallback((info: { object?: unknown }) => {
    // Could add tooltip here later
  }, []);

  return (
    <Box position="relative" w="100%" h="100%">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => onViewStateChange(vs as MapViewState)}
        controller
        layers={layers}
        onHover={onHover}
        views={new MapView({ repeat: true })}
        getTooltip={({ object }: { object?: Record<string, unknown> }) => {
          if (!object) return null;
          const props = Object.entries(object)
            .filter(([k]) => k !== "geometry" && k !== "geom")
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");
          return { text: props, style: { fontSize: "12px" } };
        }}
      >
        <Map mapStyle={BASEMAPS[basemap]} />
      </DeckGL>
      <Box position="absolute" top={3} left={3} bg="white" borderRadius="4px" shadow="sm" p={1}>
        <NativeSelect.Root size="xs">
          <NativeSelect.Field
            value={basemap}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onBasemapChange(e.target.value)}
          >
            <option value="streets">Streets</option>
            <option value="satellite">Satellite</option>
            <option value="dark">Dark</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>
    </Box>
  );
}
```

Key points:
- Geometry type detected from Arrow metadata (`ARROW:extension:name`), not dataset metadata — so custom SQL with `ST_Centroid` etc. works
- `viewState` and `basemap` controlled by parent (MapPage) for sync between tabs
- Same basemap dropdown as VectorMap, same `BASEMAPS` const, same accent color
- deck.gl tooltip shows feature properties on hover

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/DuckDBMap.tsx
git commit -m "feat(sandbox): add DuckDBMap component with GeoArrow rendering"
```

---

## Task 10: `ExploreTab` Component — Container Wiring Everything Together

**Files:**
- Create: `sandbox/frontend/src/components/ExploreTab.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { useEffect, useCallback, useRef } from "react";
import { Box, Flex, Spinner, Text } from "@chakra-ui/react";
import type { Table } from "apache-arrow";
import { useDuckDB } from "../hooks/useDuckDB";
import { useGeoParquetQuery } from "../hooks/useGeoParquetQuery";
import { useFilterQuery } from "../hooks/useFilterQuery";
import { FilterControls } from "./FilterControls";
import { SqlEditor } from "./SqlEditor";
import type { Dataset } from "../types";

interface ExploreTabProps {
  dataset: Dataset;
  active: boolean;
  onTableChange: (table: Table | null) => void;
}

export function ExploreTab({ dataset, active, onTableChange }: ExploreTabProps) {
  const { db, conn, loading: duckdbLoading, error: duckdbError, initialize } = useDuckDB();
  const parquetUrl = dataset.parquet_url!;
  const { result, loading: queryLoading, runQuery, loadInitial } = useGeoParquetQuery(conn, parquetUrl);

  const handleSqlChange = useCallback(
    (sql: string) => {
      if (conn) runQuery(sql);
    },
    [conn, runQuery],
  );

  const filterQuery = useFilterQuery({
    parquetUrl,
    onSqlChange: handleSqlChange,
  });

  // Initialize DuckDB on first activation
  useEffect(() => {
    if (active && !db && !duckdbLoading) {
      initialize();
    }
  }, [active, db, duckdbLoading, initialize]);

  // Load initial data once connected
  useEffect(() => {
    if (conn && active && result.totalCount === 0 && !queryLoading) {
      loadInitial();
    }
  }, [conn, active, result.totalCount, queryLoading, loadInitial]);

  // Build filters once we have stats (only once)
  const filtersInitialized = useRef(false);
  useEffect(() => {
    if (result.columnStats.length > 0 && !filtersInitialized.current) {
      filtersInitialized.current = true;
      filterQuery.buildFiltersFromStats(result.columnStats);
    }
  }, [result.columnStats, filterQuery.buildFiltersFromStats]);

  // Propagate Arrow table to parent for DuckDBMap rendering
  useEffect(() => {
    onTableChange(result.table);
  }, [result.table, onTableChange]);

  if (duckdbLoading) {
    return (
      <Flex align="center" justify="center" h="200px" direction="column" gap={3}>
        <Spinner size="md" color="brand.orange" />
        <Text fontSize="sm" color="gray.500">Loading DuckDB...</Text>
      </Flex>
    );
  }

  if (duckdbError) {
    return (
      <Box p={4}>
        <Text fontSize="sm" color="red.500">
          {duckdbError}
        </Text>
        <Text fontSize="xs" color="gray.500" mt={2}>
          Your browser may not support WebAssembly.
        </Text>
      </Box>
    );
  }

  const formatCount = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

  return (
    <Box p={4} fontSize="sm">
      {/* Feature count */}
      <Box mb={4}>
        <Text fontSize="2xl" fontWeight={700} lineHeight={1}>
          {queryLoading ? "..." : formatCount(result.filteredCount)}
          {result.totalCount > 0 && result.filteredCount !== result.totalCount && (
            <Text as="span" fontSize="sm" fontWeight={400} color="gray.500">
              {" "}of {formatCount(result.totalCount)}
            </Text>
          )}
        </Text>
        <Text fontSize="xs" color="gray.500">features</Text>
        {result.truncated && (
          <Text fontSize="xs" color="orange.500" mt={1}>
            Showing first 100,000 features. Add filters to narrow results.
          </Text>
        )}
      </Box>

      {/* Filters */}
      <Box mb={4}>
        <Text fontSize="xs" fontWeight={600} color="gray.600" mb={2}>
          Filters
        </Text>
        <FilterControls
          filters={filterQuery.filters}
          availableColumns={filterQuery.availableColumns}
          onUpdateFilter={filterQuery.updateFilter}
          onAddFilter={filterQuery.addFilter}
          onRemoveFilter={filterQuery.removeFilter}
          disabled={filterQuery.isCustomMode || queryLoading}
        />
      </Box>

      {/* SQL Editor */}
      <Box mb={4}>
        <SqlEditor
          sql={filterQuery.currentSql}
          isCustomMode={filterQuery.isCustomMode}
          error={result.error}
          loading={queryLoading}
          onRunQuery={runQuery}
          onSetCustomSql={filterQuery.setCustomSql}
          onReset={filterQuery.resetToFilters}
        />
      </Box>

      {/* Column Stats */}
      {result.columnStats.length > 0 && (
        <Box>
          <Text fontSize="xs" fontWeight={600} color="gray.600" mb={2}>
            Column stats
          </Text>
          {result.columnStats.slice(0, 6).map((stat) => (
            <Box key={stat.name} mb={2}>
              <Text fontSize="xs" fontWeight={500}>{stat.name}</Text>
              {stat.type === "numeric" && (
                <Text fontSize="2xs" color="gray.500">
                  {stat.min?.toLocaleString()} – {stat.max?.toLocaleString()}
                  {stat.mean != null && ` · avg ${stat.mean.toLocaleString()}`}
                </Text>
              )}
              {stat.type === "categorical" && (
                <Text fontSize="2xs" color="gray.500">
                  {stat.uniqueCount} unique values
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/ExploreTab.tsx
git commit -m "feat(sandbox): add ExploreTab component wiring DuckDB query UI"
```

---

## Task 11: Modify VectorMap — Lift Basemap State

**Files:**
- Modify: `sandbox/frontend/src/components/VectorMap.tsx`

- [ ] **Step 1: Update VectorMap props and remove internal basemap state**

Add `basemap` and `onBasemapChange` props. Remove the internal `useState("streets")`. Also add `onViewportChange` callback for viewport sync.

Changes to `VectorMap.tsx`:

1. Update the props interface (line 18-20):

```typescript
interface VectorMapProps {
  dataset: Dataset;
  basemap: string;
  onBasemapChange: (basemap: string) => void;
  onViewportChange?: (viewport: { longitude: number; latitude: number; zoom: number }) => void;
}
```

2. Update the component signature and remove the basemap state (lines 22-25):

```typescript
export function VectorMap({ dataset, basemap, onBasemapChange, onViewportChange }: VectorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
```

Remove the line: `const [basemap, setBasemap] = useState("streets");`

3. Add a `moveend` listener after the `on("load")` block inside the map initialization effect (~line 151). After `mapRef.current = map;`:

```typescript
    map.on("moveend", () => {
      if (onViewportChange) {
        const center = map.getCenter();
        onViewportChange({
          longitude: center.lng,
          latitude: center.lat,
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        });
      }
    });
```

4. Update the basemap selector `onChange` (line 185):

Change `setBasemap(e.target.value)` to `onBasemapChange(e.target.value)`.

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/VectorMap.tsx
git commit -m "refactor(sandbox): lift basemap state out of VectorMap"
```

---

## Task 12: Modify CreditsPanel — Add Tabs

**Files:**
- Modify: `sandbox/frontend/src/components/CreditsPanel.tsx`

- [ ] **Step 1: Add tabbed container**

The CreditsPanel currently renders all content directly. Wrap it in Chakra UI's `Tabs` component. The Explore tab only appears for vector datasets with `parquet_url`.

Add to imports:

```typescript
import { Tabs } from "@chakra-ui/react";
```

Update the component signature to accept tab control:

```typescript
interface CreditsPanelProps {
  dataset: Dataset;
  gapCount?: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
  exploreContent?: React.ReactNode;
}
```

Wrap the return in Tabs. The existing content becomes the "Credits" tab panel, and `exploreContent` is passed as a render prop for the "Explore" tab:

```typescript
export function CreditsPanel({
  dataset,
  gapCount = 0,
  activeTab,
  onTabChange,
  exploreContent,
}: CreditsPanelProps) {
  const showExplore = dataset.dataset_type === "vector" && dataset.parquet_url != null;
  // ... existing helper functions unchanged ...

  if (!showExplore) {
    // Render without tabs (raster datasets, tipg-only vectors)
    return (
      <Box p={4} fontSize="sm">
        {/* existing credits content */}
      </Box>
    );
  }

  return (
    <Tabs.Root value={activeTab} onValueChange={(e) => onTabChange(e.value)}>
      <Tabs.List>
        <Tabs.Trigger value="credits">Credits</Tabs.Trigger>
        <Tabs.Trigger value="explore">Explore</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Content value="credits">
        <Box p={4} fontSize="sm">
          {/* existing credits content — moved here unchanged */}
        </Box>
      </Tabs.Content>
      <Tabs.Content value="explore">
        {exploreContent}
      </Tabs.Content>
    </Tabs.Root>
  );
}
```

The actual refactor: extract the existing JSX body into a local `creditsContent` variable and use it inside the "credits" tab panel. All existing rendering logic (credits loop, validation, raster, temporal, what's next, expiry) stays exactly as-is, just nested one level deeper.

- [ ] **Step 2: Commit**

```bash
git add sandbox/frontend/src/components/CreditsPanel.tsx
git commit -m "feat(sandbox): add Explore/Credits tabs to CreditsPanel"
```

---

## Task 13: Modify MapPage — Tab State, Viewport Sync, DuckDBMap Integration

**Files:**
- Modify: `sandbox/frontend/src/pages/MapPage.tsx`

- [ ] **Step 1: Add imports and state**

Add imports for the new components:

```typescript
import { ExploreTab } from "../components/ExploreTab";
import { DuckDBMap } from "../components/DuckDBMap";
import type { MapViewState } from "@deck.gl/core";
```

Add new state variables after the existing state declarations (after line 23):

```typescript
const [activeTab, setActiveTab] = useState("credits");
const [basemap, setBasemap] = useState("streets");
const [viewState, setViewState] = useState<MapViewState>({
  longitude: 0,
  latitude: 0,
  zoom: 2,
});
```

- [ ] **Step 2: Initialize viewState from dataset bounds**

Add an effect that sets the viewState when the dataset loads (after the existing fetchDataset effect):

```typescript
useEffect(() => {
  if (dataset?.bounds) {
    const [west, south, east, north] = dataset.bounds;
    setViewState({
      longitude: (west + east) / 2,
      latitude: (south + north) / 2,
      zoom: 3,
    });
  }
}, [dataset?.bounds]);
```

- [ ] **Step 3: Update the map rendering section**

Replace the vector map conditional (lines 142-144) with tab-aware rendering:

```typescript
{dataset.dataset_type === "raster" ? (
  <RasterMap
    dataset={dataset}
    initialTimestep={dataset.is_temporal ? initialTimestep : undefined}
    onTimestepChange={(index) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("t", String(index));
        return next;
      }, { replace: true });
    }}
  />
) : activeTab === "explore" ? (
  <DuckDBMap
    table={/* passed from ExploreTab via shared state — see step 4 */}
    viewState={viewState}
    onViewStateChange={setViewState}
    basemap={basemap}
    onBasemapChange={setBasemap}
  />
) : (
  <VectorMap
    dataset={dataset}
    basemap={basemap}
    onBasemapChange={setBasemap}
    onViewportChange={(vp) => setViewState((prev) => ({ ...prev, ...vp }))}
  />
)}
```

- [ ] **Step 4: Add Arrow table state for sharing between ExploreTab and DuckDBMap**

Both ExploreTab (which runs queries) and DuckDBMap (which renders results) need access to the same Arrow table. Add a state in MapPage:

```typescript
const [arrowTable, setArrowTable] = useState<Table | null>(null);
```

Add the import: `import type { Table } from "apache-arrow";`

ExploreTab already accepts `onTableChange` and propagates `result.table` via useEffect (defined in Task 10). Pass `setArrowTable` as `onTableChange` and `arrowTable` as `table` to DuckDBMap.

- [ ] **Step 5: Update CreditsPanel usage**

Replace the CreditsPanel rendering (lines 152-153) to pass tab state and ExploreTab content:

```typescript
<CreditsPanel
  dataset={dataset}
  gapCount={gapCount}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  exploreContent={
    dataset.parquet_url ? (
      <ExploreTab
        dataset={dataset}
        active={activeTab === "explore"}
        onTableChange={setArrowTable}
      />
    ) : undefined
  }
/>
```

- [ ] **Step 6: Commit**

```bash
git add sandbox/frontend/src/pages/MapPage.tsx sandbox/frontend/src/components/ExploreTab.tsx
git commit -m "feat(sandbox): integrate DuckDB Explore tab into MapPage with viewport sync"
```

---

## Task 14: Integration Testing

- [ ] **Step 1: Rebuild and start the stack**

```bash
cd /home/anthony/projects/map-app-builder
npm run build
docker compose -f sandbox/docker-compose.yml up -d --build
```

- [ ] **Step 2: Upload a test vector file**

Upload a GeoJSON or Shapefile through the sandbox UI at `http://localhost:5185`. Wait for conversion to complete. Navigate to the map page.

- [ ] **Step 3: Verify Credits tab works as before**

The default tab should show "Credits" with the existing content. The VectorMap should render PMTiles as before.

- [ ] **Step 4: Verify Explore tab appears**

For a vector dataset that went through PMTiles path, the "Explore" tab should appear in the tab bar.

- [ ] **Step 5: Click Explore tab — verify DuckDB loads**

Click the Explore tab. Should see "Loading DuckDB..." spinner, then the feature count and auto-generated filters once DuckDB initializes and queries the GeoParquet.

- [ ] **Step 6: Verify map switches to DuckDB rendering**

The map should switch from MapLibre vector tiles to deck.gl GeoArrow rendering. Features should appear in the same orange accent color.

- [ ] **Step 7: Test filter interaction**

Move a range slider or deselect a categorical value. The feature count should update, the map should re-render with fewer features, and the SQL preview should update.

- [ ] **Step 8: Test SQL editor**

Expand the SQL section, edit the query, click "Run query". Verify the map updates with the custom query results. Verify the "Custom SQL" badge appears and filters are dimmed.

- [ ] **Step 9: Test tab switching preserves viewport**

Zoom into an area in Explore mode. Switch to Credits tab. The VectorMap should show the same viewport. Switch back — DuckDBMap should have the same viewport.

- [ ] **Step 10: Test basemap sync**

Change basemap to "dark" in Explore tab. Switch to Credits tab. The VectorMap should also show the dark basemap.

- [ ] **Step 11: Verify raster datasets unchanged**

Navigate to a raster dataset. Should not show any Explore tab. CreditsPanel renders without tabs.

- [ ] **Step 12: Take screenshots to verify**

Use Chrome DevTools MCP to screenshot the Explore tab in action. Save to `/tmp/`.

- [ ] **Step 13: Commit any fixes from integration testing**

```bash
git add -A
git commit -m "fix(sandbox): integration fixes for DuckDB Explore tab"
```

---

## Task Summary

| Task | Description | Est. Complexity |
|------|-------------|----------------|
| 1 | Backend — Add `parquet_url` field | Small |
| 2 | Install npm dependencies | Small |
| 3 | Vite config — proxy + WASM | Small |
| 4 | `useDuckDB` hook | Medium |
| 5 | `useGeoParquetQuery` hook | Medium |
| 6 | `useFilterQuery` hook | Medium |
| 7 | `SqlEditor` component | Small |
| 8 | `FilterControls` component | Medium |
| 9 | `DuckDBMap` component | Medium |
| 10 | `ExploreTab` component | Medium |
| 11 | VectorMap — lift basemap | Small |
| 12 | CreditsPanel — add tabs | Small |
| 13 | MapPage — tab state + integration | Medium |
| 14 | Integration testing | Medium |

---

## Deferred From Spec (Intentional Scope Reductions)

These items are in the spec but deferred from this implementation pass:

- **Date/timestamp filter controls** — Spec lists date range pickers as priority 3. Deferred to keep FilterControls focused. Date columns are detected by `useGeoParquetQuery` stats but no filter widget is generated for them yet.
- **Bar charts for categorical columns** — Spec shows bar charts with ghost bars for filtered-vs-full distribution. Deferred; text-only stats for now.
- **Geometry summary** — Spec shows "12,847 Polygons" or "Mixed: 10K Polygons, 2K Points" in the stats section. Deferred; feature count is shown but not geometry breakdown.
- **Click popup on DuckDBMap** — Spec says click popup matching VectorMap style. DuckDBMap uses deck.gl's `getTooltip` (hover) instead. Click popup on GeoArrow layers requires custom picking logic that can be added later.
- **Unit tests for hooks** — `useFilterQuery` SQL generation logic would benefit from unit tests. Deferred to a follow-up after integration is verified.
